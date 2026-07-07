import { NextRequest, NextResponse } from 'next/server'

// Server-side geolocation — contorna a restrição de HTTPS do browser
// O browser envia o IP real do celular, o servidor faz a consulta HTTPS
export async function GET(request: NextRequest) {
  // Pega o IP real do cliente (celular), respeitando proxies
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP    = forwarded ? forwarded.split(',')[0].trim()
                  : request.headers.get('x-real-ip') ?? '0.0.0.0'

  // IPs locais/privados não têm geolocalização
  const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1$)/.test(realIP)
  if (isPrivate) {
    return NextResponse.json({
      success: false,
      error: 'Rede local detectada. Use a busca manual por cidade.',
      ip: realIP,
      isPrivate: true,
    })
  }

  // Estratégia 1: ipapi.co (gratuito, 1000 req/dia)
  try {
    const res  = await fetch(`https://ipapi.co/${realIP}/json/`, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'PalinMartinsCRM/1.0' },
    })
    const data = await res.json() as {
      city?: string; region?: string; country_name?: string
      latitude?: number; longitude?: number; error?: boolean
    }

    if (!data.error && data.city) {
      return NextResponse.json({
        success: true,
        city: data.city,
        region: data.region ?? null,
        lat: data.latitude ?? null,
        lon: data.longitude ?? null,
        ip: realIP,
        source: 'ipapi',
      })
    }
  } catch { /* fallback */ }

  // Estratégia 2: ip-api.com (gratuito, 45 req/min)
  try {
    const res  = await fetch(
      `http://ip-api.com/json/${realIP}?lang=pt-BR&fields=status,city,regionName,lat,lon`,
      { signal: AbortSignal.timeout(6000) }
    )
    const data = await res.json() as {
      status?: string; city?: string; regionName?: string; lat?: number; lon?: number
    }

    if (data.status === 'success' && data.city) {
      return NextResponse.json({
        success: true,
        city: data.city,
        region: data.regionName ?? null,
        lat: data.lat ?? null,
        lon: data.lon ?? null,
        ip: realIP,
        source: 'ip-api',
      })
    }
  } catch { /* continua */ }

  return NextResponse.json({
    success: false,
    error: 'Não foi possível detectar a cidade. Use a busca manual.',
    ip: realIP,
  })
}
