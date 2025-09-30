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

