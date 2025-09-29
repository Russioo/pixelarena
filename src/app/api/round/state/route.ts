import { NextResponse } from 'next/server'
import { getCurrentState, isRunning } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ENGINE_URL = process.env.ENGINE_URL
    if (ENGINE_URL) {
      const url = ENGINE_URL.replace(/\/$/, '') + '/api/round/state'
      const resp = await fetch(url, { cache: 'no-store' })
      if (!resp.ok) return NextResponse.json({ error: 'engine upstream error' }, { status: 502 })
      const json = await resp.json()
      return NextResponse.json(json)
    }
    const s = getCurrentState()
    return NextResponse.json({
      running: isRunning(),
      tick: s.tick,
      width: s.width,
      height: s.height,
      startMs: s.startMs,
      roundId: s.roundId,
      phase: s.phase,
      nextRoundAt: s.nextRoundAt,
      winnerIndex: s.winnerIndex,
      holders: s.holders?.length ? s.holders : undefined,
      feesPoolLamports: (s as any).feesPoolLamports
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed to get state' }, { status: 500 })
  }
}


