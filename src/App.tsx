import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowDownToLine,
  BadgeCheck,
  BarChart3,
  Calculator,
  CheckCircle2,
  Clock3,
  Clipboard,
  Database,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Gauge,
  Layers3,
  Leaf,
  Link2,
  LineChart,
  MapPin,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import './App.css'
import {
  categoryOrder,
  materials,
  materialsByCategory,
  sourceNotes,
  type Material,
  type MaterialCategory,
} from './data/materials'
import {
  compareRegionFit,
  getMaterialDossier,
  getRegionalAvailability,
  getRegionalPrice,
  getRegionFitScore,
  materialSearchText,
  regionPortfolioStats,
  regionProfiles,
} from './data/materialIntelligence'
import {
  buildDefaultScope,
  calculatePortfolio,
  createDecisionBrief,
  defaultProfile,
  defaultSettings,
  findLowestCarbonAlternative,
  formatCarbon,
  formatCurrency,
  formatPercent,
  getMaterial,
  multiplierForRegion,
  type ModelSettings,
  type LineResult,
  type PortfolioResult,
  type ProjectProfile,
  type ScopeLine,
} from './model/calculator'
import {
  buildCertificationSummary,
  type CertificationOpportunity,
  type CertificationSummary,
} from './model/certifications'

type CategoryFilter = MaterialCategory | 'All'
type PriceHealth = 'loading' | 'live' | 'fallback' | 'error'
type PresetId = 'commercial-core-shell' | 'interior-fitout' | 'residential-low-carbon' | 'civil-landscape'

interface PriceSeriesResult {
  seriesId: string
  label: string
  latestDate: string
  latestValue: number
  previousValue: number | null
  monthlyChangePercent: number | null
  sourceUrl: string
}

interface PriceIntelligence {
  status: PriceHealth
  lastCheckedAt: string
  cadence: string
  limitation: string
  series: PriceSeriesResult[]
}

interface ScenarioState {
  version: 1
  profile: ProjectProfile
  settings: ModelSettings
  lines: ScopeLine[]
  selectedMaterialId: string
}

interface ScenarioPreset {
  id: PresetId
  title: string
  summary: string
  profile: ProjectProfile
  settings?: Partial<ModelSettings>
  selectedMaterialId: string
}

const projectTypes: ProjectProfile['projectType'][] = [
  'Commercial core/shell',
  'Interior fit-out',
  'Residential',
  'Civil / landscape',
]

const structures: ProjectProfile['structure'][] = ['Hybrid timber', 'Concrete', 'Steel', 'Light wood']
const regions: ProjectProfile['region'][] = ['North America', 'Europe', 'Gulf / MENA', 'Latin America']
const climates: ProjectProfile['climate'][] = ['Temperate', 'Cold', 'Hot-humid', 'Hot-dry']
const stages: ProjectProfile['stage'][] = ['Concept', 'Schematic', 'Design development', 'Procurement']

const colors = ['#1f7a5c', '#e4a72c', '#356db6', '#b34d4d', '#6f5fb8', '#2f8d9b', '#8a6d3b']

const initialParams = new URLSearchParams(window.location.search)
const isEmbedMode = initialParams.get('embed') === '1'
const isCompactMode = isEmbedMode && initialParams.get('compact') === '1'
const shouldOpenReport = initialParams.get('report') === '1'

const fallbackPriceIntelligence: PriceIntelligence = {
  status: 'fallback',
  lastCheckedAt: 'Static build benchmark',
  cadence: 'Netlify production checks official PPI feeds nightly',
  limitation: 'Local preview uses static material estimates; production fetches official PPI index movement.',
  series: [],
}

const scenarioPresets: ScenarioPreset[] = [
  {
    id: 'commercial-core-shell',
    title: 'Commercial Core/Shell',
    summary: 'Hybrid structure, envelope, interiors, and bid-ready low-carbon alternates.',
    profile: {
      ...defaultProfile,
      name: 'Commercial low-carbon core/shell',
      projectType: 'Commercial core/shell',
      areaM2: 5000,
      levels: 6,
      structure: 'Hybrid timber',
      region: 'North America',
      climate: 'Temperate',
      stage: 'Schematic',
    },
    selectedMaterialId: 'amrize-ecotect',
  },
  {
    id: 'interior-fitout',
    title: 'Interior Fit-Out',
    summary: 'Fast tenant-improvement scan for gypsum, flooring, ceilings, paint, and MEP.',
    profile: {
      ...defaultProfile,
      name: 'Interior fit-out material strategy',
      projectType: 'Interior fit-out',
      areaM2: 2800,
      levels: 1,
      structure: 'Steel',
      region: 'Europe',
      climate: 'Temperate',
      stage: 'Design development',
    },
    settings: {
      contingencyPercent: 8,
    },
    selectedMaterialId: 'flooring-interface-cquest',
  },
  {
    id: 'residential-low-carbon',
    title: 'Residential Low-Carbon',
    summary: 'Light wood, lower-impact envelope, durable finishes, and storage-credit option.',
    profile: {
      ...defaultProfile,
      name: 'Residential low-carbon concept',
      projectType: 'Residential',
      areaM2: 850,
      levels: 3,
      structure: 'Light wood',
      region: 'North America',
      climate: 'Cold',
      stage: 'Concept',
    },
    settings: {
      includeBiogenicStorage: true,
      carbonPriceUsdPerTonne: 60,
    },
    selectedMaterialId: 'wood-tji-framing-system',
  },
  {
    id: 'civil-landscape',
    title: 'Civil / Landscape',
    summary: 'Hardscape, warm-mix asphalt, recycled aggregates, curbs, and rebar.',
    profile: {
      ...defaultProfile,
      name: 'Civil landscape low-carbon package',
      projectType: 'Civil / landscape',
      areaM2: 12000,
      levels: 1,
      structure: 'Concrete',
      region: 'Latin America',
      climate: 'Hot-humid',
      stage: 'Schematic',
    },
    settings: {
      transportDistanceKm: 80,
      contingencyPercent: 12,
    },
    selectedMaterialId: 'civil-warm-mix-rap',
  },
]

function isProjectType(value: unknown): value is ProjectProfile['projectType'] {
  return projectTypes.includes(value as ProjectProfile['projectType'])
}

function isStructure(value: unknown): value is ProjectProfile['structure'] {
  return structures.includes(value as ProjectProfile['structure'])
}

function isRegion(value: unknown): value is ProjectProfile['region'] {
  return regions.includes(value as ProjectProfile['region'])
}

