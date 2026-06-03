import type { Config } from '@netlify/functions'
import { buildPriceIntelligence, writeCachedPriceIntelligence } from './_shared/price-intelligence'

export default async () => {
  const payload = await buildPriceIntelligence()
  await writeCachedPriceIntelligence(payload)

  return new Response(
    JSON.stringify({
      refreshedAt: payload.lastCheckedAt,
      seriesCount: payload.series.length,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

export const config: Config = {
  schedule: '@daily',
}
