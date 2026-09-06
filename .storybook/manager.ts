import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// サイドバー左上のブランドを、本体アプリへの導線にする。
// Storybookには外部リンクを置く場所が他に無いので、ここが唯一の戻り口になる。
// URLはビルド時の環境変数で上書きできる(src/lib/siteLinks.tsと対になる値)。
const APP_URL = process.env.STORYBOOK_APP_URL ?? "https://medical-voice-scribe.vercel.app";

addons.setConfig({
  theme: create({
    base: "dark",
    brandTitle: "Vital Flowデザインシステム",
    brandUrl: APP_URL,
    brandTarget: "_self",
    colorPrimary: "#14b8a6",
    colorSecondary: "#14b8a6",
  }),
});
