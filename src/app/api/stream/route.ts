import { addClient, getCurrentState } from '@/server/gameEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
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


