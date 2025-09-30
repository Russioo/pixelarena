import { Pool, Client } from 'pg'

const databaseUrl = process.env.DATABASE_URL || ''

let db: { query: (text: string, params?: any[]) => Promise<any> } | null = null
if (databaseUrl) {
  try {
    const host = new URL(databaseUrl).host
    const isPooler = host.includes('-pooler.')
    if (isPooler) {
      const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
      // Establish one shared connection when using Neon pooler endpoint
      client.connect().catch((err: unknown) => console.error('[DB] Client connect error:', err))
      db = client
    } else {
      db = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
    }
  } catch (e) {
    console.error('[DB] Invalid DATABASE_URL:', e)
  }
}

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
  if (!db) {
    console.warn('[DB] Not configured, skipping save')
    return null
  }
  
  try {
    const insertSql = `
      INSERT INTO winners (round, address, fees, tx_signature, color, pixels)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, round, address, fees, tx_signature, color, pixels, created_at
    `
    const values = [
      winner.round,
      winner.address,
      winner.fees,
      winner.tx_signature,
      winner.color,
      winner.pixels
    ]
    const result = await db.query(insertSql, values)
    const row = result.rows[0]
    console.log('[DB] Winner saved:', row)
    return row
  } catch (err: unknown) {
    console.error('[DB] Exception saving winner:', err)
    return null
  }
}

export async function getRecentWinners(limit: number = 10): Promise<WinnerRecord[]> {
  if (!db) {
    console.warn('[DB] Not configured, returning empty array')
    return []
  }
  
  try {
    const selectSql = `
      SELECT id, round, address, fees::float8 AS fees, tx_signature, color, pixels, created_at
      FROM winners
      ORDER BY created_at DESC
      LIMIT $1
    `
    const result = await db.query(selectSql, [limit])
    return result.rows as WinnerRecord[]
  } catch (err: unknown) {
    console.error('[DB] Exception fetching winners:', err)
    return []
  }
}

export async function getLatestPendingWinner(): Promise<WinnerRecord | null> {
  if (!db) {
    console.warn('[DB] Not configured, returning null')
    return null
  }
  
  try {
    const selectSql = `
      SELECT id, round, address, fees::float8 AS fees, tx_signature, color, pixels, created_at
      FROM winners
      WHERE tx_signature = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `
    const result = await db.query(selectSql, [])
    if (result.rows.length === 0) return null
    return result.rows[0] as WinnerRecord
  } catch (err: unknown) {
    console.error('[DB] Exception fetching pending winner:', err)
    return null
  }
}

export async function updateWinnerPayout(winnerId: number, fees: number, txSignature: string) {
  if (!db) {
    console.warn('[DB] Not configured, skipping update')
    return null
  }
  
  try {
    const updateSql = `
      UPDATE winners
      SET fees = $1, tx_signature = $2
      WHERE id = $3
      RETURNING id, round, address, fees, tx_signature, color, pixels, created_at
    `
    const result = await db.query(updateSql, [fees, txSignature, winnerId])
    if (result.rows.length === 0) return null
    console.log('[DB] Winner payout updated:', result.rows[0])
    return result.rows[0]
  } catch (err: unknown) {
    console.error('[DB] Exception updating winner payout:', err)
    return null
  }
}

