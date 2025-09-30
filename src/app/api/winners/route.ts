import { NextResponse } from 'next/server'
import { getRecentWinners } from '@/lib/supabase'

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
    
    return NextResponse.json({ winners: formatted })
  } catch (error) {
    console.error('[API] Error fetching winners:', error)
    return NextResponse.json({ winners: [] })
  }
}

