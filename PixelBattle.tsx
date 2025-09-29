'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Pixel {
  index: number
  owner: number | null
  position: { x: number; y: number }
  color: string
}

interface Player {
  id: number
  balance: number
  color: string
  pixels: number
}

export default function PixelBattle() {
  const GRID_WIDTH = 50
  const GRID_HEIGHT = 50
  const TOTAL_PIXELS = GRID_WIDTH * GRID_HEIGHT
  const FIGHTS_PER_TICK = 200 // Kampe per tick - hurtigere action!
  const TOKEN_INFLUENCE = 0.4 // Hvor meget token balance påvirker (0-1)
  const SUPPORT_INFLUENCE = 0.2 // Hvor meget nabo-støtte påvirker

  const [pixels, setPixels] = useState<Pixel[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [gameRunning, setGameRunning] = useState(false)
  const [roundTimer, setRoundTimer] = useState('00:00')
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const battleIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const neighborsRef = useRef<number[][]>([])

  // Initialiser pixels og naboer
  useEffect(() => {
    const initialPixels: Pixel[] = []
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      initialPixels.push({
        index: i,
        owner: null,
        position: { x: i % GRID_WIDTH, y: Math.floor(i / GRID_WIDTH) },
        color: '#333'
      })
    }
    setPixels(initialPixels)

    // Beregn naboer (op/ned/venstre/højre)
    const neighbors: number[][] = Array.from({ length: TOTAL_PIXELS }, () => [])
    for (let idx = 0; idx < TOTAL_PIXELS; idx++) {
      const x = idx % GRID_WIDTH
      const y = Math.floor(idx / GRID_WIDTH)
      if (x > 0) neighbors[idx].push(idx - 1)           // venstre
      if (x < GRID_WIDTH - 1) neighbors[idx].push(idx + 1)  // højre
      if (y > 0) neighbors[idx].push(idx - GRID_WIDTH)      // op
      if (y < GRID_HEIGHT - 1) neighbors[idx].push(idx + GRID_WIDTH) // ned
    }
    neighborsRef.current = neighbors
  }, [])

  // Generer farve baseret på spiller ID
  const generatePlayerColor = (playerId: number): string => {
    const hue = (playerId * 137.5) % 360 // Golden angle for bedre farvefordeling
    const saturation = 70 + (playerId % 30)
    const lightness = 45 + (playerId % 20)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  // Opret test spillere - 100 spillere som ønsket
  const createTestPlayers = () => {
    const testPlayers: Player[] = []
    for (let i = 0; i < 100; i++) {
      testPlayers.push({
        id: i,
        balance: Math.random() * 1000 + 100, // Random balance
        color: generatePlayerColor(i),
        pixels: Math.floor(TOTAL_PIXELS / 100) // Lige fordeling til start
      })
    }
    setPlayers(testPlayers)
    return testPlayers
  }

  // Fordel pixels til spillere
  const distributePixelsToPlayers = useCallback((playerList: Player[]) => {
    setPixels(prev => {
      const newPixels = [...prev]

      // Reset alle pixels
      for (let i = 0; i < newPixels.length; i++) {
        newPixels[i].owner = null
        newPixels[i].color = '#333'
      }

      // Bland pixel indices
      const indices: number[] = Array.from({ length: TOTAL_PIXELS }, (_, i) => i)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }

      // Tildel pixels til spillere
      let cursor = 0
      for (let playerIndex = 0; playerIndex < playerList.length; playerIndex++) {
        const player = playerList[playerIndex]
        const pixelCount = Math.min(player.pixels, indices.length - cursor)
        
        for (let c = 0; c < pixelCount; c++) {
          const pixIdx = indices[cursor++]
          newPixels[pixIdx].owner = player.id
          newPixels[pixIdx].color = player.color
        }
        if (cursor >= indices.length) break
      }

      return newPixels
    })
  }, [])

  // Hovedkampfunktion - her sker magien!
  const performBattle = useCallback(() => {
    setPixels(prevPixels => {
      if (!gameRunning) return prevPixels

      const newPixels = [...prevPixels]

      // Udfør mange lokale nabokampe per tick
      for (let fight = 0; fight < FIGHTS_PER_TICK; fight++) {
        // Vælg tilfældig pixel A
        const aIndex = Math.floor(Math.random() * newPixels.length)
        const aOwner = newPixels[aIndex].owner
        if (aOwner === null) continue

        // Find naboer til pixel A
        const neighbors = neighborsRef.current[aIndex]
        if (!neighbors || neighbors.length === 0) continue

        // Vælg tilfældig nabo B
        const bIndex = neighbors[Math.floor(Math.random() * neighbors.length)]
        const bOwner = newPixels[bIndex].owner
        if (bOwner === null || bOwner === aOwner) continue

        // Beregn nabo-støtte (hvor mange naboer ejer samme spiller)
        const calculateSupport = (idx: number, owner: number) => {
          const neigh = neighborsRef.current[idx]
          let count = 0
          for (let k = 0; k < neigh.length; k++) {
            const n = neigh[k]
            if (newPixels[n].owner === owner) count++
          }
          return count
        }

        const playerA = players.find(p => p.id === aOwner)
        const playerB = players.find(p => p.id === bOwner)
        if (!playerA || !playerB) continue

        const aSupport = calculateSupport(aIndex, aOwner)
        const bSupport = calculateSupport(bIndex, bOwner)

        // Beregn kampchancer
        // 50/50 baseline, justeret med tokens og lokal støtte
        const tokenAdvantage = (playerA.balance - playerB.balance) / 
                              Math.max(playerA.balance + playerB.balance, 1)
        const supportAdvantage = (aSupport - bSupport) / 4 // 4 mulige nabopositioner

        // Kombiner fordele
        let probA = 0.5 + TOKEN_INFLUENCE * tokenAdvantage + SUPPORT_INFLUENCE * supportAdvantage
        
        // Begræns sandsynlighed (ingen kan have 100% chance)
        probA = Math.max(0.05, Math.min(0.95, probA))

        // Udfør kamp!
        if (Math.random() < probA) {
          // Spiller A vinder - overtager pixel B
          newPixels[bIndex].owner = aOwner
          newPixels[bIndex].color = playerA.color
        } else {
          // Spiller B vinder - overtager pixel A
          newPixels[aIndex].owner = bOwner
          newPixels[aIndex].color = playerB.color
        }
      }

      // Tjek for vinder (hvis en spiller ejer alle pixels)
      const pixelCounts: { [key: number]: number } = {}
      for (let i = 0; i < newPixels.length; i++) {
        const owner = newPixels[i].owner
        if (owner !== null) {
          pixelCounts[owner] = (pixelCounts[owner] || 0) + 1
        }
      }

      const totalOwnedPixels = newPixels.length
      for (const [ownerIdStr, count] of Object.entries(pixelCounts)) {
        if (count === totalOwnedPixels) {
          const winnerId = parseInt(ownerIdStr)
          const winner = players.find(p => p.id === winnerId)
          console.log(`🏆 Spiller ${winnerId} (${winner?.color}) har vundet!`)
          setGameRunning(false)
          break
        }
      }

      return newPixels
    })
  }, [gameRunning, players])

  // Start timer
  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    timerIntervalRef.current = setInterval(() => {
      if (roundStartTime) {
        const elapsed = Date.now() - roundStartTime
        const minutes = Math.floor(elapsed / 60000)
        const seconds = Math.floor((elapsed % 60000) / 1000)
        setRoundTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }, 1000)
  }, [roundStartTime])

  // Start kamploop
  const startBattleLoop = useCallback(() => {
    if (battleIntervalRef.current) clearInterval(battleIntervalRef.current)
    battleIntervalRef.current = setInterval(() => {
      performBattle()
    }, 20) // Hurtigere - ~50 FPS
  }, [performBattle])

  // Tegn pixels på canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cellW = canvas.width / GRID_WIDTH
    const cellH = canvas.height / GRID_HEIGHT

    // Ryd canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Tegn alle pixels
    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i]
      ctx.fillStyle = pixel.color
      const x = Math.floor(pixel.position.x * cellW)
      const y = Math.floor(pixel.position.y * cellH)
      ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH))
    }
  }, [pixels])

  // Start spil
  const startGame = () => {
    const testPlayers = createTestPlayers()
    distributePixelsToPlayers(testPlayers)
    setGameRunning(true)
    setRoundStartTime(Date.now())
    startTimer()
    startBattleLoop()
  }

  // Stop spil
  const stopGame = () => {
    setGameRunning(false)
    if (battleIntervalRef.current) {
      clearInterval(battleIntervalRef.current)
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current)
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  // Beregn pixel counts for leaderboard
  const getPixelCounts = () => {
    const counts: { [key: number]: number } = {}
    pixels.forEach(pixel => {
      if (pixel.owner !== null) {
        counts[pixel.owner] = (counts[pixel.owner] || 0) + 1
      }
    })
    return counts
  }

  const pixelCounts = getPixelCounts()
  const sortedPlayers = [...players].sort((a, b) => (pixelCounts[b.id] || 0) - (pixelCounts[a.id] || 0))

  return (
    <div style={{ padding: '20px', backgroundColor: '#1a1a1a', color: 'white', minHeight: '100vh' }}>
      {/* Stats Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '20px',
        padding: '20px',
        backgroundColor: '#2a2a2a',
        borderRadius: '10px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0', color: '#4CAF50' }}>Total Pixels</h3>
          <p style={{ margin: '5px 0', fontSize: '24px', fontWeight: 'bold' }}>{TOTAL_PIXELS}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0', color: '#2196F3' }}>Active Players</h3>
          <p style={{ margin: '5px 0', fontSize: '24px', fontWeight: 'bold' }}>{players.length}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0', color: '#FF9800' }}>Round Time</h3>
          <p style={{ margin: '5px 0', fontSize: '24px', fontWeight: 'bold' }}>{roundTimer}</p>
        </div>
      </div>

      {/* Control Button */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button 
          onClick={gameRunning ? stopGame : startGame}
          style={{ 
            padding: '15px 30px', 
            fontSize: '18px',
            backgroundColor: gameRunning ? '#f44336' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          {gameRunning ? '⏸ Pause Kamp' : '▶ Start Kamp'}
        </button>
      </div>

      {/* Main Game Area */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Pixel Battle Canvas */}
        <div style={{ flex: '1' }}>
          <canvas
            ref={canvasRef}
            width={800}
            height={800}
            style={{ 
              border: '3px solid #4CAF50',
              borderRadius: '10px',
              display: 'block',
              maxWidth: '100%',
              height: 'auto'
            }}
          />
        </div>

        {/* Leaderboard */}
        <div style={{ 
          width: '300px', 
          backgroundColor: '#2a2a2a', 
          borderRadius: '10px', 
          padding: '20px',
          maxHeight: '800px',
          overflowY: 'auto'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#4CAF50', textAlign: 'center' }}>🏆 Leaderboard</h2>
          {sortedPlayers.slice(0, 20).map((player, index) => {
            const pixelCount = pixelCounts[player.id] || 0
            const percentage = ((pixelCount / TOTAL_PIXELS) * 100).toFixed(1)
            return (
              <div 
                key={player.id}
                style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  margin: '5px 0',
                  backgroundColor: index < 3 ? `${player.color}33` : '#333',
                  borderLeft: `4px solid ${player.color}`,
                  borderRadius: '5px'
                }}
              >
                <div>
                  <span style={{ fontWeight: 'bold' }}>#{index + 1}</span>
                  <span style={{ marginLeft: '10px', color: player.color }}>
                    Spiller {player.id}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold' }}>{pixelCount} pixels</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>{percentage}%</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

