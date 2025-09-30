// Simple server-side game engine with deterministic RNG and SSE broadcast

export interface Holder {
  address: string
  balance: number
  percentage: number
  pixels: number
  color: string
}

export interface Pixel {
  index: number
  owner: number | null
  position: { x: number; y: number }
  color: string
}

type Client = {
  enqueue: (chunk: Uint8Array) => void
  id: number
}

interface EngineState {
  running: boolean
  width: number
  height: number
  totalPixels: number
  pixels: Pixel[]
  holders: Holder[]
  neighbors: number[][]
  fightsPerTick: number
  rngState: number
  tick: number
  interval: NodeJS.Timeout | null
  onWinner?: (winnerIndex: number) => void
  startMs: number
  roundId: number
  phase: 'idle' | 'claim' | 'snapshot' | 'starting' | 'running' | 'winner'
  nextRoundAt: number
  winnerIndex?: number | null
  nextPhaseAt: number
  phaseTimeout: NodeJS.Timeout | null
  feesPoolLamports: number
}

const encoder = new TextEncoder()

let state: EngineState = {
  running: false,
  width: 50,
  height: 50,
  totalPixels: 2500,
  pixels: [],
  holders: [],
  neighbors: [],
  fightsPerTick: Math.max(200, Number(process.env.FIGHTS_PER_TICK || 1200)),
  rngState: 12345,
  tick: 0,
  interval: null,
  startMs: 0,
  roundId: 0,
  phase: 'idle',
  nextRoundAt: 0,
  winnerIndex: null,
  nextPhaseAt: 0,
  phaseTimeout: null,
  feesPoolLamports: 0
}

const clients = new Map<number, Client>()
let nextClientId = 1

function rand(): number {
  // LCG deterministic RNG
  let s = state.rngState
  s = (s * 9301 + 49297) % 233280
  state.rngState = s
  return s / 233280
}

function buildNeighbors(width: number, height: number): number[][] {
  const total = width * height
  const nbs: number[][] = Array.from({ length: total }, () => [])
  for (let idx = 0; idx < total; idx++) {
    const x = idx % width
    const y = Math.floor(idx / width)
    if (x > 0) nbs[idx].push(idx - 1)
    if (x < width - 1) nbs[idx].push(idx + 1)
    if (y > 0) nbs[idx].push(idx - width)
    if (y < height - 1) nbs[idx].push(idx + width)
  }
  return nbs
}

function distributePixelsDeterministic(): void {
  const total = state.width * state.height
  const pixels: Pixel[] = Array.from({ length: total }, (_, i) => ({
    index: i,
    owner: null,
    position: { x: i % state.width, y: Math.floor(i / state.width) },
    color: '#333'
  }))

  // Build and shuffle indices deterministically
  const indices: number[] = Array.from({ length: total }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = indices[i]
    indices[i] = indices[j]
    indices[j] = tmp
  }

  const desiredCounts = state.holders.map(h => Math.max(0, Math.floor(h.pixels)))
  let sum = desiredCounts.reduce((a, b) => a + b, 0)
  let remaining = total - sum
  let k = 0
  while (remaining > 0 && desiredCounts.length > 0) {
    desiredCounts[k % desiredCounts.length]++
    k++
    remaining--
  }

  let cursor = 0
  for (let holderIndex = 0; holderIndex < state.holders.length; holderIndex++) {
    const count = Math.min(desiredCounts[holderIndex] || 0, indices.length - cursor)
    const color = state.holders[holderIndex].color
    for (let c = 0; c < count; c++) {
      const pixIdx = indices[cursor++]
      pixels[pixIdx].owner = holderIndex
      pixels[pixIdx].color = color
    }
    if (cursor >= indices.length) break
  }

  state.pixels = pixels
}

