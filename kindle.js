// Kindleシリーズページの巻ASINを全件集めてクリップボードへ。
//
// 巻一覧はJS描画なので、ページのリストが使っているのと同じAJAX
// (/kindle-dbs/productPage/ajax/seriesAsinList) を10件ずつ最後まで引く。
// 予約中の巻も含み、スクロールやページャ操作に依存しないので壊れにくい。
// 収集ロジックは app/amazon_scrape.py の fetch_series_page と揃えてある。
(() => {
  "use strict";

  const ASIN_RE = /^B0[0-9A-Z]{8}$/;
  const LINK_RE = /\/gp\/product\/(B0[0-9A-Z]{8})\?ref_=[^"']*rwt_calw/g;
  const PAGE_SIZE = 10;
  const MAX_PAGES = 50; // 500巻まで（こち亀でも収まる）

  /** ページURLのASIN（シリーズページかどうかの判定にも使う）
   *
   * 巻ページから飛ぶと /kindle-dbs/product/{シリーズASIN}?...&ASIN={巻ASIN} の形に
   * なる。欲しいのはパス側（シリーズ）なので、クエリのASIN=は見ない。
   */
  function pageAsin() {
    const m = location.pathname.match(
      /\/(?:dp|gp\/product|kindle-dbs\/product)\/(B0[0-9A-Z]{8})/
    );
    return m ? m[1] : null;
  }

  /** ページの状態JSONから "key":"B0…" を1つ取り出す */
  function stateAsin(html, key) {
    const m = html.match(new RegExp(`"${key}"\\s*:\\s*"(B0[0-9A-Z]{8})"`));
    return m ? m[1] : null;
  }

  /** 「話」「巻」タブを持つ統合シリーズページか */
  function isTabbed(html, volumeAsin, episodeAsin) {
    // 状態JSONを持たないレンダリング変種があるため、タブUIのマークアップでも見る
    return (!!volumeAsin && !!episodeAsin) ||
      html.includes('data-collection-type="issue"');
  }

  /** HTML断片から巻ASINを出現順に取り出す */
  function asinsFromHtml(html) {
    const out = [];
    for (const m of html.matchAll(LINK_RE)) out.push(m[1]);
    return out;
  }

  /**
   * seriesAsinList を1ページ引く。
   * このエンドポイントは間欠的に404を返すので1回だけリトライする。
   */
  async function fetchAjaxPage(asin, page) {
    const params = new URLSearchParams({
      asin,
      pageNumber: String(page),
      pageSize: String(PAGE_SIZE),
      binding: "kindle_edition",
    });
    const url =
      `https://www.amazon.co.jp/kindle-dbs/productPage/ajax/seriesAsinList?${params}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await fetch(url, { credentials: "include" });
      } catch (_e) {
        continue;
      }
      if (!res.ok) continue;
      const text = await res.text();
      // 断片をアイテム単位に割り、各アイテムの商品リンクからASINを取る
      const found = [];
      for (const frag of text.split("series-childAsin-item_").slice(1)) {
        const [first] = asinsFromHtml(frag);
        if (first) found.push(first);
      }
      if (found.length) return found;
    }
    return [];
  }

  /** AJAXを最後まで辿って巻ASINを列挙する */
  async function fetchAllAjax(asin, onProgress) {
    const out = [];
    let misses = 0; // 連続で空だったページ数
    for (let page = 1; page <= MAX_PAGES; page++) {
      const found = await fetchAjaxPage(asin, page);
      if (found.length) {
        misses = 0;
        out.push(...found);
        onProgress(out.length);
      } else {
        // 一時的な空応答を1ページまで許容する（終端では空が続く）
        misses += 1;
        if (misses >= 2) break;
      }
    }
    return out;
  }

  /** AJAXが使えないときの保険：SSR済みのページ本体から拾う */
  function asinsFromPage(html, tabbed) {
    const out = [];
    const seen = new Set();
    if (!tabbed) {
      // まとめ買いカードは巻ASINをカンマ区切りで持つ（予約中の巻は載らない）。
      // タブ付きページでは話・巻が混ざるので使わない
      for (const m of html.matchAll(/data-offer-asins="([^"]+)"/g)) {
        for (const raw of m[1].split(",")) {
          const asin = raw.trim();
          if (ASIN_RE.test(asin) && !seen.has(asin)) {
            seen.add(asin);
            out.push(asin);
          }
        }
      }
    }
    for (const asin of asinsFromHtml(html)) {
      if (!seen.has(asin)) {
        seen.add(asin);
        out.push(asin);
      }
    }
    return out;
  }

  async function collect(onProgress) {
    const html = document.documentElement.innerHTML;
    const asin = pageAsin();
    const volumeAsin = stateAsin(html, "volumeAsin");
    const episodeAsin = stateAsin(html, "episodeAsin");
    const tabbed = isTabbed(html, volumeAsin, episodeAsin);
    // 巻シリーズの正体はvolumeAsin。巻コレクションASINへのAJAXは
    // レンダリング変種と無関係に常に巻一覧だけを返す（話の混入を防げる）
    const seriesAsin = (volumeAsin && episodeAsin) ? volumeAsin : asin;
    const target = tabbed && volumeAsin ? volumeAsin : seriesAsin;

    let asins = await fetchAllAjax(target, onProgress);
    if (!asins.length) asins = asinsFromPage(html, tabbed);

    const seen = new Set();
    return asins.filter((a) => {
      if (a === seriesAsin || seen.has(a)) return false;
      seen.add(a);
      return true;
    });
  }

  KAC.mount({
    tag: "kindle",
    label: "ASINをコピー",
    empty: "巻が見つかりません",
    watchMs: 15000, // 巻一覧は遅延描画なので長めに粘る
    detect: () => {
      if (!pageAsin()) return false;
      // シリーズページ（巻一覧かまとめ買いカードがある）だけに出す
      const html = document.documentElement.innerHTML;
      return html.includes("series-childAsin-item_") ||
        html.includes("data-offer-asins=") ||
        !!document.querySelector(
          "#seriesAsinList, [id^='series-childAsin-item_']"
        );
    },
    // 出現順の通し番号を付ける（1 B00AQ9IH8W …）
    collect: async (onProgress) =>
      (await collect(onProgress)).map((asin, i) => ({ no: i + 1, value: asin })),
  });
})();
