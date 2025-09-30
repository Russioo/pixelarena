import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import {
  addClient,
  getCurrentState,
  isRunning,
  startServerFlow,
  setOnWinner
} from '../src/server/gameEngine'
import { fetchHolders } from './fetchHolders'
import { saveWinner } from '../src/lib/supabase'

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
            fees: 0, // Will be updated when we have real fees
            tx_signature: 'pending', // Will be updated with real tx
            color: winner.color,
            pixels: winner.pixels
          })
          .then(result => {
            console.log('[Engine] ✅ Winner saved successfully to database:', result)
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


