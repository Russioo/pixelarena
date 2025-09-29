import { NextResponse } from 'next/server'
import { getCurrentState } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const snapshot = getCurrentState()
    
    return NextResponse.json({
      success: true,
      running: snapshot.running,
      tick: snapshot.tick,
      holdersCount: snapshot.holders.length,
      pixelsCount: snapshot.pixels.length,
      snapshot
    })
  } catch (error) {
    console.error('Game status API error:', error)
    return NextResponse.json(
      { error: 'Failed to get game status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

