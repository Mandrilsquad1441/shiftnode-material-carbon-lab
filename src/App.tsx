import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
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
  Leaf,
  LineChart,
  MapPin,
  PackageCheck,
  Plus,
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
  type ProjectProfile,
  type ScopeLine,
} from './model/calculator'
import { buildCertificationSummary, type CertificationOpportunity } from './model/certifications'

type CategoryFilter = MaterialCategory | 'All'
type PriceHealth = 'loading' | 'live' | 'fallback' | 'error'

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

const isEmbedMode = new URLSearchParams(window.location.search).get('embed') === '1'

const fallbackPriceIntelligence: PriceIntelligence = {
  status: 'fallback',
  lastCheckedAt: 'Static build benchmark',
  cadence: 'Netlify production checks official PPI feeds nightly',
  limitation: 'Local preview uses static material estimates; production fetches official PPI index movement.',
  series: [],
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

function App() {
  const [profile, setProfile] = useState<ProjectProfile>(defaultProfile)
  const [settings, setSettings] = useState<ModelSettings>({
    ...defaultSettings,
    regionCostMultiplier: multiplierForRegion(defaultProfile.region),
  })
  const [lines, setLines] = useState<ScopeLine[]>(() => buildDefaultScope(defaultProfile))
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [query, setQuery] = useState('')
  const [briefState, setBriefState] = useState('Copy brief')
  const [scopeNeedsRefresh, setScopeNeedsRefresh] = useState(false)
  const [selectedMaterialId, setSelectedMaterialId] = useState('amrize-ecotect')
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

  return (
    <main className={isEmbedMode ? 'app-shell embed' : 'app-shell'}>
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
          <div className="embed-snippet">
            <strong>Embed</strong>
            <code>{`<iframe src="${window.location.origin}${window.location.pathname}?embed=1" title="ShiftNode Material Carbon Lab"></iframe>`}</code>
          </div>
        </Panel>
      </section>
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
