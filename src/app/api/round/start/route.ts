import { NextResponse } from 'next/server'
import { startServerFlow, isRunning, getCurrentState } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
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