function tickOnce(): void {
  if (!state.running) return
  const total = state.pixels.length
  if (total <= 0) return

  for (let r = 0; r < state.fightsPerTick; r++) {
    const aIndex = Math.min(total - 1, Math.max(0, Math.floor(rand() * total)))
    const aOwner = state.pixels[aIndex].owner
    if (aOwner === null) continue
    const neighbors = state.neighbors[aIndex]
    if (!neighbors || neighbors.length === 0) continue
    const pick = Math.min(neighbors.length - 1, Math.max(0, Math.floor(rand() * neighbors.length)))
    const bIndex = neighbors[pick]
    if (typeof bIndex !== 'number' || bIndex < 0 || bIndex >= total) continue
    const bOwner = state.pixels[bIndex].owner
    if (bOwner === null || bOwner === aOwner) continue

    const holderA = state.holders[aOwner]
    const holderB = state.holders[bOwner]
    const probA = 0.5
    if (rand() < probA) {
      state.pixels[bIndex].owner = aOwner
      state.pixels[bIndex].color = holderA.color
    } else {
      state.pixels[aIndex].owner = bOwner
      state.pixels[aIndex].color = holderB.color
    }
  }

  state.tick++

  // Broadcast snapshot (throttled)
  // Reduce frequency to lower bandwidth usage (every 8 ticks)
  if (state.tick % 8 === 0) {
    broadcast({ type: 'snapshot', tick: state.tick, startMs: state.startMs, roundId: state.roundId, pixels: state.pixels, holders: state.holders })
  }

  // Winner check: ONE player must own ALL pixels
  const counts: Record<number, number> = {}
  for (let i = 0; i < state.pixels.length; i++) {
    const o = state.pixels[i].owner
    if (o !== null) counts[o] = (counts[o] || 0) + 1
  }
  const owners = Object.keys(counts)
  // Check if exactly ONE owner AND they own ALL pixels
  if (owners.length === 1) {
    const winnerIndex = parseInt(owners[0])
    const winnerPixelCount = counts[winnerIndex]
    
    // CRITICAL: Winner must own ALL pixels (100% of battlefield)
    if (winnerPixelCount === state.pixels.length) {
      console.log(`[GameEngine] WINNER DETECTED! Player ${winnerIndex} owns all ${winnerPixelCount}/${state.pixels.length} pixels`)
      state.winnerIndex = winnerIndex
      state.phase = 'winner'
      state.running = false
      state.nextRoundAt = Date.now() + 10000
      broadcast({ type: 'winner', winnerIndex, nextRoundAt: state.nextRoundAt, holders: state.holders })
      stop()
      // Efter 10s (winner-visning) starter vi næste serverflow
      try {
        clearPhaseTimeout()
        state.phaseTimeout = setTimeout(() => {
          try { state.onWinner && state.onWinner(winnerIndex) } catch {}
        }, 10000)
      } catch {}
    }
  }
}

function start(params: { holders: Holder[]; seed?: number; fightsPerTick?: number; width?: number; height?: number }): void {
  stop()
  state.width = params.width && params.width > 0 ? params.width : 50
  state.height = params.height && params.height > 0 ? params.height : 50
  state.totalPixels = state.width * state.height
  state.holders = params.holders || []
  state.fightsPerTick = params.fightsPerTick && params.fightsPerTick > 0 ? params.fightsPerTick : 4000
  state.rngState = typeof params.seed === 'number' ? params.seed : 12345
  state.neighbors = buildNeighbors(state.width, state.height)
  state.tick = 0
  state.startMs = Date.now()
  state.roundId = (state.roundId || 0) + 1
  state.phase = 'running'
  state.nextRoundAt = 0
  state.winnerIndex = null
  state.nextPhaseAt = 0
  distributePixelsDeterministic()
  state.running = true
  const tickMs = Math.max(10, Number(process.env.TICK_INTERVAL_MS || 15))
  state.interval = setInterval(tickOnce, tickMs)
}

function stop(): void {
  state.running = false
  if (state.interval) {
    clearInterval(state.interval)
    state.interval = null
  }
}

function broadcast(obj: any): void {
  const data = encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
  clients.forEach((client) => {
    try {
      client.enqueue(data)
    } catch {}
  })
}

export function addClient(enqueue: (chunk: Uint8Array) => void): () => void {
  const id = nextClientId++
  clients.set(id, { enqueue, id })
  // Send a hello event to open the stream
  try { enqueue(encoder.encode(': connected\n\n')) } catch {}
  return () => {
    clients.delete(id)
  }
}

export function startRound(params: { holders: Holder[]; seed?: number; fightsPerTick?: number; width?: number; height?: number }) {
  start(params)
}