function isClimate(value: unknown): value is ProjectProfile['climate'] {
  return climates.includes(value as ProjectProfile['climate'])
}

function isStage(value: unknown): value is ProjectProfile['stage'] {
  return stages.includes(value as ProjectProfile['stage'])
}

function isMaterialCategory(value: unknown): value is MaterialCategory {
  return categoryOrder.includes(value as MaterialCategory)
}

function sanitizeProfile(value: Partial<ProjectProfile> | undefined): ProjectProfile {
  return {
    name: typeof value?.name === 'string' && value.name.trim() ? value.name.slice(0, 80) : defaultProfile.name,
    projectType: isProjectType(value?.projectType) ? value.projectType : defaultProfile.projectType,
    areaM2: Math.max(1, Math.min(500_000, Number(value?.areaM2) || defaultProfile.areaM2)),
    levels: Math.max(1, Math.min(120, Math.round(Number(value?.levels) || defaultProfile.levels))),
    structure: isStructure(value?.structure) ? value.structure : defaultProfile.structure,
    region: isRegion(value?.region) ? value.region : defaultProfile.region,
    climate: isClimate(value?.climate) ? value.climate : defaultProfile.climate,
    stage: isStage(value?.stage) ? value.stage : defaultProfile.stage,
  }
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback
}

function sanitizeSettings(value: Partial<ModelSettings> | undefined, profile: ProjectProfile): ModelSettings {
  return {
    transportDistanceKm: boundedNumber(value?.transportDistanceKm, defaultSettings.transportDistanceKm, 0, 5000),
    freightKgCo2PerTonneKm: boundedNumber(value?.freightKgCo2PerTonneKm, defaultSettings.freightKgCo2PerTonneKm, 0, 1),
    regionCostMultiplier:
      value?.regionCostMultiplier === undefined
        ? multiplierForRegion(profile.region)
        : boundedNumber(value.regionCostMultiplier, multiplierForRegion(profile.region), 0.1, 5),
    includeBiogenicStorage: Boolean(value?.includeBiogenicStorage),
    carbonPriceUsdPerTonne: boundedNumber(value?.carbonPriceUsdPerTonne, defaultSettings.carbonPriceUsdPerTonne, 0, 2000),
    contingencyPercent: boundedNumber(value?.contingencyPercent, defaultSettings.contingencyPercent, 0, 100),
  }
}

function sanitizeLine(
  value: Partial<ScopeLine> | undefined,
  fallback: ScopeLine,
  region: ProjectProfile['region'],
): ScopeLine {
  const category = isMaterialCategory(value?.category) ? value.category : fallback.category
  const categoryMaterials = materialsByCategory[category]
  const baseline = typeof value?.baselineId === 'string' ? getSafeMaterial(value.baselineId) : undefined
  const baselineId = baseline && baseline.category === category ? baseline.id : categoryMaterials[0].id
  const baselineMaterial = getMaterial(baselineId)
  const alternative = typeof value?.alternativeId === 'string' ? getSafeMaterial(value.alternativeId) : undefined
  const alternativeId =
    alternative && alternative.category === category && alternative.unit === baselineMaterial.unit
      ? alternative.id
      : compatibleAlternative(category, baselineId, region).id

  return {
    id: typeof value?.id === 'string' && value.id.trim() ? value.id.slice(0, 80) : fallback.id,
    category,
    workPackage:
      typeof value?.workPackage === 'string' && value.workPackage.trim()
        ? value.workPackage.slice(0, 96)
        : fallback.workPackage,
    quantity: Math.max(0, Math.min(5_000_000, Number(value?.quantity) || fallback.quantity)),
    baselineId,
    alternativeId,
    quantityBasis:
      typeof value?.quantityBasis === 'string' && value.quantityBasis.trim()
        ? value.quantityBasis.slice(0, 120)
        : fallback.quantityBasis,
  }
}

function getSafeMaterial(id: string) {
  return materials.find((material) => material.id === id)
}

function encodeScenarioState(state: ScenarioState) {
  const json = JSON.stringify(state)
  return btoa(encodeURIComponent(json))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function decodeScenarioState(value: string | null) {
  if (!value) return null
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    const parsed = JSON.parse(decodeURIComponent(atob(padded))) as Partial<ScenarioState>
    const profile = sanitizeProfile(parsed.profile)
    const fallbackLines = buildDefaultScope(profile)
    const lines =
      Array.isArray(parsed.lines) && parsed.lines.length > 0
        ? parsed.lines.slice(0, 40).map((line, index) => sanitizeLine(line, fallbackLines[index] ?? fallbackLines[0], profile.region))
        : fallbackLines
    const settings = sanitizeSettings(parsed.settings, profile)
    const selectedMaterialId =
      typeof parsed.selectedMaterialId === 'string' && getSafeMaterial(parsed.selectedMaterialId)
        ? parsed.selectedMaterialId
        : lines[0]?.alternativeId ?? 'amrize-ecotect'

    return {
      profile,
      settings,
      lines,
      selectedMaterialId,
    }
  } catch {
    return null
  }
}

function compatibleAlternative(category: MaterialCategory, baselineId: string, region: ProjectProfile['region']) {
  const baseline = getMaterial(baselineId)
  const candidates = materialsByCategory[category].filter(
    (material) => material.id !== baselineId && material.unit === baseline.unit,
  )
  return candidates
    .filter((material) => getRegionalAvailability(material, region).status !== 'Not typical')
    .sort((a, b) => {
      const fitDelta = compareRegionFit(a, b, region)
      if (Math.abs(fitDelta) > 24) return fitDelta
      return a.gwpPerUnit - b.gwpPerUnit
    })[0] ?? baseline
}

const initialScenario = decodeScenarioState(initialParams.get('scenario'))

