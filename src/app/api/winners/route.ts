import { NextResponse } from 'next/server'
import { getRecentWinners } from '@/lib/supabase'

// Force dynamic - no caching for live data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const winners = await getRecentWinners(10)
    
    // Convert to frontend format
    const formatted = winners.map(w => ({
      round: w.round,
      address: w.address,
      fees: w.fees,
      txSignature: w.tx_signature,
      color: w.color,
      pixels: w.pixels
    }))
    
    console.log('[API /winners] Returning', formatted.length, 'winners from database')
    
    // Return with no-cache headers for live data
    return NextResponse.json(
      { winners: formatted },
      { 
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache'
        }
      }
    )
  } catch (error) {
    console.error('[API] Error fetching winners:', error)
    return NextResponse.json({ winners: [] })
  }
}

