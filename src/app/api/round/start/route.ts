import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const ENGINE_URL = process.env.ENGINE_URL
    
    // ENGINE_URL er PÅKRÆVET - ingen fallback!
    if (!ENGINE_URL) {
      return NextResponse.json({ 
        error: 'ENGINE_URL mangler',
        message: 'Venter på Docker server... ENGINE_URL skal være sat i environment variables.',
        status: 'waiting'
      }, { status: 503 })
    }

    // Start round på Docker serveren
    const url = ENGINE_URL.replace(/\/$/, '') + '/api/round/start'
    const resp = await fetch(url, { method: 'POST', cache: 'no-store' })
    
    if (!resp.ok) {
      return NextResponse.json({ 
        error: 'Engine unavailable',
        message: 'Docker serveren svarede ikke korrekt.',
        engineUrl: ENGINE_URL
      }, { status: 502 })
    }
    
    const json = await resp.json()
    return NextResponse.json(json)
  } catch (e: any) {
    return NextResponse.json({ 
      error: 'Connection failed',
      message: 'Kunne ikke forbinde til Docker serveren.',
      details: e?.message || 'Unknown error'
    }, { status: 500 })
  }
}


