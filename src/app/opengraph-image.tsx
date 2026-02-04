import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'
export const runtime = 'edge'

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fafbfc 0%, #f3f5f7 100%)',
          position: 'relative',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.1,
            background: 'radial-gradient(circle at 20% 50%, #14b8a6 0%, transparent 50%), radial-gradient(circle at 80% 80%, #3b82f6 0%, transparent 50%)',
          }}
        />

        {/* Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
            marginBottom: 32,
            boxShadow: '0 10px 40px rgba(20, 184, 166, 0.3)',
          }}
        >
          <svg
            width="70"
            height="70"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}
        >
          Medical Voice Scribe
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            color: '#475569',
            fontFamily: 'monospace',
          }}
        >
          AI音声問診・カルテ自動生成
        </div>

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            marginTop: 48,
            padding: '12px 24px',
            background: '#14b8a6',
            color: 'white',
            borderRadius: 8,
            fontSize: 24,
            fontWeight: 600,
          }}
        >
          リアルタイム音声認識 × AI
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
