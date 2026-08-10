# Kindle シリーズASINコピー（Chrome拡張）

Kindleのシリーズページを開いて右下の「ASINをコピー」を押すと、所属巻のASINが
改行区切りでクリップボードに入る。comirecoの一括取り込み欄にそのまま貼れる。

## 入れ方

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」で `tools/kindle-asin-copy` を選ぶ

## 使い方

`https://www.amazon.co.jp/dp/{ASIN}?binding=kindle_edition` を開くと右下にボタンが出る。
巻ページから飛んだときの `https://www.amazon.co.jp/kindle-dbs/product/{シリーズASIN}?...&ASIN={巻ASIN}`
にも対応（パス側のシリーズASINを使い、クエリの `ASIN=` は無視する）。
押すと全件そろうまで読み込み（「読み込み中… 37件」と進捗が出る）、終わると
「50件コピーしました」に変わる。

## 仕組み

巻一覧はJS描画なのでDOMをスクロールして拾うのではなく、リスト自身が使っている
`/kindle-dbs/productPage/ajax/seriesAsinList` を10件ずつ最後まで引く。ログイン済みの
ブラウザから同一オリジンで叩くので、成人向けのブラックカーテンにも引っかからない。

- 予約中の巻も入る（まとめ買いカードの `data-offer-asins` には載らない）
- 「話」「巻」タブを持つ統合ページでは `volumeAsin` を対象にして話の混入を防ぐ
- AJAXが空だった場合のみ、ページ本体のリンクと `data-offer-asins` から拾う

収集ロジックは [app/amazon_scrape.py](../../app/amazon_scrape.py) の
`fetch_series_page` / `_fetch_series_ajax_asins` と揃えてある。片方を直したら
もう片方も確認すること。
