import type { StorybookConfig } from '@storybook/nextjs-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import remarkGfm from 'remark-gfm';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    {
      name: "@storybook/addon-docs",
      options: {
        // MDXの表はGFMの記法なので、既定のままだとパイプ記号がそのまま出る
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    "@storybook/addon-onboarding"
  ],
  "framework": "@storybook/nextjs-vite",
  "staticDirs": [
    "../public"
  ],
  // アプリと同じ @/ エイリアスをStorybookでも解決する。
  // 無いとストーリーから @/lib/... を値として読めない。
  // 型だけのimportは消えるため気づきにくく、実際に長く壊れていた。
  // resolve.aliasは配列とオブジェクトの両方を取りうるので、両方を扱う
  viteFinal: async (config) => {
    const src = path.resolve(dirname, '../src');
    config.resolve = config.resolve ?? {};
    const alias = config.resolve.alias;
    if (Array.isArray(alias)) {
      alias.push({ find: /^@\//, replacement: `${src}/` });
    } else {
      config.resolve.alias = { ...(alias ?? {}), '@': src };
    }
    return config;
  },
};
export default config;