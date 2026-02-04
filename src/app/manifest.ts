import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Medical Scribe Flow - AI問診・カルテ自動生成',
    short_name: 'Medical Scribe',
    description: 'リアルタイム音声認識とSOAPカルテ自動生成 - 医療従事者向けAI問診記録システム',
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
        purpose: 'any maskable',
      },
    ],
  }
}
