'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import GameStats from '@/components/GameStats'
import Battlefield from '@/components/Battlefield'
import Leaderboard from '@/components/Leaderboard'
import { Holder, Pixel, GameState } from '@/types/game'

export default function Home() {
  const GRID_WIDTH = 50
  const GRID_HEIGHT = 50
  // Tunables for fairness and round duration
  const FIGHTS_PER_TICK = 1500 // meget hurtigere kampe
  const TOKEN_INFLUENCE = 0.15 // endnu mindre vægt på balance
  const SUPPORT_INFLUENCE = 0.35 // mere vægt på lokal støtte

  const [gameState, setGameState] = useState<GameState>({
    totalPixels: 2500,
    holders: [],
    pixels: [],
    gameRunning: false,
    roundStartTime: null,
    currentRound: 1,
    feesPool: 0,
    activePlayersCount: 0,
    recentWinners: []
  })

  const [showWinnerPopup, setShowWinnerPopup] = useState(false)
  const [winnerInfo, setWinnerInfo] = useState({ address: '', color: '', startingPixels: 0 })
  const [nextRoundCountdown, setNextRoundCountdown] = useState(0)
  const [winnerClosing, setWinnerClosing] = useState(false)
  const [showSnapshotPopup, setShowSnapshotPopup] = useState(false)
  const [snapshotCountdown, setSnapshotCountdown] = useState(0)
  const [snapshotClosing, setSnapshotClosing] = useState(false)
  const [showClaimPopup, setShowClaimPopup] = useState(false)
  const [claimClosing, setClaimClosing] = useState(false)
  const [claimedAmounts, setClaimedAmounts] = useState<{ claimedLamports: number; payoutLamports: number }>({ claimedLamports: 0, payoutLamports: 0 })
  const [showRoundStartPopup, setShowRoundStartPopup] = useState(false)
  const [roundStartCountdown, setRoundStartCountdown] = useState(0)
  const [roundStartClosing, setRoundStartClosing] = useState(false)
  const [roundTimer, setRoundTimer] = useState('00:00')
  const [showLoadingPopup, setShowLoadingPopup] = useState(true)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const battleIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sseRef = useRef<EventSource | null>(null)
  const neighborsRef = useRef<number[][]>([])
  const countdownRunningRef = useRef<boolean>(false)
  const snapshotHoldersRef = useRef<Holder[] | null>(null)
  const DEFAULT_MINT = process.env.NEXT_PUBLIC_MINT_ADDRESS || 'DfPFV3Lt1x3818H9sHfM2aiuV5zqWM7oztQ8sSbapump'

  // Initialize pixels array and precompute neighbors
  useEffect(() => {
    const initialPixels: Pixel[] = []
    for (let i = 0; i < gameState.totalPixels; i++) {
      initialPixels.push({
        index: i,
        owner: null,
        position: { x: i % GRID_WIDTH, y: Math.floor(i / GRID_WIDTH) },
        color: '#333'
      })
    }
    setGameState(prev => ({ ...prev, pixels: initialPixels }))

    // precompute 4-neighbors (up/down/left/right)
    const neighbors: number[][] = Array.from({ length: gameState.totalPixels }, () => [])
    for (let idx = 0; idx < gameState.totalPixels; idx++) {
      const x = idx % GRID_WIDTH
      const y = Math.floor(idx / GRID_WIDTH)
      if (x > 0) neighbors[idx].push(idx - 1)
      if (x < GRID_WIDTH - 1) neighbors[idx].push(idx + 1)
      if (y > 0) neighbors[idx].push(idx - GRID_WIDTH)
      if (y < GRID_HEIGHT - 1) neighbors[idx].push(idx + GRID_WIDTH)
    }
    neighborsRef.current = neighbors
  }, [gameState.totalPixels])

  const generatePlayerColor = (seed: string): string => {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    const hue = Math.abs(hash) % 360
    const saturation = 70 + (Math.abs(hash) % 30)
    const lightness = 45 + (Math.abs(hash) % 20)
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  // Fælles server-event handler (phase/snapshot/winner)
  const handleServerEvent = useCallback((data: any) => {
    try {
      if (!data || typeof data !== 'object') return
      if (data.type === 'snapshot') {
        snapshotHoldersRef.current = data.holders
        setGameState(prev => ({
          ...prev,
          pixels: data.pixels,
          holders: data.holders,
          currentRound: typeof data.roundId === 'number' ? data.roundId : prev.currentRound,
          gameRunning: true,
          roundStartTime: typeof data.startMs === 'number' ? data.startMs : Date.now()
        }))
        setShowClaimPopup(false)
        setShowSnapshotPopup(false)
        setShowRoundStartPopup(false)
        setShowLoadingPopup(false)
        return
      }

      if (data.type === 'winner') {
        const idx = data.winnerIndex
        const winnerHolder = (snapshotHoldersRef.current || [])[idx]
        if (winnerHolder) {
          setWinnerInfo({ address: winnerHolder.address, color: winnerHolder.color, startingPixels: Math.max(0, Math.floor(winnerHolder.pixels || 0)) })
          setWinnerClosing(false)
          setShowWinnerPopup(true)
          if (!countdownRunningRef.current) {
            countdownRunningRef.current = true
            const endAt = typeof data.nextRoundAt === 'number' ? data.nextRoundAt : (Date.now() + 10000)
            const t = setInterval(() => {
              const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
              setNextRoundCountdown(remaining)
              if (remaining <= 0) {
                clearInterval(t)
                countdownRunningRef.current = false
                setWinnerClosing(true)
                setTimeout(() => setShowWinnerPopup(false), 240)
              }
            }, 250)
          }
        }
        if (typeof data.feesPoolLamports === 'number') setGameState(prev => ({ ...prev, feesPool: data.feesPoolLamports }))
        setShowLoadingPopup(false)
        return
      }

      if (data.type === 'phase') {
        const phase = data.phase
        const endsAt = typeof data.endsAt === 'number' ? data.endsAt : 0
        setShowLoadingPopup(false)
        if (typeof data.feesPoolLamports === 'number') setGameState(prev => ({ ...prev, feesPool: data.feesPoolLamports }))

        if (phase === 'claim') {
          setShowClaimPopup(true)
          setClaimClosing(false)
          const t = setInterval(() => {
            if (Date.now() >= endsAt) {
              clearInterval(t)
              setClaimClosing(true)
              setTimeout(() => setShowClaimPopup(false), 240)
            }
          }, 200)
          return
        }
        if (phase === 'snapshot') {
          if (Array.isArray(data.holders)) {
            snapshotHoldersRef.current = data.holders
            setGameState(prev => ({ ...prev, holders: data.holders, activePlayersCount: data.holders.length }))
          }
          setShowSnapshotPopup(true)
          setSnapshotClosing(false)
          const t = setInterval(() => {
            const remain = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
            setSnapshotCountdown(remain)
            if (Date.now() >= endsAt) {
              clearInterval(t)
              setSnapshotClosing(true)
              setTimeout(() => setShowSnapshotPopup(false), 240)
            }
          }, 250)
          return
        }
        if (phase === 'starting') {
          setShowRoundStartPopup(true)
          setRoundStartClosing(false)
          const t = setInterval(() => {
            const remain = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
            setRoundStartCountdown(remain)
            if (Date.now() >= endsAt) {
              clearInterval(t)
              setRoundStartClosing(true)
              setTimeout(() => setShowRoundStartPopup(false), 240)
            }
          }, 250)
          return
        }
        return
      }
    } catch {}
  }, [])

  // Start/stop rundetimer baseret på serverens startMs og running-state
  useEffect(() => {
    // Ryd eksisterende interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (gameState.gameRunning && gameState.roundStartTime) {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - (gameState.roundStartTime as number)
        const minutes = Math.floor(elapsed / 60000)
        const seconds = Math.floor((elapsed % 60000) / 1000)
        setRoundTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }, 1000)
    } else {
      setRoundTimer('00:00')
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [gameState.gameRunning, gameState.roundStartTime])

  // On mount: bind til serverens status og SSE
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/round/state', { cache: 'no-store' })
        const s = res.ok ? await res.json() : null
        const running = !!(s && s.running)
        if (running) {
          // Attach SSE til kørende spil
          if (sseRef.current) { try { sseRef.current.close() } catch {} }
          sseRef.current = new EventSource('/api/stream')
          sseRef.current.onmessage = (ev) => { try { handleServerEvent(JSON.parse(ev.data)) } catch {} }
        } else if (s && s.phase === 'winner' && typeof s.winnerIndex === 'number') {
          // Vis serverstyret winner-popup og nedtælling for nye besøgende
          const idx = s.winnerIndex as number
          const holders: Holder[] = (s.holders && s.holders.length ? s.holders : snapshotHoldersRef.current) || []
          if (holders[idx]) {
            snapshotHoldersRef.current = holders
            setWinnerInfo({ address: holders[idx].address, color: holders[idx].color, startingPixels: Math.max(0, Math.floor(holders[idx].pixels || 0)) })
            setWinnerClosing(false)
            setShowWinnerPopup(true)
            const endAt = typeof s.nextRoundAt === 'number' ? s.nextRoundAt : (Date.now() + 10000)
            if (!countdownRunningRef.current) {
              countdownRunningRef.current = true
              const tick = () => {
                const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
                setNextRoundCountdown(remaining)
                if (remaining <= 0) {
                  countdownRunningRef.current = false
                  setWinnerClosing(true)
                  setTimeout(() => {
                    setShowWinnerPopup(false)
                  }, 240)
                  return
                }
                setTimeout(tick, 250)
              }
              tick()
            }
          }
          setShowLoadingPopup(false)
          // attach SSE for videre events (fx ny snapshot)
          if (sseRef.current) { try { sseRef.current.close() } catch {} }
          sseRef.current = new EventSource('/api/stream')
          sseRef.current.onmessage = (ev) => { try { handleServerEvent(JSON.parse(ev.data)) } catch {} }
        } else {
          // Ingen runde kører → bed server starte serverflow og attach SSE
          try { await fetch('/api/round/ensure', { cache: 'no-store' }) } catch {}
          if (sseRef.current) { try { sseRef.current.close() } catch {} }
          sseRef.current = new EventSource('/api/stream')
          sseRef.current.onmessage = (ev) => { try { handleServerEvent(JSON.parse(ev.data)) } catch {} }
        }
      } catch {
        // Fallback: prøv at sikre serverflow og lyt
        try { await fetch('/api/round/ensure', { cache: 'no-store' }) } catch {}
        if (sseRef.current) { try { sseRef.current.close() } catch {} }
        sseRef.current = new EventSource('/api/stream')
      }
    })()
  }, [])



  // Test mode: 100 players with roughly equal pixels
  const generateEqualMockHolders = (): Holder[] => {
    const players = 100
    const equalBalance = 1
    const equalPercentage = 100 / players
    const basePixels = Math.floor(gameState.totalPixels / players)
    let remainder = gameState.totalPixels - basePixels * players

    const holders: Holder[] = []
    for (let i = 0; i < players; i++) {
      const pixels = basePixels + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder--

      holders.push({
        address: generateMockAddress(),
        balance: equalBalance,
        percentage: equalPercentage,
        pixels,
        color: '#ffffff' // temporary, palette will be assigned below
      })
    }
    // assign distinct palette
    const palette = generateDistinctPalette(holders.length)
    for (let i = 0; i < holders.length; i++) holders[i].color = palette[i]
    return holders
  }

  function generateDistinctPalette(count: number): string[] {
    // Mirror server logic: enforce min RGB distance to avoid lookalikes
    const palette: string[] = []
    const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
      s /= 100; l /= 100
      const k = (n: number) => (n + h / 30) % 12
      const a = s * Math.min(l, 1 - l)
      const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
      return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))]
    }
    const dist = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
      const dr = r1 - r2, dg = g1 - g2, db = b1 - b2
      return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db)
    }
    const minDistance = 80
    const baseSats = [76, 84]
    const baseLights = [48, 60, 40]
    for (let i = 0; i < count; i++) {
      let hue = Math.round((i * 360) / count)
      let sat = baseSats[i % baseSats.length]
      let light = baseLights[i % baseLights.length]
      let attempts = 0
      while (attempts < 12) {
        const [r, g, b] = hslToRgb(hue, sat, light)
        let ok = true
        for (let j = 0; j < palette.length; j++) {
          const match = /hsl\((\d+), (\d+)%?, (\d+)%?\)/.exec(palette[j])
          if (!match) continue
          const [hr, sr, lr] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
          const [rr, gr, br] = hslToRgb(hr, sr, lr)
          if (dist(r, g, b, rr, gr, br) < minDistance) { ok = false; break }
        }
        if (ok) { palette.push(`hsl(${hue}, ${sat}%, ${light}%)`); break }
        hue = (hue + 13) % 360
        attempts++
      }
      if (attempts >= 12) palette.push(`hsl(${hue}, ${sat}%, ${light}%)`)
    }
    return palette
  }

  const generateMockAddress = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789'
    let address = ''
    for (let i = 0; i < 44; i++) {
      address += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return address
  }

  const distributePixelsToHolders = useCallback(() => {
    setGameState(prev => {
      const newPixels = [...prev.pixels]

      // Reset all pixels
      for (let i = 0; i < newPixels.length; i++) {
        newPixels[i].owner = null
        newPixels[i].color = '#333'
      }

      // Build and shuffle a list of all pixel indices
      const indices: number[] = Array.from({ length: prev.totalPixels }, (_, i) => i)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = indices[i]
        indices[i] = indices[j]
        indices[j] = tmp
      }

      // Ensure total desired pixels match grid total
      const desiredCounts = prev.holders.map(h => Math.max(0, Math.floor(h.pixels)))
      let sum = desiredCounts.reduce((a, b) => a + b, 0)
      let remaining = prev.totalPixels - sum
      // fordel resterende pixels én ad gangen til de første spillere
      let k = 0
      while (remaining > 0 && desiredCounts.length > 0) {
        desiredCounts[k % desiredCounts.length]++
        k++
        remaining--
      }

      // Assign via the shuffled index array
      let cursor = 0
      for (let holderIndex = 0; holderIndex < prev.holders.length; holderIndex++) {
        const count = Math.min(desiredCounts[holderIndex] || 0, indices.length - cursor)
        const color = prev.holders[holderIndex].color
        for (let c = 0; c < count; c++) {
          const pixIdx = indices[cursor++]
          newPixels[pixIdx].owner = holderIndex
          newPixels[pixIdx].color = color
        }
        if (cursor >= indices.length) break
      }

      return { ...prev, pixels: newPixels }
    })
  }, [])

  const startTimer = useCallback(() => {
    timerIntervalRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.gameRunning && prev.roundStartTime) {
          const elapsed = Date.now() - prev.roundStartTime
          const minutes = Math.floor(elapsed / 60000)
          const seconds = Math.floor((elapsed % 60000) / 1000)
          
          setRoundTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
        }
        return prev
      })
    }, 1000)
  }, [])

  const performBattle = useCallback(() => {
    setGameState(prev => {
      if (!prev.gameRunning) return prev

      const newPixels = [...prev.pixels]

      // perform many local neighbor fights per tick
      for (let r = 0; r < FIGHTS_PER_TICK; r++) {
        const aIndex = Math.floor(Math.random() * newPixels.length)
        const aOwner = newPixels[aIndex].owner
        if (aOwner === null) continue

        const neighbors = neighborsRef.current[aIndex]
        if (!neighbors || neighbors.length === 0) continue
        const bIndex = neighbors[Math.floor(Math.random() * neighbors.length)]
        const bOwner = newPixels[bIndex].owner
        if (bOwner === null || bOwner === aOwner) continue

        // 50/50 kamp – helt fair per pixel
        const holderA = prev.holders[aOwner]
        const holderB = prev.holders[bOwner]
        const probA = 0.5

        if (Math.random() < probA) {
          newPixels[bIndex].owner = aOwner
          newPixels[bIndex].color = holderA.color
        } else {
          newPixels[aIndex].owner = bOwner
          newPixels[aIndex].color = holderB.color
        }
      }

      // Check for a round winner after the batch
      const pixelCounts: { [key: number]: number } = {}
      for (let i = 0; i < newPixels.length; i++) {
        const o = newPixels[i].owner
        if (o !== null) pixelCounts[o] = (pixelCounts[o] || 0) + 1
      }
      const owners = Object.keys(pixelCounts)
      // Vind KUN når der kun er én ejer tilbage (100% af gridet)
      if (owners.length === 1) {
        const onlyOwnerIndex = parseInt(owners[0])
          const winnerHolder = prev.holders[onlyOwnerIndex]
        const roundFees = prev.feesPool // winner gets the whole pool (30% allerede i pool)
        // Stop loops when someone wins
        setTimeout(() => {
          stopAllLoops()
          setGameState(current => ({ ...current, gameRunning: false }))

          // Prevent overlapping countdowns
          if (countdownRunningRef.current) return
          countdownRunningRef.current = true

          // Show winner popup
          setWinnerInfo({ address: winnerHolder.address, color: winnerHolder.color, startingPixels: Math.max(0, Math.floor(winnerHolder.pixels || 0)) })
          setWinnerClosing(false)
          setShowWinnerPopup(true)
          setNextRoundCountdown(10)

          // Fixed countdown of full 10 seconds
          let ticks = 10
          const startedAt = Date.now()
          const countdownInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000)
            const remaining = Math.max(0, 10 - elapsed)
            setNextRoundCountdown(remaining)
            if (remaining <= 0) {
              clearInterval(countdownInterval)
              countdownRunningRef.current = false
              setWinnerClosing(true)
              setTimeout(() => {
                setShowWinnerPopup(false)
                startGame()
              }, 240)
            }
          }, 250) // update 4x per sekund for stabil nedtælling
        }, 50)
      }

      return { ...prev, pixels: newPixels }
    })
  }, [distributePixelsToHolders])

  const startBattleLoop = useCallback(() => {
    if (battleIntervalRef.current) clearInterval(battleIntervalRef.current)
    battleIntervalRef.current = setInterval(() => {
      performBattle()
    }, 10) // ~100 FPS (kræver mere CPU)
  }, [performBattle])

  const stopAllLoops = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    if (battleIntervalRef.current) clearInterval(battleIntervalRef.current)
    if (sseRef.current) { try { sseRef.current.close() } catch {} sseRef.current = null }
  }, [])

  const startGame = async () => {
    try { await fetch('/api/round/start', { method: 'POST' }) } catch {}
  }





  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      stopAllLoops()
    }
  }, [stopAllLoops])

  function logTopHolders(list: Holder[]) {
    try {
      const sorted = [...list].sort((a, b) => b.balance - a.balance).slice(0, 100)
      console.groupCollapsed('Top 100 holders (snapshot)')
      sorted.forEach((h, i) => {
        console.log(`#${(i + 1).toString().padStart(2, '0')} ${h.address} — ${Math.round(h.balance)} tokens${typeof h.tokenAccounts === 'number' ? ` — ${h.tokenAccounts} account(s)` : ''}`)
      })
      console.groupEnd()
    } catch (e) {
      console.warn('Could not log holders snapshot', e)
    }
  }

  // Live opdaterede holder-data baseret på pixels
  const liveHolders = useMemo(() => {
    const counts: number[] = Array.from({ length: gameState.holders.length }, () => 0)
    for (let i = 0; i < gameState.pixels.length; i++) {
      const o = gameState.pixels[i].owner
      if (o !== null && o >= 0 && o < counts.length) counts[o]++
    }
    const total = gameState.totalPixels || 1
    return gameState.holders.map((h, idx) => ({
      ...h,
      pixels: counts[idx] || 0,
      percentage: ((counts[idx] || 0) / total) * 100
    }))
  }, [gameState.holders, gameState.pixels, gameState.totalPixels])

  const liveActivePlayers = useMemo(() => {
    return liveHolders.filter(h => (h.pixels || 0) > 0).length
  }, [liveHolders])

  const feePoolSOL = useMemo(() => {
    return (gameState.feesPool || 0) / 1e9
  }, [gameState.feesPool])

  function DarkStat({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ background: '#0f1115', border: '1px solid #1f2430', borderRadius: 12, padding: '10px 14px', minWidth: 140 }}>
        <div style={{ fontSize: 12, color: '#9aa1ac' }}>{label}</div>
        <div style={{ fontWeight: 800, color: '#e5e7eb' }}>{value}</div>
      </div>
    )
  }

  return (
    <div style={{ background: '#0b0d12', minHeight: '100vh', color: '#e5e7eb' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <DarkStat label="Total Pixels" value={gameState.totalPixels.toString()} />
            <DarkStat label="Active Players" value={liveActivePlayers.toString()} />
            <DarkStat label="Fee Pool" value={`${feePoolSOL.toFixed(4)} SOL`} />
          </div>
          <div style={{ textAlign: 'center', fontWeight: 800, letterSpacing: 0.4 }}>Pixel Arena</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            <DarkStat label="Round Time" value={roundTimer} />
            <DarkStat label="Round ID" value={gameState.currentRound.toString()} />
            <a
              href="https://x.com/pixelarenapump"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open X account"
              title="Open X account"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: '1px solid #1f2430', background: '#0f1115' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2H21L13.5 10.51L22 22h-6.222l-4.86-6.36L5.244 22H2.488l7.94-9.174L2 2h6.333l4.392 5.8L18.244 2Zm-1.066 18h1.934L8.898 4H6.898l10.28 16Z" fill="#e5e7eb"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
          {/* Canvas Area */}
          <div style={{ background: '#0f1115', border: '1px solid #1f2430', borderRadius: 14, padding: 16 }}>
            <div style={{ aspectRatio: '1 / 1', width: '100%', maxWidth: 900, margin: '0 auto' }}>
              <Battlefield pixels={gameState.pixels} />
            </div>
          </div>

          {/* Leaderboard Area */}
          <div style={{ background: '#0f1115', border: '1px solid #1f2430', borderRadius: 14, height: 'calc(100vh - 160px)', overflow: 'hidden' }}>
            <Leaderboard holders={[...liveHolders].sort((a, b) => b.pixels - a.pixels)} />
          </div>
        </div>
      </div>

      {/* Winner Modal (dark theme, simple, no emojis, smooth close) */}
      {showWinnerPopup && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px) grayscale(1)',
          WebkitBackdropFilter: 'blur(10px) grayscale(1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f1115',
            borderRadius: 14,
            padding: 24,
            width: 420,
            textAlign: 'center',
            border: `1px solid #1f2430`,
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            color: '#e5e7eb',
            transform: winnerClosing ? 'translateY(8px)' : 'translateY(0)',
            opacity: winnerClosing ? 0 : 1,
            transition: 'opacity 160ms ease, transform 160ms ease'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" stroke="#10b981" strokeWidth="1.5"/>
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>Winner</div>
            </div>
            <div style={{ color: '#9aa1ac', wordBreak: 'break-all', marginBottom: 6 }}>
              {winnerInfo.address ? `${winnerInfo.address.substring(0, 6)}...${winnerInfo.address.substring(Math.max(0, winnerInfo.address.length - 4))}` : ''}
            </div>
            <div style={{ color: '#e5e7eb', marginBottom: 16, fontVariantNumeric: 'tabular-nums' }}>Started with {winnerInfo.startingPixels} px</div>
            <div style={{ color: '#e5e7eb', marginBottom: 6 }}>Next round starts in</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981' }}>{nextRoundCountdown}s</div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {showLoadingPopup && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px) grayscale(1)',
          WebkitBackdropFilter: 'blur(10px) grayscale(1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{
            background: '#0f1115',
            borderRadius: 14,
            padding: 24,
            width: 360,
            textAlign: 'center',
            border: '1px solid #1f2430',
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            color: '#e5e7eb'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="9" stroke="#60a5fa" strokeWidth="2" opacity="0.25" />
                <path d="M21 12a9 9 0 0 1-9 9" stroke="#60a5fa" strokeWidth="2" />
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>Loading from server…</div>
            </div>
            <div style={{ color: '#9aa1ac' }}>Fetching current game state…</div>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimPopup && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px) grayscale(1)',
          WebkitBackdropFilter: 'blur(10px) grayscale(1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f1115',
            borderRadius: 14,
            padding: 24,
            width: 460,
            textAlign: 'center',
            border: '1px solid #1f2430',
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            color: '#e5e7eb',
            transform: claimClosing ? 'translateY(8px)' : 'translateY(0)',
            opacity: claimClosing ? 0 : 1,
            transition: 'opacity 160ms ease, transform 160ms ease'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" stroke="#10b981" strokeWidth="1.5"/>
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>Claiming fee pool…</div>
            </div>
            <div style={{ color: '#9aa1ac' }}>Please wait while fees are being collected.</div>
          </div>
        </div>
      )}

      {/* Snapshot Modal (dark theme, simple, no emojis, smooth close) */}
      {showSnapshotPopup && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px) grayscale(1)',
          WebkitBackdropFilter: 'blur(10px) grayscale(1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f1115',
            borderRadius: 14,
            padding: 24,
            width: 480,
            textAlign: 'center',
            border: '1px solid #1f2430',
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            color: '#e5e7eb',
            transform: snapshotClosing ? 'translateY(8px)' : 'translateY(0)',
            opacity: snapshotClosing ? 0 : 1,
            transition: 'opacity 160ms ease, transform 160ms ease'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="#60a5fa" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="3" stroke="#60a5fa" strokeWidth="1.5"/>
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>Taking snapshot</div>
            </div>
            <div style={{ color: '#9aa1ac', marginBottom: 14 }}>Fetching top 100 holders…</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa' }}>{snapshotCountdown}s</div>
          </div>
        </div>
      )}

      {/* Round Start Modal */}
      {showRoundStartPopup && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px) grayscale(1)',
          WebkitBackdropFilter: 'blur(10px) grayscale(1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f1115',
            borderRadius: 14,
            padding: 24,
            width: 420,
            textAlign: 'center',
            border: '1px solid #1f2430',
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            color: '#e5e7eb',
            transform: roundStartClosing ? 'translateY(8px)' : 'translateY(0)',
            opacity: roundStartClosing ? 0 : 1,
            transition: 'opacity 160ms ease, transform 160ms ease'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="6" width="16" height="12" rx="2" stroke="#60a5fa" strokeWidth="1.5"/>
                <path d="M8 10h8M8 14h8" stroke="#60a5fa" strokeWidth="1.5"/>
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>Round starting</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa' }}>{roundStartCountdown}</div>
          </div>
        </div>
      )}
      {/* Footer */}
      <div style={{ borderTop: '1px solid #1f2430', marginTop: 16 }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <a
            href="https://x.com/pixelarenapump"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open X account"
            title="Open X account"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#9aa1ac', textDecoration: 'none' }}
          >
            <span style={{ display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2H21L13.5 10.51L22 22h-6.222l-4.86-6.36L5.244 22H2.488l7.94-9.174L2 2h6.333l4.392 5.8L18.244 2Zm-1.066 18h1.934L8.898 4H6.898l10.28 16Z" fill="#9aa1ac"/>
              </svg>
            </span>
            <span style={{ fontWeight: 700, letterSpacing: 0.2 }}>@pixelarenapump</span>
          </a>
        </div>
      </div>
    </div>
  )
}
