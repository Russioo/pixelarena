import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import * as path from 'path'
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import bs58 from 'bs58'
import axios from 'axios'
import {
  addClient,
  getCurrentState,
  isRunning,
  startServerFlow,
  setOnWinner
} from '../src/server/gameEngine'
import { fetchHolders } from './fetchHolders'
import { saveWinner, getLatestPendingWinner, updateWinnerPayout } from '../src/lib/supabase'

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080
const app = express()
app.use(cors())

async function startWithRealHolders() {
  try {
    const holders = await fetchHolders()
    console.log(`[Engine] ✅ Starting server flow with ${holders.length} real holders`)
    startServerFlow({ holders })
  } catch (error) {
    console.error('[Engine] ❌ Failed to fetch holders - MINT_ADDRESS mangler eller RPC fejl:', error)
    console.error('[Engine] ❌ Spillet starter IKKE. Tilføj MINT_ADDRESS i .env')
    // Spillet starter IKKE uden rigtige holders
  }
}

function boot() {
  try {
    setOnWinner((winnerIndex) => {
      try {
        // Save winner to Supabase
        const s = getCurrentState()
        console.log('[Engine] Winner callback triggered for index:', winnerIndex)
        console.log('[Engine] Current state:', { roundId: s.roundId, holdersCount: s.holders?.length })
        
        if (s.holders && s.holders[winnerIndex]) {
          const winner = s.holders[winnerIndex]
          console.log('[Engine] Saving winner to database:', { 
            round: s.roundId, 
            address: winner.address, 
            color: winner.color, 
            pixels: winner.pixels 
          })
          
          saveWinner({
            round: s.roundId,
            address: winner.address,
            fees: 0, // Will be updated during claim phase of next round
            tx_signature: 'pending', // Will be updated during claim phase
            color: winner.color,
            pixels: winner.pixels
          })
          .then(result => {
            console.log('[Engine] ✅ Winner saved successfully to database (pending payout):', result)
            console.log('[Engine] 💰 Winner will receive 30% of fees in next round claim phase')
          })
          .catch(err => {
            console.error('[Engine] ❌ Failed to save winner to database:', err)
            console.error('[Engine] DATABASE_URL configured:', !!process.env.DATABASE_URL)
          })
        } else {
          console.error('[Engine] ❌ Winner holder not found at index:', winnerIndex)
        }
        
        // Start next round
        setTimeout(() => startWithRealHolders(), 1000)
      } catch (e) {
        console.error('[Engine] Exception in winner callback:', e)
      }
    })
  } catch (e) {
    console.error('[Engine] Failed to setup winner callback:', e)
  }
  
  try {
    const s = getCurrentState()
    if (!isRunning() && s.phase === 'idle') {
      console.log('[Engine] Starting initial round...')
      startWithRealHolders()
    }
  } catch (e) {
    console.error('[Engine] Failed to start initial round:', e)
  }
}

boot()

