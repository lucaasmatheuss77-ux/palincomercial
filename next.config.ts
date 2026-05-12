import type { NextConfig } from 'next'

const LAN_IP = '192.168.0.245'
const DEV_PORT = '80'

const nextConfig: NextConfig = {
  // Permitir acesso de outros dispositivos na rede local (celular, tablet)
  allowedDevOrigins: [
    `${LAN_IP}:${DEV_PORT}`,
    `${LAN_IP}`,
    `localhost:${DEV_PORT}`,
    'localhost',
  ],
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'

    // connect-src: em dev inclui WS do LAN para HMR e Supabase realtime
    const connectSrc = [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.openai.com',
      'https://brasilapi.com.br',
      'https://nominatim.openstreetmap.org',
      ...(isDev ? [
        `ws://${LAN_IP}:${DEV_PORT}`,
        `http://${LAN_IP}:${DEV_PORT}`,
        'ws://localhost:*',
      ] : []),
    ].join(' ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Microfone permitido para gravação de voz no mobile
          { key: 'Permissions-Policy', value: 'camera=(), microphone=*, geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // media-src necessário para gravação e playback de áudio via MediaRecorder/Blob
              "media-src 'self' blob:",
              `connect-src ${connectSrc}`,
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