function App() {
  const [profile, setProfile] = useState<ProjectProfile>(initialScenario?.profile ?? defaultProfile)
  const [settings, setSettings] = useState<ModelSettings>(
    initialScenario?.settings ?? {
      ...defaultSettings,
      regionCostMultiplier: multiplierForRegion(defaultProfile.region),
    },
  )
  const [lines, setLines] = useState<ScopeLine[]>(() => initialScenario?.lines ?? buildDefaultScope(defaultProfile))
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [query, setQuery] = useState('')
  const [briefState, setBriefState] = useState('Copy brief')
  const [shareState, setShareState] = useState('Share scenario')
  const [scopeNeedsRefresh, setScopeNeedsRefresh] = useState(false)
  const [selectedMaterialId, setSelectedMaterialId] = useState(initialScenario?.selectedMaterialId ?? 'amrize-ecotect')
  const [showMethodology, setShowMethodology] = useState(false)
  const [showReport, setShowReport] = useState(shouldOpenReport)
  const [priceIntelligence, setPriceIntelligence] = useState<PriceIntelligence>({
    ...fallbackPriceIntelligence,
    status: 'loading',
    limitation: 'Checking official price-index feeds.',
  })

  const result = useMemo(() => calculatePortfolio(lines, settings, profile), [lines, settings, profile])
  const decisionBrief = useMemo(
    () => createDecisionBrief(profile, result, settings),
    [profile, result, settings],
  )
  const certificationSummary = useMemo(
    () => buildCertificationSummary(profile, result),
    [profile, result],
  )

  const hotspotData = useMemo(
    () =>
      result.lines
        .map((item) => ({
          name: item.line.workPackage,
          value: Math.max(item.baselineCarbon, 0),
          savings: item.carbonSavings,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 7),
    [result.lines],
  )

  const comparisonData = [
    { name: 'Baseline', carbon: result.baselineCarbon },
    { name: 'Proposed', carbon: result.alternativeCarbon },
  ]
  const maxComparisonCarbon = Math.max(...comparisonData.map((item) => item.carbon), 1)

  const filteredMaterials = materials
    .filter((material) => {
      const matchesCategory = categoryFilter === 'All' || material.category === categoryFilter
      return matchesCategory && materialSearchText(material).includes(query.toLowerCase())
    })
    .sort((a, b) => compareRegionFit(a, b, profile.region))

  const topRecommendations = [...result.lines]
    .filter((item) => item.carbonSavings > 0)
    .sort((a, b) => b.carbonSavings - a.carbonSavings)
    .slice(0, 5)
  const storyData = topRecommendations.slice(0, 6).map((item) => ({
    id: item.line.id,
    workPackage: item.line.workPackage,
    product: `${item.alternative.brand} - ${item.alternative.product}`,
    savings: item.carbonSavings,
  }))
  const maxStorySavings = Math.max(...storyData.map((item) => item.savings), 1)
  const leadRecommendation = topRecommendations[0]
  const costSignal =
    result.costSavings >= 0
      ? `${formatCurrency(result.costSavings)} saved`
      : `${formatCurrency(Math.abs(result.costSavings))} premium`
  const confidenceSignal =
    result.confidenceScore >= 78 ? 'High confidence' : result.confidenceScore >= 62 ? 'Decision-ready' : 'Needs EPD review'
  const activeMaterials = result.lines.flatMap((line) => [line.baseline, line.alternative])
  const regionalStats = regionPortfolioStats(activeMaterials, profile.region)
  const selectedMaterial = getMaterial(selectedMaterialId)
  const selectedDossier = getMaterialDossier(selectedMaterial)
  const selectedAvailability = getRegionalAvailability(selectedMaterial, profile.region)
  const selectedRegionalPrice = getRegionalPrice(selectedMaterial, profile.region, settings.regionCostMultiplier)
  const priceSeriesById = new Map(priceIntelligence.series.map((series) => [series.seriesId, series]))
  const strongestCertification = certificationSummary.opportunities[0]
  const reportUrl = `${window.location.origin}${window.location.pathname}?report=1&scenario=${encodeScenarioState({
    version: 1,
    profile,
    settings,
    lines,
    selectedMaterialId,
  })}`

  const profileCompleteness =
    62 +
    (profile.stage === 'Procurement' ? 18 : profile.stage === 'Design development' ? 12 : 6) +
    Math.min(20, Math.round(lines.length * 1.7))

  useEffect(() => {
    let active = true

    async function loadPriceIntelligence() {
      try {
        const response = await fetch('/api/price-intelligence')
        if (!response.ok) throw new Error(`Price intelligence unavailable: ${response.status}`)
        const data = (await response.json()) as PriceIntelligence
        if (active) setPriceIntelligence({ ...data, status: 'live' })
      } catch {
        if (active) setPriceIntelligence(fallbackPriceIntelligence)
      }
    }

    loadPriceIntelligence()
    return () => {
      active = false
    }
  }, [])

  function updateProfile<K extends keyof ProjectProfile>(key: K, value: ProjectProfile[K]) {
    const nextProfile = { ...profile, [key]: value }
    setProfile(nextProfile)
    if (key !== 'name') setScopeNeedsRefresh(true)

    if (key === 'region') {
      setSettings((current) => ({
        ...current,
        regionCostMultiplier: multiplierForRegion(value as ProjectProfile['region']),
      }))
    }
  }

  function regenerateScope() {
    setLines(buildDefaultScope(profile))
    setScopeNeedsRefresh(false)
  }

  function applyPreset(preset: ScenarioPreset) {
    const nextProfile = preset.profile
    const nextSettings = {
      ...defaultSettings,
      ...preset.settings,
      regionCostMultiplier: multiplierForRegion(nextProfile.region),
    }
    setProfile(nextProfile)
    setSettings(nextSettings)
    setLines(buildDefaultScope(nextProfile))
    setSelectedMaterialId(preset.selectedMaterialId)
    setScopeNeedsRefresh(false)
    setQuery('')
    setCategoryFilter('All')
  }

  function updateLine(lineId: string, patch: Partial<ScopeLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line

        if (patch.category && patch.category !== line.category) {
          const first = materialsByCategory[patch.category][0]
          const alternative = compatibleAlternative(patch.category, first.id, profile.region)
          return {
            ...line,
            ...patch,
            baselineId: first.id,
            alternativeId: alternative.id,
            quantityBasis: `Manual ${first.unit} quantity`,
          }
        }

        if (patch.baselineId) {
          const nextBaseline = getMaterial(patch.baselineId)
          const alternative = compatibleAlternative(line.category, patch.baselineId, profile.region)
          return {
            ...line,
            ...patch,
            alternativeId: alternative.id,
            quantityBasis: `Manual ${nextBaseline.unit} quantity`,
          }
        }

        return { ...line, ...patch }
      }),
    )
  }

  function addLine(category: MaterialCategory) {
    const baseline = materialsByCategory[category][0]
    const alternative = compatibleAlternative(category, baseline.id, profile.region)
    setLines((current) => [
      ...current,
      {
        id: `manual-${Date.now()}`,
        category,
        workPackage: `${category} package`,
        quantity: 100,
        baselineId: baseline.id,
        alternativeId: alternative.id,
        quantityBasis: `Manual ${baseline.unit} quantity`,
      },
    ])
  }

  function removeLine(lineId: string) {
    setLines((current) => current.filter((line) => line.id !== lineId))
  }

  async function copyBrief() {
    let copied: boolean
    try {
      await navigator.clipboard.writeText(decisionBrief)
      copied = true
    } catch {
      const fallback = document.createElement('textarea')
      fallback.value = decisionBrief
      fallback.setAttribute('readonly', 'true')
      fallback.style.position = 'fixed'
      fallback.style.left = '-9999px'
      document.body.append(fallback)
      fallback.select()
      copied = document.execCommand('copy')
      fallback.remove()
    }

    if (!copied) {
      const brief = document.querySelector('.brief')
      if (brief) {
        const range = document.createRange()
        range.selectNodeContents(brief)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }

    setBriefState(copied ? 'Copied' : 'Selected brief')
    window.setTimeout(() => setBriefState('Copy brief'), 1800)
  }

  function downloadCsv() {
    const rows = [
      [
        'Work package',
        'Category',
        'Quantity',
        'Unit',
        'Baseline',
        'Alternative',
        'Baseline kgCO2e',
        'Alternative kgCO2e',
        'Savings kgCO2e',
        'Baseline USD',
        'Alternative USD',
        'Cost savings USD',
      ],
      ...result.lines.map((item) => [
        item.line.workPackage,
        item.line.category,
        item.line.quantity.toString(),
        item.baseline.unit,
        item.baseline.product,
        item.alternative.product,
        item.baselineCarbon.toFixed(2),
        item.alternativeCarbon.toFixed(2),
        item.carbonSavings.toFixed(2),
        item.baselineCost.toFixed(2),
        item.alternativeCost.toFixed(2),
        item.costSavings.toFixed(2),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const url = URL.createObjectURL(new Blob([rows], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'shiftnode-co2-material-savings.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copyTextWithFallback(text: string, targetSelector?: string) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      const fallback = document.createElement('textarea')
      fallback.value = text
      fallback.setAttribute('readonly', 'true')
      fallback.style.position = 'fixed'
      fallback.style.left = '-9999px'
      document.body.append(fallback)
      fallback.select()
      const copied = document.execCommand('copy')
      fallback.remove()

      if (!copied && targetSelector) {
        const target = document.querySelector(targetSelector)
        if (target) {
          const range = document.createRange()
          range.selectNodeContents(target)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
        }
      }

      return copied
    }
  }

  async function shareScenario() {
    const scenario = encodeScenarioState({
      version: 1,
      profile,
      settings,
      lines,
      selectedMaterialId,
    })
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('scenario', scenario)
    const copied = await copyTextWithFallback(url.toString())
    setShareState(copied ? 'Copied link' : 'Link ready')
    window.history.replaceState(null, '', url)
    window.setTimeout(() => setShareState('Share scenario'), 1800)
  }

  function openReport() {
    setShowReport(true)
    window.history.replaceState(null, '', reportUrl)
  }

  function closeReport() {
    setShowReport(false)
    const url = new URL(window.location.href)
    url.searchParams.delete('report')
    window.history.replaceState(null, '', url)
  }

  return (
    <main className={['app-shell', isEmbedMode ? 'embed' : '', isCompactMode ? 'compact' : ''].filter(Boolean).join(' ')}>
      {!isEmbedMode && (
        <header className="topbar">
          <div>
            <p className="eyebrow">ShiftNode Digital</p>
            <h1>Material Carbon Lab</h1>
            <p className="topbar-copy">Design-grade embodied carbon decisions, priced and ready for procurement.</p>
            <div className="signal-pills" aria-label="Portfolio summary">
              <span>{materials.length} materials</span>
              <span>{categoryOrder.length} categories</span>
              <span>{result.lines.length} active packages</span>
              <span>{regionalStats.score}% region fit</span>
              <span>{priceIntelligence.status === 'live' ? 'PPI live' : 'Price fallback'}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" onClick={shareScenario} title="Copy shareable scenario link">
              <Link2 size={18} />
              <span>{shareState}</span>
            </button>
            <button className="icon-button" type="button" onClick={openReport} title="Open report">
              <Printer size={18} />
              <span>Report</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setShowMethodology((current) => !current)}
              title="View methodology"
            >
              <FileCheck2 size={18} />
              <span>Methodology</span>
            </button>
            <button className="icon-button" type="button" onClick={copyBrief} title="Copy decision brief">
              <Clipboard size={18} />
              <span>{briefState}</span>
            </button>
            <button className="icon-button primary" type="button" onClick={downloadCsv} title="Download CSV">
              <ArrowDownToLine size={18} />
              <span>CSV</span>
            </button>
          </div>
        </header>
      )}

      {!isCompactMode && (
        <section className="preset-strip" aria-label="Quick start scenarios">
          <div>
            <span className="eyebrow">Quick start</span>
            <h2>Start with a real project pattern</h2>
          </div>
          <div className="preset-actions">
            {scenarioPresets.map((preset) => (
              <button type="button" key={preset.id} onClick={() => applyPreset(preset)}>
                <strong>{preset.title}</strong>
                <span>{preset.summary}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="summary-grid">
        <Panel className="project-panel">
          <div className="panel-header">
            <SectionTitle icon={<Calculator size={18} />} label="Project" />
            <span className={scopeNeedsRefresh ? 'status-chip stale' : 'status-chip'}>
              {scopeNeedsRefresh ? 'Refresh needed' : 'Scenario synced'}
            </span>
          </div>
          <div className="project-fields">
            <label htmlFor="project-name">
              Name
              <input
                id="project-name"
                aria-label="Project name"
                value={profile.name}
                onChange={(event) => updateProfile('name', event.target.value)}
              />
            </label>
            <label htmlFor="project-type">
              Type
              <select
                id="project-type"
                aria-label="Project type"
                value={profile.projectType}
                onChange={(event) =>
                  updateProfile('projectType', event.target.value as ProjectProfile['projectType'])
                }
              >
                {projectTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label htmlFor="project-area">
              Area m2
              <input
                id="project-area"
                aria-label="Project area in square meters"
                type="number"
                min="1"
                value={profile.areaM2}
                onChange={(event) => updateProfile('areaM2', Number(event.target.value))}
              />
            </label>
            <label htmlFor="project-levels">
              Levels
              <input
                id="project-levels"
                aria-label="Project levels"
                type="number"
                min="1"
                value={profile.levels}
                onChange={(event) => updateProfile('levels', Number(event.target.value))}
              />
            </label>
            <label htmlFor="project-structure">
              Structure
              <select
                id="project-structure"
                aria-label="Structural system"
                value={profile.structure}
                onChange={(event) =>
                  updateProfile('structure', event.target.value as ProjectProfile['structure'])
                }
              >
                {structures.map((structure) => (
                  <option key={structure}>{structure}</option>
                ))}
              </select>
            </label>
            <label htmlFor="project-region">
              Region
              <select
                id="project-region"
                aria-label="Project region"
                value={profile.region}
                onChange={(event) => updateProfile('region', event.target.value as ProjectProfile['region'])}
              >
                {regions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            </label>
            <label htmlFor="project-climate">
              Climate
              <select
                id="project-climate"
                aria-label="Climate zone"
                value={profile.climate}
                onChange={(event) =>
                  updateProfile('climate', event.target.value as ProjectProfile['climate'])
                }
              >
                {climates.map((climate) => (
                  <option key={climate}>{climate}</option>
                ))}
              </select>
            </label>
            <label htmlFor="project-stage">
              Stage
              <select
                id="project-stage"
                aria-label="Project stage"
                value={profile.stage}
                onChange={(event) => updateProfile('stage', event.target.value as ProjectProfile['stage'])}
              >
                {stages.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="full-button" type="button" onClick={regenerateScope}>
            <RefreshCw size={16} />
            {scopeNeedsRefresh ? 'Refresh quantities' : 'Rebuild quantities'}
          </button>
        </Panel>

        <Panel className="results-panel">
          <SectionTitle icon={<Leaf size={18} />} label="Outcome" />
          <div className="metric-stack">
            <Metric label="Carbon saved" value={formatCarbon(result.carbonSavings)} accent="green" />
            <Metric label="Reduction" value={formatPercent(result.savingsPercent)} accent="gold" />
            <Metric label="Net value" value={formatCurrency(result.netValue)} accent="blue" />
          </div>
          <div className="mini-grid">
            <span>Baseline</span>
            <strong>{formatCarbon(result.baselineCarbon)}</strong>
            <span>Proposed</span>
            <strong>{formatCarbon(result.alternativeCarbon)}</strong>
            <span>Material cost</span>
            <strong>{formatCurrency(result.alternativeCost)}</strong>
            <span>Confidence</span>
            <strong>{result.confidenceScore.toFixed(0)} / 100</strong>
          </div>
        </Panel>

        <Panel className="chart-panel">
          <SectionTitle icon={<BarChart3 size={18} />} label="Carbon Compare" />
          <div className="compare-bars">
            {comparisonData.map((item) => (
              <div className="compare-row" key={item.name}>
                <div>
                  <span>{item.name}</span>
                  <strong>{formatCarbon(item.carbon)}</strong>
                </div>
                <i>
                  <b style={{ width: `${Math.max(8, (item.carbon / maxComparisonCarbon) * 100)}%` }} />
                </i>
              </div>
            ))}
            <div className="compare-delta">
              <Leaf size={16} />
              <span>{formatCarbon(result.carbonSavings)} avoided before operational energy.</span>
            </div>
            <div className="decision-pulse">
              <div>
                <span>Priority</span>
                <strong>{leadRecommendation?.line.workPackage ?? 'No positive move yet'}</strong>
              </div>
              <div>
                <span>Cost signal</span>
                <strong>{costSignal}</strong>
              </div>
              <div>
                <span>Reliability</span>
                <strong>{confidenceSignal}</strong>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="settings-panel">
          <SectionTitle icon={<Settings2 size={18} />} label="Model" />
          <label>
            Delivery km
            <input
              aria-label="Delivery distance kilometers"
              type="number"
              min="0"
              value={settings.transportDistanceKm}
              onChange={(event) =>
                setSettings((current) => ({ ...current, transportDistanceKm: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Carbon price $/t
            <input
              aria-label="Carbon price dollars per tonne"
              type="number"
              min="0"
              value={settings.carbonPriceUsdPerTonne}
              onChange={(event) =>
                setSettings((current) => ({ ...current, carbonPriceUsdPerTonne: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Cost factor
            <input
              aria-label="Regional cost factor"
              type="number"
              step="0.01"
              min="0.1"
              value={settings.regionCostMultiplier}
              onChange={(event) =>
                setSettings((current) => ({ ...current, regionCostMultiplier: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Contingency %
            <input
              aria-label="Cost contingency percent"
              type="number"
              min="0"
              value={settings.contingencyPercent}
              onChange={(event) =>
                setSettings((current) => ({ ...current, contingencyPercent: Number(event.target.value) }))
              }
            />
          </label>
          <label className="switch-row">
            <input
              aria-label="Include biogenic storage credit"
              type="checkbox"
              checked={settings.includeBiogenicStorage}
              onChange={(event) =>
                setSettings((current) => ({ ...current, includeBiogenicStorage: event.target.checked }))
              }
            />
            Storage credit
          </label>
          <div className="quality-meter">
            <Gauge size={16} />
            <span>{Math.min(100, profileCompleteness)}% captured</span>
          </div>
        </Panel>
      </section>

      <section className="strategy-grid">
        <Panel className="strategy-panel">
          <div className="panel-header">
            <SectionTitle icon={<Sparkles size={18} />} label="Executive Strategy" />
            <span className="status-chip">{strongestCertification?.fit ?? 'Screening'} certification fit</span>
          </div>
          <div className="strategy-lead">
            <strong>
              Prioritize {leadRecommendation?.alternative.family.toLowerCase() ?? 'verified low-carbon material substitutions'} for a {formatCarbon(result.carbonSavings)} savings signal.
            </strong>
            <span>
              The current scenario reduces embodied carbon by {formatPercent(result.savingsPercent)} with a {costSignal.toLowerCase()} and {regionalStats.weak} regional procurement watch item(s).
            </span>
          </div>
          <div className="strategy-moves">
            {topRecommendations.slice(0, 3).map((item, index) => (
              <article key={item.line.id}>
                <b>{index + 1}</b>
                <div>
                  <strong>{item.line.workPackage}</strong>
                  <span>{item.alternative.brand} - {item.alternative.product}</span>
                </div>
                <em>{formatCarbon(item.carbonSavings)}</em>
              </article>
            ))}
          </div>
        </Panel>

        <Panel className="story-panel">
          <SectionTitle icon={<Layers3 size={18} />} label="Carbon Savings Story" />
          <div className="impact-chart" aria-label="Ranked embodied carbon savings by work package">
            {storyData.map((item, index) => (
              <article key={item.id}>
                <b>{index + 1}</b>
                <div>
                  <strong>{item.workPackage}</strong>
                  <span>{item.product}</span>
                </div>
                <i>
                  <span style={{ width: `${Math.max(8, (item.savings / maxStorySavings) * 100)}%` }} />
                </i>
                <em>{formatCarbon(item.savings)}</em>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      {showMethodology && !isCompactMode && (
        <section className="methodology-drawer">
          <Panel>
            <div className="panel-header">
              <SectionTitle icon={<FileCheck2 size={18} />} label="Methodology" />
              <button type="button" className="icon-button" onClick={() => setShowMethodology(false)}>
                Close
              </button>
            </div>
            <div className="methodology-grid">
              <span><b>Carbon model</b>A1-A3 material values plus transport and optional biogenic storage credit.</span>
              <span><b>Price model</b>Editable benchmark costs adjusted by region and official PPI movement, not supplier quotes.</span>
              <span><b>Regional fit</b>Availability, lead-time risk, and product substitution reality by macro-region.</span>
              <span><b>Certification</b>Screening only; formal LEED, BREEAM, WELL, ILFI, or DGNB claims require assessor review.</span>
              <span><b>Confidence</b>EPD-led products score higher than manufacturer claims, benchmarks, or concept estimates.</span>
              <span><b>Last price check</b>{priceIntelligence.lastCheckedAt}</span>
            </div>
          </Panel>
        </section>
      )}

      <section className="intelligence-grid">
        <Panel className="market-panel">
          <div className="panel-header">
            <SectionTitle icon={<MapPin size={18} />} label="Regional Intelligence" />
            <span className="status-chip">{profile.region}</span>
          </div>
          <div className="region-score">
            <strong>{regionalStats.score}%</strong>
            <span>
              {regionalStats.preferredOrAvailable}/{regionalStats.total} selected products are preferred or available.
            </span>
          </div>
          <div className="intelligence-list">
            {regionProfiles[profile.region].marketNotes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
          <div className="market-warning">
            <AlertTriangle size={16} />
            <span>{regionProfiles[profile.region].procurementReality}</span>
          </div>
        </Panel>

        <Panel className="price-panel">
          <div className="panel-header">
            <SectionTitle icon={<Clock3 size={18} />} label="Price Intelligence" />
            <span className={priceIntelligence.status === 'live' ? 'status-chip' : 'status-chip stale'}>
              {priceIntelligence.status === 'live' ? 'Official feed' : 'Static fallback'}
            </span>
          </div>
          <div className="price-engine">
            <strong>{priceIntelligence.series.length || 6} tracked indexes</strong>
            <span>{priceIntelligence.cadence}</span>
            <small>Last check: {priceIntelligence.lastCheckedAt}</small>
          </div>
          <div className="price-series-list">
            {priceIntelligence.series.slice(0, 4).map((series) => (
              <a href={series.sourceUrl} target="_blank" rel="noreferrer" key={series.seriesId}>
                <span>{series.seriesId}</span>
                <strong>
                  {series.monthlyChangePercent === null
                    ? 'Index ready'
                    : `${series.monthlyChangePercent >= 0 ? '+' : ''}${series.monthlyChangePercent.toFixed(1)}%`}
                </strong>
              </a>
            ))}
            {priceIntelligence.series.length === 0 && (
              <span className="muted">{priceIntelligence.limitation}</span>
            )}
          </div>
          <p className="fine-print">{priceIntelligence.limitation}</p>
        </Panel>

        <Panel className="certification-panel">
          <div className="panel-header">
            <SectionTitle icon={<ShieldCheck size={18} />} label="Certification Fit" />
            <span className="status-chip">{certificationSummary.strongCount} strong</span>
          </div>
          <div className="certification-stack">
            {certificationSummary.opportunities.slice(0, 6).map((opportunity) => (
              <CertificationCard key={opportunity.system} opportunity={opportunity} />
            ))}
          </div>
          <div className="cert-evidence">
            <span>
              <FileCheck2 size={14} />
              {certificationSummary.epdReadyCount} EPD-ready products
            </span>
            <span>
              <PackageCheck size={14} />
              {certificationSummary.materialHealthWatchCount} health watch item(s)
            </span>
            <span>
              <CheckCircle2 size={14} />
              {certificationSummary.topEvidence[0]}
            </span>
          </div>
        </Panel>
      </section>

      <section className="workbench-grid">
        <Panel className="line-editor">
          <div className="panel-header">
            <SectionTitle icon={<LineChart size={18} />} label="Material Plan" />
            <div className="row-actions">
              <select
                aria-label="Add material category"
                onChange={(event) => {
                  addLine(event.target.value as MaterialCategory)
                  event.currentTarget.value = ''
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Add package
                </option>
                {categoryOrder.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <button className="icon-only" type="button" onClick={() => addLine('Concrete')} title="Add concrete package">
                <Plus size={17} />
              </button>
            </div>
          </div>

          <div className="scope-table">
            <div className="scope-head">
              <span>Package</span>
              <span>Quantity</span>
              <span>Baseline</span>
              <span>Alternative</span>
              <span>Savings</span>
              <span></span>
            </div>
            {result.lines.map((item) => {
              const baseline = item.baseline
              const alternatives = materialsByCategory[item.line.category].filter(
                (material) => material.unit === baseline.unit,
              )

              return (
                <div className="scope-row" key={item.line.id}>
                  <div className="package-cell">
                    <input
                      aria-label={`Work package name for ${item.line.workPackage}`}
                      title={item.line.workPackage}
                      value={item.line.workPackage}
                      onChange={(event) => updateLine(item.line.id, { workPackage: event.target.value })}
                    />
                    <select
                      aria-label={`Material category for ${item.line.workPackage}`}
                      value={item.line.category}
                      onChange={(event) =>
                        updateLine(item.line.id, { category: event.target.value as MaterialCategory })
                      }
                    >
                      {categoryOrder.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <label className="quantity-cell">
                    <input
                      aria-label={`Quantity for ${item.line.workPackage}`}
                      title={item.line.quantityBasis}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.line.quantity}
                      onChange={(event) => updateLine(item.line.id, { quantity: Number(event.target.value) })}
                    />
                    <span>{baseline.unit}</span>
                  </label>
                  <select
                    aria-label={`Baseline material for ${item.line.workPackage}`}
                    title={`${item.baseline.brand} - ${item.baseline.product}`}
                    value={item.line.baselineId}
                    onChange={(event) => updateLine(item.line.id, { baselineId: event.target.value })}
                  >
                    {materialsByCategory[item.line.category].map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.brand} - {material.product} ({getRegionalAvailability(material, profile.region).status})
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Alternative material for ${item.line.workPackage}`}
                    title={`${item.alternative.brand} - ${item.alternative.product}`}
                    value={item.line.alternativeId}
                    onChange={(event) => updateLine(item.line.id, { alternativeId: event.target.value })}
                  >
                    {alternatives.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.brand} - {material.product} ({getRegionalAvailability(material, profile.region).status})
                      </option>
                    ))}
                  </select>
                  <div className={item.carbonSavings >= 0 ? 'saving positive' : 'saving negative'}>
                    <strong>{formatCarbon(item.carbonSavings)}</strong>
                    <span>{formatCurrency(item.costSavings)}</span>
                    <small>{item.alternativeRegionStatus}</small>
                  </div>
                  <button
                    aria-label={`Remove ${item.line.workPackage}`}
                    className="icon-only danger"
                    type="button"
                    onClick={() => removeLine(item.line.id)}
                    title="Remove package"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        </Panel>

        <aside className="side-stack">
          <Panel>
            <SectionTitle icon={<Sparkles size={18} />} label="Best Moves" />
            <div className="recommendations">
              {topRecommendations.map((item) => (
                <div key={item.line.id} className="recommendation">
                  <div>
                    <strong>{item.line.workPackage}</strong>
                    <span>
                      {item.alternative.brand} {item.alternative.product}
                    </span>
                    <small>{item.alternativeRegionStatus} in {profile.region}</small>
                  </div>
                  <b>{formatCarbon(item.carbonSavings)}</b>
                </div>
              ))}
              {topRecommendations.length === 0 && <p className="muted">No positive substitutions yet.</p>}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={<Gauge size={18} />} label="Hotspots" />
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={hotspotData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={2}>
                  {hotspotData.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCarbon(Number(value ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="hotspot-list">
              {hotspotData.slice(0, 4).map((entry, index) => (
                <span key={entry.name}>
                  <i style={{ background: colors[index % colors.length] }} />
                  {entry.name}
                </span>
              ))}
            </div>
          </Panel>
        </aside>
      </section>

      <section className="portfolio-section">
        <Panel>
          <div className="panel-header">
            <SectionTitle icon={<Database size={18} />} label="Material Portfolio" />
            <div className="portfolio-tools">
              <label className="searchbox">
                <Search size={16} />
                <input
                  aria-label="Search material portfolio"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products, specs, tags"
                />
              </label>
              <label className="filterbox">
                <Filter size={16} />
                <select
                  aria-label="Filter material portfolio by category"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                >
                  <option>All</option>
                  {categoryOrder.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <MaterialDossierPanel
            material={selectedMaterial}
            dossier={selectedDossier}
            availability={selectedAvailability}
            region={profile.region}
            regionalPrice={selectedRegionalPrice}
            priceSeries={priceSeriesById.get(selectedDossier.priceSignal.seriesId)}
          />

          <div className="material-grid">
            {filteredMaterials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                region={profile.region}
                selected={material.id === selectedMaterialId}
                onSelect={() => setSelectedMaterialId(material.id)}
              />
            ))}
          </div>
        </Panel>
      </section>

      {!isEmbedMode && (
        <section className="cta-band">
          <div>
            <span className="eyebrow">ShiftNode Digital</span>
            <strong>Want this material strategy adapted to a real project?</strong>
            <p>Use this scenario as a starting point, then bring ShiftNode into the design conversation for a project-specific low-carbon roadmap.</p>
          </div>
          <a href="mailto:hello@shiftnode.digital?subject=Material%20Carbon%20Lab%20Project%20Strategy">
            Start a project conversation
            <ArrowRight size={16} />
          </a>
        </section>
      )}

      <section className="brief-grid">
        <Panel>
          <SectionTitle icon={<FileText size={18} />} label="Decision Brief" />
          <pre className="brief">{decisionBrief}</pre>
          <div className="brief-actions">
            <button type="button" className="icon-button" onClick={copyBrief}>
              <Clipboard size={18} />
              <span>{briefState === 'Copied' ? 'Copied' : 'Copy brief'}</span>
            </button>
            <button type="button" className="icon-button" onClick={downloadCsv}>
              <ArrowDownToLine size={18} />
              <span>Download CSV</span>
            </button>
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={<BadgeCheck size={18} />} label="Data Sources" />
          <div className="source-list">
            {sourceNotes.map((note) => (
              <a href={note.url} target="_blank" rel="noreferrer" key={note.label}>
                <strong>
                  {note.label}
                  <ExternalLink size={14} />
                </strong>
                <span>{note.detail}</span>
              </a>
            ))}
          </div>
        </Panel>
      </section>

      {showReport && (
        <ReportOverlay
          profile={profile}
          result={result}
          topRecommendations={topRecommendations}
          certificationSummary={certificationSummary}
          regionalStats={regionalStats}
          priceIntelligence={priceIntelligence}
          onClose={closeReport}
        />
      )}
    </main>
  )
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>
}

function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="section-title">
      {icon}
      <h2>{label}</h2>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`metric ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ReportOverlay({
  profile,
  result,
  topRecommendations,
  certificationSummary,
  regionalStats,
  priceIntelligence,
  onClose,
}: {
  profile: ProjectProfile
  result: PortfolioResult
  topRecommendations: LineResult[]
  certificationSummary: CertificationSummary
  regionalStats: ReturnType<typeof regionPortfolioStats>
  priceIntelligence: PriceIntelligence
  onClose: () => void
}) {
  return (
    <div className="report-overlay" role="dialog" aria-modal="true" aria-label="Low carbon material strategy report">
      <article className="report-sheet">
        <header className="report-header">
          <div>
            <span className="eyebrow">ShiftNode Digital</span>
            <h2>Low Carbon Material Strategy</h2>
            <p>{profile.name}</p>
          </div>
          <div className="report-actions">
            <button type="button" className="icon-button" onClick={() => window.print()}>
              <Printer size={17} />
              Print / PDF
            </button>
            <button type="button" className="icon-button" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <section className="report-metrics">
          <span><b>{formatCarbon(result.carbonSavings)}</b>Embodied carbon avoided</span>
          <span><b>{formatPercent(result.savingsPercent)}</b>Reduction signal</span>
          <span><b>{formatCurrency(result.netValue)}</b>Net value signal</span>
          <span><b>{regionalStats.score}%</b>Regional fit</span>
        </section>

        <section className="report-section">
          <h3>Project Snapshot</h3>
          <p>
            {profile.projectType}, {profile.areaM2.toLocaleString()} m2, {profile.levels} level(s), {profile.structure}, {profile.region}, {profile.stage}.
          </p>
        </section>

        <section className="report-section">
          <h3>Recommended Material Moves</h3>
          <div className="report-table">
            {topRecommendations.slice(0, 6).map((item) => (
              <div key={item.line.id}>
                <strong>{item.line.workPackage}</strong>
                <span>{item.baseline.product}</span>
                <span>{item.alternative.product}</span>
                <b>{formatCarbon(item.carbonSavings)}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="report-section">
          <h3>Certification Opportunities</h3>
          <div className="report-certs">
            {certificationSummary.opportunities.slice(0, 5).map((opportunity) => (
              <span key={opportunity.system}>
                <b>{opportunity.system}</b>
                {opportunity.fit} - {opportunity.score}/100
              </span>
            ))}
          </div>
        </section>

        <section className="report-section">
          <h3>Evidence Checklist</h3>
          <ul>
            {certificationSummary.topEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
            <li>Supplier quotes tied to exact product, region, quantity, and bid package.</li>
            <li>Product-specific EPDs and source URLs for high-carbon substitutions.</li>
            <li>Assessor review before formal LEED, BREEAM, WELL, ILFI, or DGNB claims.</li>
          </ul>
        </section>

        <section className="report-section report-assumptions">
          <h3>Assumptions</h3>
          <p>
            Pricing uses editable concept benchmarks and official PPI index signals. Last price check: {priceIntelligence.lastCheckedAt}. This report is a screening artifact and should be validated with supplier quotes, project-specific quantities, and assessor review.
          </p>
        </section>
      </article>
    </div>
  )
}

function CertificationCard({ opportunity }: { opportunity: CertificationOpportunity }) {
  return (
    <article className={`cert-card ${opportunity.fit.toLowerCase()}`}>
      <div>
        <strong>{opportunity.system}</strong>
        <span>{opportunity.pathway}</span>
      </div>
      <b>{opportunity.score}</b>
      <small>{opportunity.fit}</small>
    </article>
  )
}

function MaterialDossierPanel({
  material,
  dossier,
  availability,
  region,
  regionalPrice,
  priceSeries,
}: {
  material: Material
  dossier: ReturnType<typeof getMaterialDossier>
  availability: ReturnType<typeof getRegionalAvailability>
  region: ProjectProfile['region']
  regionalPrice: number
  priceSeries?: PriceSeriesResult
}) {
  return (
    <article className="dossier">
      <div className="dossier-main">
        <div>
          <span className="eyebrow">Technical dossier</span>
          <h3>{material.product}</h3>
          <p>{material.brand} - {material.category} - {dossier.evidenceLevel}</p>
        </div>
        <div className="dossier-score">
          <strong>{getRegionFitScore(material, region)}%</strong>
          <span>{availability.status}</span>
        </div>
      </div>
      <div className="dossier-metrics">
        <span>
          <b>{material.gwpPerUnit}</b>
          {material.gwpUnit}
        </span>
        <span>
          <b>{formatCurrency(regionalPrice)}</b>
          regional / {material.unit}
        </span>
        <span>
          <b>{dossier.reductionRangePercent.map((value) => `${Math.round(value)}%`).join(' to ')}</b>
          modeled reduction range
        </span>
        <span>
          <b>{dossier.redListRisk}</b>
          material-health risk
        </span>
      </div>
      <div className="dossier-columns">
        <DossierBlock title="Specs" items={dossier.technicalSpecs.slice(0, 6)} />
        <DossierBlock title="Evidence" items={dossier.submittals.slice(0, 5)} />
        <DossierBlock title="Questions" items={dossier.procurementQuestions.slice(0, 5)} />
      </div>
      <div className="dossier-footer">
        <span>
          <MapPin size={14} />
          {availability.notes}
        </span>
        <span>
          <Clock3 size={14} />
          {availability.leadTimeWeeks[0]}-{availability.leadTimeWeeks[1]} week lead signal
        </span>
        <a href={dossier.priceSignal.sourceUrl} target="_blank" rel="noreferrer">
          {priceSeries
            ? `${priceSeries.seriesId}: ${priceSeries.latestDate}`
            : dossier.priceSignal.label}
          <ExternalLink size={13} />
        </a>
      </div>
    </article>
  )
}

function DossierBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function MaterialCard({
  material,
  region,
  selected,
  onSelect,
}: {
  material: Material
  region: ProjectProfile['region']
  selected: boolean
  onSelect: () => void
}) {
  const bestSwap = findLowestCarbonAlternative(material.category, material.id, region)
  const dossier = getMaterialDossier(material)
  const availability = getRegionalAvailability(material, region)
  return (
    <article className={selected ? 'material-card selected' : 'material-card'}>
      <div className="material-top">
        <span className={`role ${material.climateRole.toLowerCase().replaceAll(' ', '-')}`}>
          {material.climateRole}
        </span>
        <span>{availability.status}</span>
      </div>
      <h3>{material.product}</h3>
      <p>{material.brand}</p>
      <div className="material-stats">
        <span>
          <b>{material.gwpPerUnit}</b>
          {material.gwpUnit}
        </span>
        <span>
          <b>{Math.round(getRegionFitScore(material, region))}%</b>
          region fit
        </span>
      </div>
      <ul>
        {dossier.technicalSpecs.slice(0, 3).map((spec) => (
          <li key={spec}>{spec}</li>
        ))}
      </ul>
      <div className="card-chips">
        {dossier.certificationSignals.slice(0, 3).map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </div>
      <div className="material-footer">
        <a href={material.sourceUrl} target="_blank" rel="noreferrer">
          Source
          <ExternalLink size={13} />
        </a>
        <button type="button" onClick={onSelect} aria-label={`Review ${material.product}`}>
          Review
        </button>
        {bestSwap && bestSwap.id !== material.id && <span>Lowest: {bestSwap.product}</span>}
      </div>
    </article>
  )
}

export default App
