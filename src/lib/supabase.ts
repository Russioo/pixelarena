import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export interface WinnerRecord {
  id?: number
  round: number
  address: string
  fees: number
  tx_signature: string
  color: string
  pixels: number
  created_at?: string
}

export async function saveWinner(winner: WinnerRecord) {
  if (!supabase) {
    console.warn('[Supabase] Not configured, skipping save')
    return null
  }
  
  try {
    const { data, error } = await supabase
      .from('winners')
      .insert({
        round: winner.round,
        address: winner.address,
        fees: winner.fees,
        tx_signature: winner.tx_signature,
        color: winner.color,
        pixels: winner.pixels
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Supabase] Error saving winner:', error)
      return null
    }
    
    console.log('[Supabase] Winner saved:', data)
    return data
  } catch (err) {
    console.error('[Supabase] Exception saving winner:', err)
    return null
  }
}

export async function getRecentWinners(limit: number = 10): Promise<WinnerRecord[]> {
  if (!supabase) {
    console.warn('[Supabase] Not configured, returning empty array')
    return []
  }
  
  try {
    const { data, error } = await supabase
      .from('winners')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('[Supabase] Error fetching winners:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('[Supabase] Exception fetching winners:', err)
    return []
  }
}

