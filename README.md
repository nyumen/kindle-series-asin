# シリーズの巻IDコピー（Chrome拡張）

シリーズの一覧ページで右下のボタンを押すと、所属巻のIDが通し番号付きで
クリップボードに入る。

| サイト | 対象ページ | 取るもの |
| --- | --- | --- |
| Amazon Kindle | シリーズページ | 巻のASIN |
| BOOK OFF | セット・まとめ買いページ | 巻のISBN |

```
1 B00AQ9IH8W
2 B00AQ9IHBO
3 B00AQ9IHB4
```

## 入れ方

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選ぶ

## 使い方

対象ページを開くと右下にボタンが出る。押すと全件そろうまで読み込み
（「読み込み中… 37件」と進捗が出る）、終わると「50件コピーしました」に変わる。

### Kindle

`https://www.amazon.co.jp/dp/{ASIN}?binding=kindle_edition`。巻ページから飛んだときの
`https://www.amazon.co.jp/kindle-dbs/product/{シリーズASIN}?...&ASIN={巻ASIN}` にも対応
（パス側のシリーズASINを使い、クエリの `ASIN=` は無視する）。

巻一覧はJS描画なのでDOMをスクロールして拾うのではなく、リスト自身が使っている
`/kindle-dbs/productPage/ajax/seriesAsinList` を10件ずつ最後まで引く。ログイン済みの
ブラウザから同一オリジンで叩くので、成人向けのブラックカーテンにも引っかからない。

- 予約中の巻も入る（まとめ買いカードの `data-offer-asins` には載らない）
- 「話」「巻」タブを持つ統合ページでは `volumeAsin` を対象にして話の混入を防ぐ
- AJAXが空だった場合のみ、ページ本体のリンクと `data-offer-asins` から拾う
- 番号は出現順の通し番号

収集ロジックはcomirecoの `app/amazon_scrape.py` の `fetch_series_page` /
`_fetch_series_ajax_asins` と揃えてある。片方を直したらもう片方も確認すること。

### BOOK OFF

`https://shopping.bookoff.co.jp/s/{セットID}`（例: 紺碧の艦隊なら `/s/8800024215`）。

セットページは巻一覧をサーバーレンダリングしており、在庫なしの巻も含めて
`.productSetItem` が並ぶ。ただしISBNはここには無く、各巻の商品ページ
`/used/{商品ID}` の仕様表に「JAN」として載っている（書籍のJANはISBN-13そのもの）。
そこで商品IDを拾ってから商品ページを1件ずつ引く。

- 在庫なしの巻も入る
- 商品ページは1件1秒以上かかるので3本だけ並列に引く（全21巻で約6秒）
- 番号はページに出ている巻数をそのまま使う（ISBNの無い巻を飛ばしても詰めない）

## ファイル

- `ui.js` — 右下のボタン、進捗表示、クリップボードへの書き込み（共通）
- `kindle.js` — Kindleの収集ロジック
- `bookoff.js` — BOOK OFFの収集ロジック
- `content.css` — ボタンの見た目