// Kør Python claim script (samme som i Next API)
async function runPythonClaim(): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'claim_creator_fees.py')
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    const python = spawn(pythonCmd, [pythonScript])

    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('[Python]', output)
      stdout += output
    })

    python.stderr.on('data', (data) => {
      const error = data.toString()
      console.error('[Python Error]', error)
      stderr += error
    })

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`))
        return
      }
      const jsonMatch = stdout.match(/JSON_RESULT:(.+)/)
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[1])
          resolve(result)
        } catch (e) {
          reject(new Error('Failed to parse Python JSON output'))
        }
      } else {
        reject(new Error('No JSON result found in Python output'))
      }
    })
  })
}

// Engine-intern claim endpoint, så vi undgår Vercel
app.post('/api/claim', async (_req, res) => {
  try {
    const rpc = process.env.SOLANA_RPC_ENDPOINT || process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
    const pubStr = process.env.CLAIMER_PUBLIC_KEY || process.env.PUBLIC_KEY
    const secStr = process.env.CLAIMER_SECRET_KEY_BASE58 || process.env.PRIVATE_KEY

    if (!pubStr || !secStr) {
      return res.status(500).json({ error: 'missing env: set CLAIMER_PUBLIC_KEY/CLAIMER_SECRET_KEY_BASE58 or PUBLIC_KEY/PRIVATE_KEY in environment' })
    }

    console.log('[EngineClaim] ============================================================')
    console.log('[EngineClaim] BRUGER PYTHON SCRIPT TIL AT CLAIME FEES')
    console.log('[EngineClaim] ============================================================')

    const pythonResult = await runPythonClaim()
    if (!pythonResult?.success) {
      return res.status(500).json({ error: pythonResult?.error || 'python claim failed' })
    }

    const connection = new Connection(rpc, 'confirmed')
    const pubkey = new PublicKey(pubStr)
    const keypair = Keypair.fromSecretKey(bs58.decode(secStr))

    const signature: string = pythonResult.signature
    const diffLamports: number = Number(pythonResult.claimed_lamports || 0)

    console.log('[EngineClaim] ✅ Python script har claimet:', pythonResult.claimed_sol, 'SOL')
    console.log('[EngineClaim] Signature:', signature)
    console.log('[EngineClaim] Solscan:', `https://solscan.io/tx/${signature}`)

    // Vent lidt så balance er opdateret (kortere end Python som allerede ventede)
    await new Promise(r => setTimeout(r, 3000))

    const payoutLamports = Math.floor(diffLamports * 0.3)
    const winner = await getLatestPendingWinner()

    let payoutSignature: string | null = null
    let actualPayoutSent = 0

    if (winner && payoutLamports > 0) {
      console.log(`[EngineClaim] Sender ${payoutLamports / 1e9} SOL (30% af ${diffLamports / 1e9} SOL) til vinder: ${winner.address}`)
      try {
        const currentBalance = await connection.getBalance(pubkey, 'confirmed')
        const txFeeReserve = 10000
        const maxPayoutPossible = Math.max(0, currentBalance - txFeeReserve)
        const actualPayoutLamports = Math.min(payoutLamports, maxPayoutPossible)
        if (actualPayoutLamports <= 0) {
          console.log(`[EngineClaim] Ikke nok balance til payout. Springer over.`)
        } else {
          const recipientPubkey = new PublicKey(winner.address)
          const { blockhash } = await connection.getLatestBlockhash('confirmed')
          const transferInstruction = SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: recipientPubkey,
            lamports: actualPayoutLamports
          })
          const tx = new Transaction().add(transferInstruction)
          tx.recentBlockhash = blockhash
          tx.feePayer = keypair.publicKey
          tx.sign(keypair)
          payoutSignature = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
          })
          await connection.confirmTransaction(payoutSignature, 'confirmed')
          console.log(`[EngineClaim] ✅ Payout sendt! Signature: ${payoutSignature}`)
          actualPayoutSent = actualPayoutLamports
          await updateWinnerPayout(winner.id!, actualPayoutLamports / 1e9, payoutSignature)
        }
      } catch (payoutError: any) {
        console.error('[EngineClaim] Fejl ved payout:', payoutError?.message || payoutError)
      }
    } else {
      if (!winner) console.log('[EngineClaim] Ingen pending vinder fundet - skipper payout')
      if (payoutLamports === 0) console.log('[EngineClaim] Ingen fees claimet - skipper payout')
    }

    return res.json({
      signature,
      claimedLamports: diffLamports,
      payoutLamports: actualPayoutSent,
      claimedSOL: diffLamports / 1e9,
      payoutSOL: actualPayoutSent / 1e9,
      payoutSignature,
      winnerAddress: winner?.address || null
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'engine claim failed' })
  }
})

app.get('/api/round/state', (_req, res) => {
  try {
    const s = getCurrentState()
    res.json({
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
    res.status(500).json({ error: e?.message || 'failed to get state' })
  }
})

app.get('/api/round/ensure', async (_req, res) => {
  try {
    boot()
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed to ensure round' })
  }
})

app.post('/api/round/start', async (_req, res) => {
  try {
    const s = getCurrentState()
    if (s.phase && s.phase !== 'idle') {
      return res.json({ ok: true, alreadyInProgress: true, phase: s.phase })
    }
    if (isRunning()) return res.json({ ok: true, alreadyRunning: true })
    await startWithRealHolders()
    res.json({ ok: true, started: true, serverFlow: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed to start round' })
  }
})

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')

  try {
    const s = getCurrentState()
    if (s.phase === 'running') {
      const initial = {
        type: 'snapshot',
        tick: s.tick,
        startMs: s.startMs,
        roundId: s.roundId,
        pixels: s.pixels,
        holders: s.holders
      }
      res.write(`data: ${JSON.stringify(initial)}\n\n`)
    } else if (s.phase === 'winner' && typeof s.winnerIndex === 'number') {
      const initial = {
        type: 'winner',
        winnerIndex: s.winnerIndex,
        nextRoundAt: s.nextRoundAt,
        holders: s.holders
      }
      res.write(`data: ${JSON.stringify(initial)}\n\n`)
    } else if (s.phase === 'claim' || s.phase === 'snapshot' || s.phase === 'starting') {
      const initial: any = {
        type: 'phase',
        phase: s.phase,
        endsAt: s.nextPhaseAt,
        feesPoolLamports: (s as any).feesPoolLamports
      }
      if (s.phase === 'snapshot' && Array.isArray(s.holders)) initial.holders = s.holders
      res.write(`data: ${JSON.stringify(initial)}\n\n`)
    }
  } catch {}

  const remove = addClient((chunk) => {
    try {
      res.write(Buffer.from(chunk))
    } catch {}
  })

  res.write('retry: 1000\n\n')

  const onClose = () => {
    try {
      remove()
    } catch {}
  }
  req.on('close', onClose)
  req.on('end', onClose)
  res.on('close', onClose)
  res.on('finish', onClose)
  res.on('error', onClose)
})

app.listen(PORT, () => {
  console.log(`Engine listening on :${PORT}`)
})


