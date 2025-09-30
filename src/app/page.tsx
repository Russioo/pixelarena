'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import GameStats from '@/components/GameStats'
import Battlefield from '@/components/Battlefield'
import Leaderboard from '@/components/Leaderboard'
import SystemStatus from '@/components/SystemStatus'
import RecentWinners from '@/components/RecentWinners'
import { Holder, Pixel, GameState } from '@/types/game'

export default function Home() {
  const GRID_WIDTH = 50
  const GRID_HEIGHT = 50
  // Client is view-only; all gameplay comes from server SSE

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
  const sseRef = useRef<EventSource | null>(null)
  const countdownRunningRef = useRef<boolean>(false)
  const snapshotHoldersRef = useRef<Holder[] | null>(null)
  const DEFAULT_MINT = process.env.NEXT_PUBLIC_MINT_ADDRESS || 'DfPFV3Lt1x3818H9sHfM2aiuV5zqWM7oztQ8sSbapump'

  // Initialize pixels array (layout only). Server will stream real owners/colors.
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
  }, [gameState.totalPixels])

  // No local color generation needed here; server provides colors

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
    const setupSSE = () => {
      if (sseRef.current) { try { sseRef.current.close() } catch {} }
      const sse = new EventSource('/api/stream')
      
      sse.onopen = () => {
        console.log('[SSE] Connected to stream')
        setShowLoadingPopup(false)
      }
      
      sse.onmessage = (ev) => { 
        try { 
          handleServerEvent(JSON.parse(ev.data)) 
          setShowLoadingPopup(false)
        } catch (e) {
          console.error('[SSE] Parse error:', e)
        }
      }
      
      sse.onerror = (err) => {
        console.error('[SSE] Connection error:', err)
        setShowLoadingPopup(false)
        sse.close()
      }
      
      sseRef.current = sse
    }
    
    (async () => {
      try {
        const res = await fetch('/api/round/state', { cache: 'no-store' })
        const s = res.ok ? await res.json() : null
        const running = !!(s && s.running)
        
        if (running) {
          // Attach SSE til kørende spil
          setupSSE()
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
          setupSSE()
        } else {
          // Ingen runde kører → bed server starte serverflow og attach SSE
          try { await fetch('/api/round/ensure', { cache: 'no-store' }) } catch {}
          setupSSE()
        }
      } catch {
        // Fallback: prøv at sikre serverflow og lyt
        try { await fetch('/api/round/ensure', { cache: 'no-store' }) } catch {}
        setupSSE()
      }
    })()
  }, [handleServerEvent])



  // Test mode: 100 players with roughly equal pixels
  // Remove local mocking / palette utilities to keep client authoritative

  const stopAllLoops = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    if (sseRef.current) { try { sseRef.current.close() } catch {} sseRef.current = null }
  }, [])





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
      <div className="dark-stat">
        <div className="dark-stat-label">{label}</div>
        <div className="dark-stat-value">{value}</div>
        <style jsx>{`
          .dark-stat {
            background: #0f1115;
            border: 1px solid #1f2430;
            border-radius: 10px;
            padding: 8px 12px;
            min-width: 120px;
          }

          .dark-stat-label {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 2px;
          }

          .dark-stat-value {
            font-weight: 700;
            color: #e5e7eb;
            font-size: 15px;
          }

          @media (max-width: 1400px) {
            .dark-stat {
              min-width: 100px;
              padding: 7px 10px;
            }
            
            .dark-stat-label {
              font-size: 10px;
            }
            
            .dark-stat-value {
              font-size: 14px;
            }
          }

          @media (max-width: 768px) {
            .dark-stat {
              min-width: 80px;
              padding: 6px 8px;
            }
            
            .dark-stat-label {
              font-size: 9px;
            }
            
            .dark-stat-value {
              font-size: 13px;
            }
          }

          @media (max-width: 480px) {
            .dark-stat {
              min-width: auto;
              width: 100%;
              padding: 8px 12px;
            }
            
            .dark-stat-label {
              font-size: 10px;
            }
            
            .dark-stat-value {
              font-size: 14px;
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ background: '#0b0d12', minHeight: '100vh', color: '#e5e7eb' }}>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-stats-left">
            <DarkStat label="Total Pixels" value={gameState.totalPixels.toString()} />
            <DarkStat label="Active Players" value={liveActivePlayers.toString()} />
            <DarkStat label="Fee Pool" value={`${feePoolSOL.toFixed(4)} SOL`} />
          </div>
          <div className="header-title">Pixel Arena</div>
          <div className="header-stats-right">
            <DarkStat label="Round Time" value={roundTimer} />
            <DarkStat label="Round" value={`#${gameState.currentRound}`} />
            <a
              href="https://x.com/pixelarenapump"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open X account"
              title="Open X account"
              className="header-social-link"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2H21L13.5 10.51L22 22h-6.222l-4.86-6.36L5.244 22H2.488l7.94-9.174L2 2h6.333l4.392 5.8L18.244 2Zm-1.066 18h1.934L8.898 4H6.898l10.28 16Z" fill="#e5e7eb"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Main Grid */}
        <div className="main-grid">
          {/* Canvas Area */}
          <div className="battlefield-container">
            <div style={{ aspectRatio: '1 / 1', width: '100%' }}>
              <Battlefield pixels={gameState.pixels} />
            </div>
          </div>

          {/* Leaderboard Area */}
          <div className="leaderboard-container">
            <Leaderboard holders={[...liveHolders].sort((a, b) => b.pixels - a.pixels)} />
          </div>
        </div>

        {/* Recent Winners */}
        <div className="recent-winners-section">
          <RecentWinners winners={gameState.recentWinners} />
        </div>
      </div>

      {/* Responsive Styles */}
      <style jsx>{`
        .page-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
        }

        .header-stats-left,
        .header-stats-right {
          display: flex;
          gap: 12px;
        }

        .header-stats-right {
          justify-content: flex-end;
          align-items: center;
        }

        .header-title {
          text-align: center;
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 0.5px;
        }

        .header-social-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid #1f2430;
          background: #0f1115;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 20px;
          align-items: start;
        }

        .battlefield-container {
          background: #0f1115;
          border: 1px solid #1f2430;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .leaderboard-container {
          background: #0f1115;
          border: 1px solid #1f2430;
          border-radius: 16px;
          height: calc(100vh - 140px);
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .recent-winners-section {
          margin-top: 20px;
        }

        /* Tablets og mindre desktops (≤1400px) */
        @media (max-width: 1400px) {
          .page-container {
            padding: 16px;
          }
          
          .page-header {
            gap: 16px;
          }

          .header-stats-left,
          .header-stats-right {
            gap: 8px;
          }

          .main-grid {
            grid-template-columns: 1fr 340px;
            gap: 16px;
          }

          .leaderboard-container {
            height: calc(100vh - 130px);
          }

          .recent-winners-section {
            margin-top: 16px;
          }
        }

        /* Mindre skærme (≤1200px) */
        @media (max-width: 1200px) {
          .page-header {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .header-title {
            order: -1;
            font-size: 20px;
            margin-bottom: 8px;
          }

          .header-stats-left {
            justify-content: center;
            flex-wrap: wrap;
          }

          .header-stats-right {
            justify-content: center;
            flex-wrap: wrap;
          }

          .main-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .leaderboard-container {
            height: 500px;
          }

          .recent-winners-section {
            margin-top: 16px;
          }
        }

        /* Tablet (≤768px) */
        @media (max-width: 768px) {
          .page-container {
            padding: 12px;
          }

          .page-header {
            gap: 10px;
          }

          .header-title {
            font-size: 18px;
            margin-bottom: 6px;
          }

          .header-stats-left,
          .header-stats-right {
            gap: 6px;
          }

          .main-grid {
            gap: 12px;
          }

          .leaderboard-container {
            height: 400px;
          }

          .recent-winners-section {
            margin-top: 12px;
          }
        }

        /* Mobil (≤480px) */
        @media (max-width: 480px) {
          .page-container {
            padding: 8px;
          }

          .page-header {
            gap: 8px;
          }

          .header-title {
            font-size: 16px;
          }

          .header-stats-left,
          .header-stats-right {
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            gap: 6px;
          }

          .header-social-link {
            width: 100%;
            height: 42px;
          }

          .main-grid {
            gap: 8px;
          }

          .battlefield-container,
          .leaderboard-container {
            border-radius: 12px;
          }

          .leaderboard-container {
            height: 350px;
          }

          .recent-winners-section {
            margin-top: 8px;
          }
        }

        /* Modal Styles */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(10px) grayscale(1);
          -webkit-backdrop-filter: blur(10px) grayscale(1);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-card {
          background: #0f1115;
          border-radius: 14px;
          padding: 24px;
          width: 100%;
          max-width: 420px;
          text-align: center;
          border: 1px solid #1f2430;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
          color: #e5e7eb;
        }

        @media (max-width: 480px) {
          .modal-card {
            padding: 20px;
            border-radius: 12px;
            max-width: 100%;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* Winner Modal (dark theme, simple, no emojis, smooth close) */}
      {showWinnerPopup && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{
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
            <div style={{ color: '#9aa1ac', wordBreak: 'break-all', marginBottom: 6, fontSize: 14 }}>
              {winnerInfo.address ? `${winnerInfo.address.substring(0, 6)}...${winnerInfo.address.substring(Math.max(0, winnerInfo.address.length - 4))}` : ''}
            </div>
            <div style={{ color: '#e5e7eb', marginBottom: 16, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>Started with {winnerInfo.startingPixels} px</div>
            <div style={{ color: '#e5e7eb', marginBottom: 6, fontSize: 14 }}>Next round starts in</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981' }}>{nextRoundCountdown}s</div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {showLoadingPopup && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-card">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="9" stroke="#60a5fa" strokeWidth="2" opacity="0.25" />
                <path d="M21 12a9 9 0 0 1-9 9" stroke="#60a5fa" strokeWidth="2" />
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4, fontSize: 15 }}>Loading from server…</div>
            </div>
            <div style={{ color: '#9aa1ac', fontSize: 14 }}>Fetching current game state…</div>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimPopup && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{
            transform: claimClosing ? 'translateY(8px)' : 'translateY(0)',
            opacity: claimClosing ? 0 : 1,
            transition: 'opacity 160ms ease, transform 160ms ease'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" stroke="#10b981" strokeWidth="1.5"/>
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4, fontSize: 15 }}>Claiming fee pool…</div>
            </div>
            <div style={{ color: '#9aa1ac', fontSize: 14 }}>Please wait while fees are being collected.</div>
          </div>
        </div>
      )}

      {/* Snapshot Modal (dark theme, simple, no emojis, smooth close) */}
      {showSnapshotPopup && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{
            transform: snapshotClosing ? 'translateY(8px)' : 'translateY(0)',
            opacity: snapshotClosing ? 0 : 1,
            transition: 'opacity 160ms ease, transform 160ms ease'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="#60a5fa" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="3" stroke="#60a5fa" strokeWidth="1.5"/>
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4, fontSize: 15 }}>Taking snapshot</div>
            </div>
            <div style={{ color: '#9aa1ac', marginBottom: 14, fontSize: 14 }}>Fetching top 100 holders…</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa' }}>{snapshotCountdown}s</div>
          </div>
        </div>
      )}

      {/* Round Start Modal */}
      {showRoundStartPopup && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{
            transform: roundStartClosing ? 'translateY(8px)' : 'translateY(0)',
            opacity: roundStartClosing ? 0 : 1,
            transition: 'opacity 160ms ease, transform 160ms ease'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="6" width="16" height="12" rx="2" stroke="#60a5fa" strokeWidth="1.5"/>
                <path d="M8 10h8M8 14h8" stroke="#60a5fa" strokeWidth="1.5"/>
              </svg>
              <div style={{ fontWeight: 800, letterSpacing: 0.4, fontSize: 15 }}>Round starting</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa' }}>{roundStartCountdown}</div>
          </div>
        </div>
      )}
      {/* Footer */}
      <div className="page-footer">
        <div className="page-footer-inner">
          <a
            href="https://x.com/pixelarenapump"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open X account"
            title="Open X account"
            className="footer-link"
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

      {/* Footer Styles */}
      <style jsx>{`
        .page-footer {
          border-top: 1px solid #1f2430;
          margin-top: 16px;
        }

        .page-footer-inner {
          max-width: 1360px;
          margin: 0 auto;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .footer-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #9aa1ac;
          text-decoration: none;
        }

        .footer-link:hover {
          color: #e5e7eb;
        }

        @media (max-width: 480px) {
          .page-footer-inner {
            padding: 10px 16px;
          }

          .footer-link span:last-child {
            font-size: 14px;
          }
        }
      `}</style>

      {/* System Status Indicator */}
      <SystemStatus />
    </div>
  )
}
