// サイト別の収集スクリプトが共通で使う、右下のフローティングボタン。
// 収集ロジックは kindle.js / bookoff.js 側にあり、ここはUIとコピーだけを持つ。
globalThis.KAC = (() => {
  "use strict";

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_e) {
      // 権限やフォーカスで弾かれた場合の保険
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("clipboard write failed");
  }

  /**
   * ボタンを出す。
   *
   * @param {object} spec
   * @param {string} spec.tag     ログに出す識別子
   * @param {string} spec.label   ボタンの文言
   * @param {string} spec.empty   1件も取れなかったときの文言
   * @param {() => boolean} spec.detect   このページに出してよいか
   * @param {(onProgress: (n: number) => void) => Promise<Array<{no: string|number, value: string}>>}
   *        spec.collect  収集本体。番号つきの行を出現順で返す
   * @param {number} [spec.watchMs]  遅延描画を待つ時間（既定10秒）
   */
  function mount(spec) {
    const place = () => {
      if (document.getElementById("kac-button") || !spec.detect()) return;

      const btn = document.createElement("button");
      btn.id = "kac-button";
      btn.type = "button";
      btn.textContent = spec.label;
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.className = "";
        btn.textContent = "読み込み中…";
        try {
          const rows = await spec.collect((n) => {
            btn.textContent = `読み込み中… ${n}件`;
          });
          if (!rows.length) {
            btn.className = "kac-error";
            btn.textContent = spec.empty;
          } else {
            await copyText(rows.map((r) => `${r.no} ${r.value}`).join("\n"));
            btn.className = "kac-done";
            btn.textContent = `${rows.length}件コピーしました`;
          }
        } catch (e) {
          btn.className = "kac-error";
          btn.textContent = "失敗（コンソール参照）";
          console.error(`[${spec.tag}]`, e);
        } finally {
          btn.disabled = false;
          setTimeout(() => {
            btn.className = "";
            btn.textContent = spec.label;
          }, 4000);
        }
      });
      document.body.appendChild(btn);
    };

    place();
    // 一覧が遅延描画されるページ用に、出てくるまで少し粘る
    const observer = new MutationObserver(place);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), spec.watchMs ?? 10000);
  }

  return { mount, copyText };
})();
