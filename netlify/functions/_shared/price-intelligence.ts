import { getStore } from '@netlify/blobs'

export interface PriceSeriesDefinition {
  seriesId: string
  label: string
  appliesTo: string[]
  sourceUrl: string
}

export interface PriceSeriesResult extends PriceSeriesDefinition {
  latestDate: string
  latestValue: number
  previousValue: number | null
  monthlyChangePercent: number | null
}

export interface PriceIntelligencePayload {
  status: 'live'
  lastCheckedAt: string
  cadence: string
  limitation: string
  series: PriceSeriesResult[]
}

export const priceSeriesCatalog: PriceSeriesDefinition[] = [
  {
    seriesId: 'PCU327320327320',
    label: 'Ready-mix concrete manufacturing',
    appliesTo: ['Concrete'],
    sourceUrl: 'https://fred.stlouisfed.org/data/PCU327320327320',
  },
  {
    seriesId: 'WPS1322',
    label: 'Cement, hydraulic',
    appliesTo: ['Cement'],
    sourceUrl: 'https://fred.stlouisfed.org/data/WPS1322',
  },
  {
    seriesId: 'WPU1017',
    label: 'Steel mill products',
    appliesTo: ['Steel', 'Facade', 'Roofing'],
    sourceUrl: 'https://fred.stlouisfed.org/data/WPU1017',
  },
  {
    seriesId: 'WPS0811',
    label: 'Softwood lumber',
    appliesTo: ['Mass timber', 'Wood framing'],
    sourceUrl: 'https://fred.stlouisfed.org/data/WPS0811',
  },
  {
    seriesId: 'WPU1371',
    label: 'Gypsum products',
    appliesTo: ['Gypsum', 'Ceilings'],
    sourceUrl: 'https://fred.stlouisfed.org/data/WPU1371',
  },
  {
    seriesId: 'WPU0721',
    label: 'Plastic construction products',
    appliesTo: ['Insulation', 'Roofing', 'Flooring', 'MEP'],
    sourceUrl: 'https://fred.stlouisfed.org/data/WPU0721',
  },
]

const cacheKey = 'latest'
const cacheTtlMs = 18 * 60 * 60 * 1000

function parseFredDataPage(html: string, definition: PriceSeriesDefinition): PriceSeriesResult {
  const anchorMatches = [...html.matchAll(/#(\d{4}-\d{2}-\d{2})\|(-?\d+(?:\.\d+)?)/g)]
  const tableMatches = [
    ...html.matchAll(
      /<th[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/th>\s*<td[^>]*>\s*(-?\d+(?:\.\d+)?)\s*<\/td>/g,
    ),
  ]
  const byDate = new Map<string, number>()

  ;[...anchorMatches, ...tableMatches].forEach((match) => {
    byDate.set(match[1], Number(match[2]))
  })

  const values = [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const latest = values.at(-1)
  if (!latest) {
    throw new Error(`No numeric table data returned for ${definition.seriesId}`)
  }

  const previous = values.at(-2)
  const monthlyChangePercent =
    previous && previous.value !== 0 ? ((latest.value - previous.value) / previous.value) * 100 : null

  return {
    ...definition,
    latestDate: latest.date,
    latestValue: latest.value,
    previousValue: previous?.value ?? null,
    monthlyChangePercent,
  }
}

async function fetchSeries(definition: PriceSeriesDefinition) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(
      `https://fred.stlouisfed.org/data/${definition.seriesId}`,
      { signal: controller.signal },
    )
    if (!response.ok) throw new Error(`${definition.seriesId} returned ${response.status}`)
    return parseFredDataPage(await response.text(), definition)
  } finally {
    clearTimeout(timeout)
  }
}

export async function buildPriceIntelligence(): Promise<PriceIntelligencePayload> {
  const settled = await Promise.allSettled(priceSeriesCatalog.map((definition) => fetchSeries(definition)))
  const series = settled
    .filter((result): result is PromiseFulfilledResult<PriceSeriesResult> => result.status === 'fulfilled')
    .map((result) => result.value)

  if (series.length === 0) {
    throw new Error('No official price-index series could be fetched')
  }

  return {
    status: 'live',
    lastCheckedAt: new Date().toISOString(),
    cadence: 'Official BLS/FRED PPI series are checked nightly on Netlify and refreshed on demand when stale.',
    limitation:
      'Indexes track market movement, not exact supplier quotes. Users should still request current local quotes for procurement.',
    series,
  }
}

export async function readCachedPriceIntelligence() {
  try {
    const store = getStore({ name: 'price-intelligence', consistency: 'strong' })
    const cached = await store.get(cacheKey, { type: 'json' })
    if (!cached) return null
    return cached as PriceIntelligencePayload
  } catch {
    return null
  }
}

export function isFresh(payload: PriceIntelligencePayload | null) {
  if (!payload) return false
  const hasUsableCoverage = payload.series.length >= Math.min(4, priceSeriesCatalog.length)
  const hasCurrentCatalog = priceSeriesCatalog.every((definition) =>
    payload.series.some((series) => series.seriesId === definition.seriesId),
  )
  return (
    hasUsableCoverage &&
    hasCurrentCatalog &&
    Date.now() - new Date(payload.lastCheckedAt).getTime() < cacheTtlMs
  )
}

export async function writeCachedPriceIntelligence(payload: PriceIntelligencePayload) {
  try {
    const store = getStore({ name: 'price-intelligence', consistency: 'strong' })
    await store.setJSON(cacheKey, payload, {
      metadata: {
        updatedAt: payload.lastCheckedAt,
        seriesCount: String(payload.series.length),
      },
    })
  } catch {
    // Blobs are a production cache enhancement. The API can still return fresh data without cache.
  }
}
