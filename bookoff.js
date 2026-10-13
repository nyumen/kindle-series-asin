// BOOK OFFのセットページから、所属巻のISBNを全件集めてクリップボードへ。
//
// セットページ（/s/{セットID}）は巻一覧をサーバーレンダリングしており、
// 在庫なしの巻も含めて .productSetItem が並ぶ。ただしISBNはここには無く、
// 各巻の商品ページ（/used/{商品ID}）の仕様表に「JAN」として載っている
// （書籍のJANはISBN-13そのもの）。そこで商品IDを拾ってから1件ずつ引く。
(() => {
  "use strict";

  const ISBN_RE = /^97[89]\d{10}$/;
  // 商品ページは1件1秒以上かかる（20巻で30秒超）。相手に負荷をかけない範囲で
  // 数本だけ並べる
  const CONCURRENCY = 3;

  /** セットページの巻一覧を [{no, id, title}] で返す（ページの並び順） */
  function setItems() {
    return [...document.querySelectorAll(".productSetItem")].map((el) => {
      const id = el.querySelector("input.item_id");
      const no = el.querySelector(".tag--num");
      const link = el.querySelector(".productSetItem__link");
      return {
        no: no ? no.textContent.trim() : "",
        id: id ? id.value.trim() : "",
        title: link ? link.textContent.replace(/\s+/g, " ").trim() : "",
      };
    }).filter((it) => it.id && it.no);
  }

  /** 商品ページのHTMLから仕様表の「JAN」を取り出す */
  function isbnFromItemHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const th of doc.querySelectorAll("th")) {
      if (th.textContent.trim() !== "JAN") continue;
      const value = th.nextElementSibling?.textContent.trim().replace(/[-\s]/g, "");
      if (value && ISBN_RE.test(value)) return value;
    }
    return null;
  }

  /** 商品ページを1件引く。一時的な失敗には1回だけリトライする */
  async function fetchIsbn(id) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await fetch(`/used/${id}`, { credentials: "include" });
      } catch (_e) {
        continue;
      }
      if (!res.ok) continue;
      return isbnFromItemHtml(await res.text());
    }
    return null;
  }

  async function collect(onProgress) {
    const items = setItems();
    const isbns = new Array(items.length).fill(null);
    let next = 0;
    let done = 0;

    // 取り出し口を共有したワーカーを数本走らせる。結果は添字で書き戻すので
    // 完了順に関わらずページの並び順が保たれる
    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        isbns[i] = await fetchIsbn(items[i].id);
        done += 1;
        onProgress(done);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker)
    );

    // ISBNを持たない巻は飛ばす。番号は詰めず、ページの巻数をそのまま使う
    return items
      .map((item, i) => ({ no: item.no, value: isbns[i] }))
      .filter((row) => row.value);
  }

  KAC.mount({
    tag: "bookoff",
    label: "ISBNをコピー",
    empty: "巻が見つかりません",
    detect: () => document.querySelectorAll(".productSetItem").length > 0,
    collect,
  });
})();
