import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vital Flow — 医療・こころ・からだのAIスーパーアプリ',
    short_name: 'Vital Flow',
    description: 'AI問診・SOAPカルテ生成に加え、気分ジャーナル・呼吸瞑想・AI症状チェック・AIヘルスコーチ・カメラ姿勢トラッキングを1つに。医療×メンタル×フィジカルのセルフケア・スーパーアプリ。',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafbfc',
    theme_color: '#14b8a6',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon-120x120',
        sizes: '120x120',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon-152x152',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon-167x167',
        sizes: '167x167',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
