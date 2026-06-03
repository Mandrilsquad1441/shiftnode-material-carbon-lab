import type { Config, Context } from '@netlify/functions'
import {
  buildPriceIntelligence,
  isFresh,
  readCachedPriceIntelligence,
  writeCachedPriceIntelligence,
} from './_shared/price-intelligence'

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=900, stale-while-revalidate=21600',
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const cached = await readCachedPriceIntelligence()
  if (isFresh(cached)) {
    return new Response(JSON.stringify(cached), { headers: jsonHeaders })
  }

  try {
    const payload = await buildPriceIntelligence()
    context.waitUntil(writeCachedPriceIntelligence(payload))
    return new Response(JSON.stringify(payload), { headers: jsonHeaders })
  } catch (error) {
    if (cached) {
      return new Response(
        JSON.stringify({
          ...cached,
          status: 'live',
          limitation: `${cached.limitation} Cached because the latest refresh failed.`,
        }),
        { headers: jsonHeaders },
      )
    }

    return new Response(
      JSON.stringify({
        status: 'error',
        lastCheckedAt: new Date().toISOString(),
        cadence: 'Official BLS/FRED PPI series are checked nightly on Netlify.',
        limitation:
          error instanceof Error ? error.message : 'Price intelligence could not be refreshed.',
        series: [],
      }),
      { headers: jsonHeaders, status: 502 },
    )
  }
}

export const config: Config = {
  path: '/api/price-intelligence',
  method: ['GET'],
}
