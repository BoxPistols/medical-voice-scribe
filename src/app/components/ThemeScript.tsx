import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * 保存済みのテーマを、描画される前にhtmlへ反映する。
 *
 * これが無いと/videoのようにテーマ切替UIを持たないルートでdata-themeが付かず、
 * 常に明色で表示される。アプリ本体のページだけがテーマを適用していたため、
 * トークン化した瞬間に他のルートの見え方が変わってしまった。
 *
 * 描画前に実行する必要があるので、Reactの副作用ではなくインラインスクリプトで置く。
 * 遅らせると明色で一瞬描画されてから暗色に変わる。
 */
export function ThemeScript() {
  const code = `(function(){try{
    var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"system";
    var dark = t==="dark" || (t==="system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if(dark) document.documentElement.setAttribute("data-theme","dark");
    else document.documentElement.removeAttribute("data-theme");
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
