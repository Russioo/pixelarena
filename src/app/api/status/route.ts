import { NextResponse } from 'next/server'
import { getCurrentState } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const snapshot = getCurrentState()
    
    // Check if game is running by looking at tick count and holders
    const isRunning = snapshot.holders.length > 0 && snapshot.tick >= 0
    
    return NextResponse.json({
      success: true,
      isRunning,
      tick: snapshot.tick,
      holdersCount: snapshot.holders.length,
      pixelsCount: snapshot.pixels.length,
      snapshot
    })
  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json(
      { error: 'Failed to get status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
