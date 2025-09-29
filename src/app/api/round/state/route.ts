import { NextResponse } from 'next/server'
import { getCurrentState, isRunning } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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


