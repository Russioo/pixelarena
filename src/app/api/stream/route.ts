export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ENGINE_URL = process.env.ENGINE_URL
  
  // ENGINE_URL er PÅKRÆVET - ingen fallback!
  if (!ENGINE_URL) {
    return new Response(
      JSON.stringify({ 
        error: 'ENGINE_URL mangler',
        message: 'Venter på Docker server... ENGINE_URL skal være sat i environment variables.',
        status: 'waiting'
      }), 
      { 
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
  }

  // Proxy til Docker serveren
  try {
    const url = ENGINE_URL.replace(/\/$/, '') + '/api/stream'
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/event-stream',
      },
    })

    if (!response.ok || !response.body) {
      return new Response(
        JSON.stringify({ 
          error: 'Engine unavailable',
          message: 'Docker serveren er nede eller kan ikke nås.',
          engineUrl: ENGINE_URL
        }), 
        { 
          status: 502,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
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
    return new Response(
      JSON.stringify({ 
        error: 'Connection failed',
        message: 'Kunne ikke forbinde til Docker serveren.',
        engineUrl: ENGINE_URL,
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 502,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
  }
}


