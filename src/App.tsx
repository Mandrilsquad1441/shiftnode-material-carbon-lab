import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDownToLine,
  BadgeCheck,
  BarChart3,
  Calculator,
  Clipboard,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Gauge,
  Leaf,
  LineChart,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

type CategoryFilter = MaterialCategory | 'All'

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

function compatibleAlternative(category: MaterialCategory, baselineId: string) {
  const baseline = getMaterial(baselineId)
  const candidates = materialsByCategory[category].filter(
    (material) => material.id !== baselineId && material.unit === baseline.unit,
  )
  return candidates.sort((a, b) => a.gwpPerUnit - b.gwpPerUnit)[0] ?? baseline
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
  const [briefState, setBriefState] = useState('Ready')

  const result = useMemo(() => calculatePortfolio(lines, settings), [lines, settings])
  const decisionBrief = useMemo(
    () => createDecisionBrief(profile, result, settings),
    [profile, result, settings],
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
    { name: 'Baseline', carbon: result.baselineCarbon / 1000 },
    { name: 'Proposed', carbon: result.alternativeCarbon / 1000 },
  ]

  const filteredMaterials = materials.filter((material) => {
    const matchesCategory = categoryFilter === 'All' || material.category === categoryFilter
    const searchText = `${material.brand} ${material.product} ${material.family} ${material.tags.join(' ')}`.toLowerCase()
    return matchesCategory && searchText.includes(query.toLowerCase())
  })

  const topRecommendations = [...result.lines]
    .filter((item) => item.carbonSavings > 0)
    .sort((a, b) => b.carbonSavings - a.carbonSavings)
    .slice(0, 5)

  const profileCompleteness =
    62 +
    (profile.stage === 'Procurement' ? 18 : profile.stage === 'Design development' ? 12 : 6) +
    Math.min(20, Math.round(lines.length * 1.7))

  function updateProfile<K extends keyof ProjectProfile>(key: K, value: ProjectProfile[K]) {
    const nextProfile = { ...profile, [key]: value }
    setProfile(nextProfile)

    if (key === 'region') {
      setSettings((current) => ({
        ...current,
        regionCostMultiplier: multiplierForRegion(value as ProjectProfile['region']),
      }))
    }
  }

  function regenerateScope() {
    setLines(buildDefaultScope(profile))
  }

  function updateLine(lineId: string, patch: Partial<ScopeLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line

        if (patch.category && patch.category !== line.category) {
          const first = materialsByCategory[patch.category][0]
          const alternative = compatibleAlternative(patch.category, first.id)
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
          const alternative = compatibleAlternative(line.category, patch.baselineId)
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
    const alternative = compatibleAlternative(category, baseline.id)
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
    await navigator.clipboard.writeText(decisionBrief)
    setBriefState('Copied')
    window.setTimeout(() => setBriefState('Ready'), 1800)
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
          <SectionTitle icon={<Calculator size={18} />} label="Project" />
          <div className="project-fields">
            <label>
              Name
              <input
                value={profile.name}
                onChange={(event) => updateProfile('name', event.target.value)}
              />
            </label>
            <label>
              Type
              <select
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
            <label>
              Area m2
              <input
                type="number"
                min="1"
                value={profile.areaM2}
                onChange={(event) => updateProfile('areaM2', Number(event.target.value))}
              />
            </label>
            <label>
              Levels
              <input
                type="number"
                min="1"
                value={profile.levels}
                onChange={(event) => updateProfile('levels', Number(event.target.value))}
              />
            </label>
            <label>
              Structure
              <select
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
            <label>
              Region
              <select
                value={profile.region}
                onChange={(event) => updateProfile('region', event.target.value as ProjectProfile['region'])}
              >
                {regions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            </label>
            <label>
              Climate
              <select
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
            <label>
              Stage
              <select
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
            Rebuild quantities
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
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [Number(value ?? 0).toFixed(1), 'tCO2e']} />
              <Bar dataKey="carbon" fill="#1f7a5c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel className="settings-panel">
          <SectionTitle icon={<Settings2 size={18} />} label="Model" />
          <label>
            Delivery km
            <input
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
                      title={item.line.workPackage}
                      value={item.line.workPackage}
                      onChange={(event) => updateLine(item.line.id, { workPackage: event.target.value })}
                    />
                    <select
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
                    title={`${item.baseline.brand} - ${item.baseline.product}`}
                    value={item.line.baselineId}
                    onChange={(event) => updateLine(item.line.id, { baselineId: event.target.value })}
                  >
                    {materialsByCategory[item.line.category].map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.brand} - {material.product}
                      </option>
                    ))}
                  </select>
                  <select
                    title={`${item.alternative.brand} - ${item.alternative.product}`}
                    value={item.line.alternativeId}
                    onChange={(event) => updateLine(item.line.id, { alternativeId: event.target.value })}
                  >
                    {alternatives.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.brand} - {material.product}
                      </option>
                    ))}
                  </select>
                  <div className={item.carbonSavings >= 0 ? 'saving positive' : 'saving negative'}>
                    <strong>{formatCarbon(item.carbonSavings)}</strong>
                    <span>{formatCurrency(item.costSavings)}</span>
                  </div>
                  <button className="icon-only danger" type="button" onClick={() => removeLine(item.line.id)} title="Remove package">
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
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products, specs, tags"
                />
              </label>
              <label className="filterbox">
                <Filter size={16} />
                <select
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

          <div className="material-grid">
            {filteredMaterials.map((material) => (
              <MaterialCard key={material.id} material={material} />
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

function MaterialCard({ material }: { material: Material }) {
  const bestSwap = findLowestCarbonAlternative(material.category, material.id)
  return (
    <article className="material-card">
      <div className="material-top">
        <span className={`role ${material.climateRole.toLowerCase().replaceAll(' ', '-')}`}>
          {material.climateRole}
        </span>
        <span>{material.confidence}</span>
      </div>
      <h3>{material.product}</h3>
      <p>{material.brand}</p>
      <div className="material-stats">
        <span>
          <b>{material.gwpPerUnit}</b>
          {material.gwpUnit}
        </span>
        <span>
          <b>{formatCurrency(material.priceUsd)}</b>
          per {material.unit}
        </span>
      </div>
      <ul>
        {material.specs.slice(0, 3).map((spec) => (
          <li key={spec}>{spec}</li>
        ))}
      </ul>
      <div className="material-footer">
        <a href={material.sourceUrl} target="_blank" rel="noreferrer">
          Source
          <ExternalLink size={13} />
        </a>
        {bestSwap && bestSwap.id !== material.id && <span>Lowest: {bestSwap.product}</span>}
      </div>
    </article>
  )
}

export default App
