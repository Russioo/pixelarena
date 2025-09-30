export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ENGINE_URL = process.env.ENGINE_URL
  
  // Hvis ENGINE_URL er sat, proxy til Docker serveren
  if (ENGINE_URL) {
    try {
      const url = ENGINE_URL.replace(/\/$/, '') + '/api/stream'
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/event-stream',
        },
      })

      if (!response.ok || !response.body) {
        return new Response('Engine stream unavailable', { status: 502 })
      }

      // Returner Docker serverens stream direkte til klienten
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      })
    } catch (error) {
      console.error('Failed to proxy stream:', error)
      return new Response('Failed to connect to game engine', { status: 502 })
    }
  }

  // Fallback til lokal engine (kun til udvikling)
  const { addClient, getCurrentState } = await import('@/server/gameEngine')
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial event based on current server phase
      try {
        const s = getCurrentState()
        if (s.phase === 'running') {
          const initial = { type: 'snapshot', tick: s.tick, startMs: s.startMs, roundId: s.roundId, pixels: s.pixels, holders: s.holders }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`))
        } else if (s.phase === 'winner' && typeof s.winnerIndex === 'number') {
          const initial = { type: 'winner', winnerIndex: s.winnerIndex, nextRoundAt: s.nextRoundAt, holders: s.holders }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`))
        } else if (s.phase === 'claim' || s.phase === 'snapshot' || s.phase === 'starting') {
          const initial = { type: 'phase', phase: s.phase, endsAt: s.nextPhaseAt, feesPoolLamports: (s as any).feesPoolLamports, holders: s.phase === 'snapshot' ? s.holders : undefined } as any
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`))
        }
      } catch {}

      const remove = addClient((chunk) => controller.enqueue(chunk))
      controller.enqueue(new TextEncoder().encode('retry: 1000\n\n'))
      return () => {
        try { remove() } catch {}
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}


