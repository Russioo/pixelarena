import { NextResponse } from 'next/server'
import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import axios from 'axios'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const rpc = process.env.SOLANA_RPC_ENDPOINT || process.env.RPC_ENDPOINT || 'https://api.mainnet.solana.com'
    const portal = process.env.PUMPPORTAL_URL || 'https://pumpportal.fun/api/trade-local'
    // Understøt både vores navne og dine Python-navne
    const pubStr = process.env.CLAIMER_PUBLIC_KEY || process.env.PUBLIC_KEY
    const secStr = process.env.CLAIMER_SECRET_KEY_BASE58 || process.env.PRIVATE_KEY

    if (!pubStr || !secStr) {
      return NextResponse.json({ error: 'missing env: set CLAIMER_PUBLIC_KEY/CLAIMER_SECRET_KEY_BASE58 or PUBLIC_KEY/PRIVATE_KEY in .env.local' }, { status: 500 })
    }

    const connection = new Connection(rpc, 'confirmed')
    const pubkey = new PublicKey(pubStr)
    const keypair = Keypair.fromSecretKey(bs58.decode(secStr))

    // Helper: robust getBalance med fallback til JSON-RPC hvis web3 fetch fejler
    const robustGetBalance = async (account: PublicKey): Promise<number> => {
      try {
        return await connection.getBalance(account, 'confirmed')
      } catch (err) {
        try {
          const payload = { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [account.toBase58(), { commitment: 'confirmed' }] }
          const { data } = await axios.post(rpc, payload, { timeout: 10000, headers: { 'Content-Type': 'application/json' } })
          if (data && data.result && typeof data.result.value === 'number') return data.result.value
          throw new Error('RPC getBalance (axios) invalid response')
        } catch (inner) {
          // Sidste forsøg: processed commitment
          try {
            const payload2 = { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [account.toBase58(), { commitment: 'processed' }] }
            const { data: data2 } = await axios.post(rpc, payload2, { timeout: 10000, headers: { 'Content-Type': 'application/json' } })
            if (data2 && data2.result && typeof data2.result.value === 'number') return data2.result.value
          } catch {}
          throw new Error(`failed to get balance of account ${account.toBase58()}: ${String((inner as Error)?.message || inner)}`)
        }
      }
    }

    // Balance før claim (robust)
    const beforeLamports = await robustGetBalance(pubkey)

    // Hent prebuildet tx fra PumpPortal (samme semantik som python: form POST)
    const form = new URLSearchParams()
    form.set('publicKey', pubkey.toBase58())
    form.set('action', 'collectCreatorFee')
    form.set('priorityFee', '0.000001')

    const resp = await fetch(portal, {
      method: 'POST',
      body: form
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return NextResponse.json({ error: `pumpportal ${resp.status}`, details: text || 'no body' }, { status: 500 })
    }

    // Forsøg at parse både raw-bytes og evt. JSON-b64
    let buf: Buffer | null = null
    const ct = resp.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const j = await resp.json().catch(() => null as any)
      if (!j) return NextResponse.json({ error: 'invalid json from pumpportal' }, { status: 500 })
      const base64 = j.transaction || j.tx || j.base64 || j.swapTransaction
      if (!base64 || typeof base64 !== 'string') {
        return NextResponse.json({ error: 'missing transaction in pumpportal json', body: j }, { status: 500 })
      }
      buf = Buffer.from(base64, 'base64')
    } else {
      // antag raw bytes
      const ab = await resp.arrayBuffer()
      buf = Buffer.from(ab)
    }

    const tx = VersionedTransaction.deserialize(buf)
    tx.sign([keypair])

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    })
    await connection.confirmTransaction(signature, 'confirmed')

    // Balance efter claim (robust) – poll som i python (de venter ~15s)
    let afterLamports = await robustGetBalance(pubkey)
    let attempts = 0
    const maxAttempts = 10 // ~20s ved 2s interval
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000))
      const val = await robustGetBalance(pubkey)
      afterLamports = val
      // Break tidligt hvis ændring registreres (kan også være negativ pga. fees; vi håndterer nedenfor)
      if (afterLamports !== beforeLamports) break
      attempts++
    }
    const diffLamports = Math.max(0, afterLamports - beforeLamports)
    const payoutLamports = Math.floor(diffLamports * 0.3) // 30% til vinder

    return NextResponse.json({
      signature,
      claimedLamports: diffLamports,
      payoutLamports,
      claimedSOL: diffLamports / 1e9,
      payoutSOL: payoutLamports / 1e9
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'claim failed' }, { status: 500 })
  }
}


