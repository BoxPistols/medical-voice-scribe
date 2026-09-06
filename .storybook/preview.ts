import type { Preview } from '@storybook/nextjs-vite'
import '../src/app/globals.css'

// テーマはツールバーで切り替える。アプリと同じくhtmlのdata-themeを見るので、
// どのストーリーも明色と暗色の両方をその場で確認できる。
const applyTheme = (theme: string) => {
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  // Storybookの描画領域はbody側にあるため、地の色も合わせる
  document.body.style.background = 'var(--bg-primary)'
  document.body.style.color = 'var(--text-primary)'
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'テーマ',
      toolbar: {
        title: 'テーマ',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: '明色' },
          { value: 'dark', icon: 'moon', title: '暗色' },
        ],
        dynamicTitle: true,
      },
    },
  },

  initialGlobals: {
    theme: 'light',
  },

  decorators: [
    (Story, context) => {
      applyTheme(context.globals.theme)
      return Story()
    },
  ],

  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;