export function getCurrentState() {
  return {
    running: state.running,
    tick: state.tick,
    width: state.width,
    height: state.height,
    holders: state.holders,
    pixels: state.pixels,
    startMs: state.startMs,
    roundId: state.roundId,
    phase: state.phase,
    nextRoundAt: state.nextRoundAt,
    winnerIndex: state.winnerIndex,
    nextPhaseAt: state.nextPhaseAt
  }
}

export function isRunning() { return state.running }

export function setOnWinner(handler: (winnerIndex: number) => void) {
  state.onWinner = handler
}

// --- Serverstyret fase-flow (claim -> snapshot -> starting -> running) ---

function clearPhaseTimeout() {
  if (state.phaseTimeout) {
    clearTimeout(state.phaseTimeout)
    state.phaseTimeout = null
  }
}

function defaultHolders(): Holder[] {
  const total = 100
  const base = Math.floor((state.width * state.height) / total)
  return Array.from({ length: total }, (_, i) => ({
    address: `HOLDER_${i.toString().padStart(3,'0')}`,
    balance: 1,
    percentage: 1,
    pixels: base,
    color: `hsl(${Math.round((i * 360) / total)}, 80%, 50%)`
  }))
}

export function startServerFlow(params?: { holders?: Holder[]; claimMs?: number; snapshotMs?: number; startingMs?: number }) {
  clearPhaseTimeout()
  stop()
  state.phase = 'idle'
  state.running = false
  state.winnerIndex = null
  const claimMs = typeof params?.claimMs === 'number' ? params!.claimMs : 20000 // 20s for claim
  const snapshotMs = typeof params?.snapshotMs === 'number' ? params!.snapshotMs : 5000
  const startingMs = typeof params?.startingMs === 'number' ? params!.startingMs : 3000

  // Phase: claim - automatically claim fees and pay winner
  state.phase = 'claim'
  state.nextPhaseAt = Date.now() + claimMs
  state.feesPoolLamports = 0
  broadcast({ type: 'phase', phase: 'claim', endsAt: state.nextPhaseAt, feesPoolLamports: state.feesPoolLamports })
  
  // Trigger claim API to collect fees and pay previous winner
  ;(async () => {
    try {
      console.log('[GameEngine] 🎯 Starting claim process...')
      const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const claimUrl = `${baseUrl.replace(/\/$/, '')}/api/claim`
      const response = await fetch(claimUrl, { method: 'POST' })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[GameEngine] ✅ Claim successful:', {
          claimedSOL: data.claimedSOL || 0,
          payoutSOL: data.payoutSOL || 0,
          winnerAddress: data.winnerAddress || 'none',
          signature: data.signature || 'none'
        })
        // Update fees pool for display
        if (typeof data.claimedLamports === 'number') {
          state.feesPoolLamports = data.claimedLamports
          broadcast({ type: 'phase', phase: 'claim', endsAt: state.nextPhaseAt, feesPoolLamports: state.feesPoolLamports })
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('[GameEngine] ❌ Claim failed:', response.status, errorText)
      }
    } catch (error) {
      console.error('[GameEngine] ❌ Claim request failed:', error)
    }
  })()
  
  state.phaseTimeout = setTimeout(() => {
    // Phase: snapshot (bestem holders)
    state.phase = 'snapshot'
    state.nextPhaseAt = Date.now() + snapshotMs
    // For nu: brug params.holders eller default
    state.holders = (params?.holders && params.holders.length ? params.holders : defaultHolders())
    broadcast({ type: 'phase', phase: 'snapshot', endsAt: state.nextPhaseAt, holders: state.holders, feesPoolLamports: state.feesPoolLamports })
    clearPhaseTimeout()
    state.phaseTimeout = setTimeout(() => {
      // Phase: starting (nedtælling før running)
      state.phase = 'starting'
      state.nextPhaseAt = Date.now() + startingMs
      broadcast({ type: 'phase', phase: 'starting', endsAt: state.nextPhaseAt, feesPoolLamports: state.feesPoolLamports })
      clearPhaseTimeout()
      state.phaseTimeout = setTimeout(() => {
        // Start round (running)
        start({ holders: state.holders, seed: Date.now() % 100000, fightsPerTick: Math.max(200, Number(process.env.FIGHTS_PER_TICK || 1200)), width: state.width, height: state.height })
      }, startingMs)
    }, snapshotMs)
  }, claimMs)
}


