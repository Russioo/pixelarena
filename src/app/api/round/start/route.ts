import { NextResponse } from 'next/server'
import { startServerFlow, isRunning, getCurrentState } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const ENGINE_URL = process.env.ENGINE_URL
    if (ENGINE_URL) {
      const url = ENGINE_URL.replace(/\/$/, '') + '/api/round/start'
      const resp = await fetch(url, { method: 'POST', cache: 'no-store' })
      if (!resp.ok) return NextResponse.json({ error: 'engine upstream error' }, { status: 502 })
      const json = await resp.json()
      return NextResponse.json(json)
    }
    const s = getCurrentState()
    // Start kun hvis serveren er idle. Hvis vi er i claim/snapshot/starting/running/winner, gør ingenting.
    if (s.phase && s.phase !== 'idle') {
      return NextResponse.json({ ok: true, alreadyInProgress: true, phase: s.phase })
    }
    if (isRunning()) return NextResponse.json({ ok: true, alreadyRunning: true })
    // Start fuldt serverstyret fase-flow (claim -> snapshot -> starting -> running)
    startServerFlow()
    return NextResponse.json({ ok: true, started: true, serverFlow: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed to start round' }, { status: 500 })
  }
}


