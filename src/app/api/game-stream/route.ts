import { NextRequest } from 'next/server'
import { getGameServer } from '@/server/gameServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder()
  let keepAliveInterval: NodeJS.Timeout | null = null
  
  const readable = new ReadableStream({
    start(controller) {
      let isClosed = false
      
      const send = (data: any) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch (error) {
          console.log('Stream lukket, stopper data send')
          isClosed = true
          cleanup()
        }
      }
      
      const sendKeepAlive = () => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(`:\n\n`))
        } catch (error) {
          console.log('Stream lukket, stopper keep-alive')
          isClosed = true
          cleanup()
        }
      }
      
      const cleanup = () => {
        isClosed = true
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval)
          keepAliveInterval = null
        }
        gameServer.off('snapshot', onSnapshot)
        gameServer.off('winner', onWinner)
        gameServer.off('phase', onPhase)
        gameServer.off('claim', onClaim)
        gameServer.off('holders', onHolders)
        gameServer.off('countdown', onCountdown)
        gameServer.off('timer', onTimer)
        gameServer.off('fetching', onFetching)
      }
      
      // Get game server and set up listeners
      const gameServer = getGameServer()
      
      // Send initial snapshot
      const initialSnapshot = gameServer.getSnapshot()
      send({
        type: 'snapshot',
        pixels: initialSnapshot.pixels,
        holders: initialSnapshot.holders,
        tick: initialSnapshot.tick
      })
      
      // Listen for all game events
      const onSnapshot = (data: any) => send(data)
      const onWinner = (data: any) => send(data)
      const onPhase = (data: any) => send(data)
      const onClaim = (data: any) => send(data)
      const onHolders = (data: any) => send(data)
      const onCountdown = (data: any) => send(data)
      const onTimer = (data: any) => send(data)
      const onFetching = (data: any) => send(data)
      
      gameServer.on('snapshot', onSnapshot)
      gameServer.on('winner', onWinner)
      gameServer.on('phase', onPhase)
      gameServer.on('claim', onClaim)
      gameServer.on('holders', onHolders)
      gameServer.on('countdown', onCountdown)
      gameServer.on('timer', onTimer)
      gameServer.on('fetching', onFetching)
      
      // Keep alive every 15 seconds
      keepAliveInterval = setInterval(sendKeepAlive, 15000)
      
      // Send retry header
      try {
        controller.enqueue(encoder.encode('retry: 2000\n\n'))
      } catch (error) {
        isClosed = true
        cleanup()
      }
      
      return cleanup
    },
    
    cancel() {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval)
        keepAliveInterval = null
      }
    }
  })

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}
