import { materials, materialsByCategory, type Material, type MaterialCategory } from '../data/materials'

export interface ProjectProfile {
  name: string
  projectType: 'Commercial core/shell' | 'Interior fit-out' | 'Residential' | 'Civil / landscape'
  areaM2: number
  levels: number
  structure: 'Concrete' | 'Steel' | 'Hybrid timber' | 'Light wood'
  region: 'North America' | 'Europe' | 'Gulf / MENA' | 'Latin America'
  climate: 'Cold' | 'Temperate' | 'Hot-humid' | 'Hot-dry'
  stage: 'Concept' | 'Schematic' | 'Design development' | 'Procurement'
}

export interface ModelSettings {
  transportDistanceKm: number
  freightKgCo2PerTonneKm: number
  regionCostMultiplier: number
  includeBiogenicStorage: boolean
  carbonPriceUsdPerTonne: number
  contingencyPercent: number
}

export interface ScopeLine {
  id: string
  category: MaterialCategory
  workPackage: string
  quantity: number
  baselineId: string
  alternativeId: string
  quantityBasis: string
}

export interface LineResult {
  line: ScopeLine
  baseline: Material
  alternative: Material
  baselineCarbon: number
  alternativeCarbon: number
  baselineCost: number
  alternativeCost: number
  carbonSavings: number
  costSavings: number
  baselineTransport: number
  alternativeTransport: number
  baselineStorageCredit: number
  alternativeStorageCredit: number
  confidenceScore: number
}

export interface PortfolioResult {
  lines: LineResult[]
  baselineCarbon: number
  alternativeCarbon: number
  carbonSavings: number
  savingsPercent: number
  baselineCost: number
  alternativeCost: number
  costSavings: number
  carbonPriceValue: number
  netValue: number
  confidenceScore: number
}

export const defaultProfile: ProjectProfile = {
  name: 'ShiftNode low-carbon concept',
  projectType: 'Commercial core/shell',
  areaM2: 5000,
  levels: 6,
  structure: 'Hybrid timber',
  region: 'North America',
  climate: 'Temperate',
  stage: 'Schematic',
}

export const defaultSettings: ModelSettings = {
  transportDistanceKm: 120,
  freightKgCo2PerTonneKm: 0.096,
  regionCostMultiplier: 1,
  includeBiogenicStorage: false,
  carbonPriceUsdPerTonne: 75,
  contingencyPercent: 10,
}

const confidenceWeight: Record<Material['confidence'], number> = {
  'EPD-led': 100,
  'Manufacturer-led': 82,
  Benchmark: 68,
  Estimate: 48,
}

const regionCost: Record<ProjectProfile['region'], number> = {
  'North America': 1,
  Europe: 1.08,
  'Gulf / MENA': 1.18,
  'Latin America': 0.86,
}

export function multiplierForRegion(region: ProjectProfile['region']) {
  return regionCost[region]
}

export function getMaterial(id: string) {
  const material = materials.find((item) => item.id === id)
  if (!material) {
    throw new Error(`Unknown material id: ${id}`)
  }
  return material
}

function makeLine(
  id: string,
  category: MaterialCategory,
  workPackage: string,
  quantity: number,
  baselineId: string,
  alternativeId: string,
  quantityBasis: string,
): ScopeLine {
  return {
    id,
    category,
    workPackage,
    quantity: Number(quantity.toFixed(3)),
    baselineId,
    alternativeId,
    quantityBasis,
  }
}

export function buildDefaultScope(profile: ProjectProfile): ScopeLine[] {
  const area = Math.max(profile.areaM2, 1)
  const roofArea = area / Math.max(profile.levels, 1)
  const envelopeFactor = profile.projectType === 'Residential' ? 0.82 : 0.62
  const interiorWallFactor = profile.projectType === 'Interior fit-out' ? 2.85 : 1.65
  const flooringFactor = profile.projectType === 'Civil / landscape' ? 0 : 0.92

  if (profile.projectType === 'Interior fit-out') {
    return [
      makeLine('fitout-gypsum', 'Gypsum', 'Partitions and ceilings', area * 2.85, 'gypsum-standard-5-8', 'usg-ecosmart-typex', 'Area x partition intensity'),
      makeLine('fitout-floor', 'Flooring', 'Finish flooring', area * 0.92, 'flooring-lvt', 'flooring-interface-cquest', 'Net usable floor area'),
      makeLine('fitout-ceiling', 'Ceilings', 'Acoustic ceiling system', area * 0.82, 'ceiling-acoustic-mineral-fiber', 'ceiling-felt-baffles', 'Ceiling coverage'),
      makeLine('fitout-paint', 'Coatings', 'Painted surfaces', area * 2.2, 'paint-standard-low-voc', 'paint-mineral-silicate', 'Wall area two-coat basis'),
      makeLine('fitout-insulation', 'Insulation', 'Acoustic/thermal cavity insulation', area * 0.35, 'insulation-fiberglass-batt', 'insulation-cellulose-densepack', 'Selective insulated partition area'),
      makeLine('fitout-mep', 'MEP', 'Plumbing pipe allowance', area * 0.08, 'mep-copper-pipe', 'mep-pex-pipe', 'MEP kg allowance from area'),
    ]
  }

  if (profile.projectType === 'Civil / landscape') {
    return [
      makeLine('civil-asphalt', 'Civil', 'Parking and drive paving', area * 0.16, 'civil-asphalt-hma', 'civil-warm-mix-rap', '160 kg asphalt per m2 of hardscape'),
      makeLine('civil-base', 'Civil', 'Aggregate base', area * 0.22, 'civil-aggregate-crushed', 'civil-recycled-aggregate', '220 kg aggregate per m2 of hardscape'),
      makeLine('civil-concrete', 'Concrete', 'Site concrete and curbs', area * 0.035, 'concrete-ready-mix-4000', 'concrete-low-cement-scm', 'Curbs, pads, walls allowance'),
      makeLine('civil-rebar', 'Steel', 'Reinforcement allowance', area * 1.2, 'steel-rebar-conventional', 'steel-rebar-eaf-epd', 'Rebar kg allowance'),
    ]
  }

  const structuralLines =
    profile.structure === 'Hybrid timber'
      ? [
          makeLine('structure-concrete', 'Concrete', 'Foundations and topping slabs', area * 0.11, 'concrete-ready-mix-4000', 'amrize-ecotect', '0.11 m3/m2 hybrid concrete allowance'),
          makeLine('structure-rebar', 'Steel', 'Concrete reinforcement', area * 11, 'steel-rebar-conventional', 'steel-rebar-eaf-epd', '11 kg/m2 hybrid allowance'),
          makeLine('structure-hybrid-system', 'Mass timber', 'Primary structural system', area, 'system-concrete-steel-frame', 'system-hybrid-timber-frame', 'Concept-stage structural bay comparison'),
        ]
      : profile.structure === 'Steel'
        ? [
            makeLine('structure-steel', 'Steel', 'Primary steel frame', area * 42, 'steel-wide-flange-conventional', 'nucor-econiq-structural', '42 kg/m2 steel frame allowance'),
            makeLine('structure-concrete', 'Concrete', 'Composite slab concrete', area * 0.16, 'concrete-ready-mix-4000', 'concrete-low-cement-scm', '0.16 m3/m2 composite slab allowance'),
            makeLine('structure-rebar', 'Steel', 'Slab reinforcement', area * 9, 'steel-rebar-conventional', 'steel-rebar-eaf-epd', '9 kg/m2 slab rebar allowance'),
          ]
        : profile.structure === 'Light wood'
          ? [
              makeLine('structure-wood', 'Wood framing', 'Floor and roof framing', area, 'wood-stick-framing-system', 'wood-tji-framing-system', 'Concept-stage light wood framing comparison'),
              makeLine('structure-concrete', 'Concrete', 'Foundations and slab', area * 0.08, 'concrete-ready-mix-4000', 'concrete-low-cement-scm', '0.08 m3/m2 foundation allowance'),
              makeLine('structure-rebar', 'Steel', 'Foundation reinforcement', area * 5.5, 'steel-rebar-conventional', 'steel-rebar-eaf-epd', '5.5 kg/m2 foundation rebar allowance'),
            ]
          : [
              makeLine('structure-concrete', 'Concrete', 'Concrete frame and slabs', area * 0.32, 'concrete-ready-mix-4000', 'amrize-ecotect', '0.32 m3/m2 concrete frame allowance'),
              makeLine('structure-rebar', 'Steel', 'Reinforcement', area * 28, 'steel-rebar-conventional', 'steel-rebar-eaf-epd', '28 kg/m2 concrete frame allowance'),
              makeLine('structure-steel-misc', 'Steel', 'Miscellaneous steel', area * 8, 'steel-wide-flange-conventional', 'nucor-econiq-structural', '8 kg/m2 miscellaneous allowance'),
            ]

  return [
    ...structuralLines,
    makeLine('envelope-insulation', 'Insulation', 'Continuous insulation', area * envelopeFactor, 'insulation-xps-standard', 'rockwool-comfortboard-80', 'Envelope area R-10 equivalent'),
    makeLine('envelope-facade', 'Facade', 'Opaque facade cladding', area * 0.36, 'facade-aluminum-composite', 'facade-fiber-cement', 'Facade area allowance'),
    makeLine('envelope-glazing', 'Glazing', 'Window and curtainwall glazing', area * 0.18, 'glazing-double-lowe', profile.climate === 'Cold' ? 'glazing-triple-lowe' : 'glazing-reused-window', 'Window-to-floor area proxy'),
    makeLine('roofing', 'Roofing', 'Roofing membrane or panels', roofArea * 1.05, 'roofing-asphalt-shingle', 'roofing-metal-standing-seam', 'Roof area from levels'),
    makeLine('interior-gypsum', 'Gypsum', 'Interior gypsum board', area * interiorWallFactor, 'gypsum-standard-5-8', 'usg-ecosmart-typex', 'Area x interior wall intensity'),
    makeLine('interior-flooring', 'Flooring', 'Floor finish', area * flooringFactor, 'flooring-lvt', 'flooring-marmoleum', 'Usable floor finish allowance'),
    makeLine('interior-paint', 'Coatings', 'Painted surfaces', area * 1.65, 'paint-standard-low-voc', 'paint-mineral-silicate', 'Wall/ceiling coating proxy'),
  ]
}

function lineMaterialResult(material: Material, quantity: number, settings: ModelSettings) {
  const grossQuantity = quantity * (1 + material.wasteRate)
  const productCarbon = grossQuantity * material.gwpPerUnit
  const transportCarbon =
    material.massKgPerUnit === undefined
      ? 0
      : ((material.massKgPerUnit * grossQuantity) / 1000) *
        settings.transportDistanceKm *
        settings.freightKgCo2PerTonneKm
  const storageCredit =
    settings.includeBiogenicStorage && material.biogenicStoragePerUnit
      ? grossQuantity * material.biogenicStoragePerUnit
      : 0
  const carbon = Math.max(productCarbon + transportCarbon - storageCredit, -productCarbon)
  const cost =
    grossQuantity *
    material.priceUsd *
    settings.regionCostMultiplier *
    (1 + settings.contingencyPercent / 100)

  return { carbon, cost, transportCarbon, storageCredit }
}

export function calculateLine(line: ScopeLine, settings: ModelSettings): LineResult {
  const baseline = getMaterial(line.baselineId)
  const alternative = getMaterial(line.alternativeId)
  const baselineResult = lineMaterialResult(baseline, line.quantity, settings)
  const alternativeResult = lineMaterialResult(alternative, line.quantity, settings)
  const confidenceScore =
    (confidenceWeight[baseline.confidence] + confidenceWeight[alternative.confidence]) / 2

  return {
    line,
    baseline,
    alternative,
    baselineCarbon: baselineResult.carbon,
    alternativeCarbon: alternativeResult.carbon,
    baselineCost: baselineResult.cost,
    alternativeCost: alternativeResult.cost,
    carbonSavings: baselineResult.carbon - alternativeResult.carbon,
    costSavings: baselineResult.cost - alternativeResult.cost,
    baselineTransport: baselineResult.transportCarbon,
    alternativeTransport: alternativeResult.transportCarbon,
    baselineStorageCredit: baselineResult.storageCredit,
    alternativeStorageCredit: alternativeResult.storageCredit,
    confidenceScore,
  }
}

export function calculatePortfolio(lines: ScopeLine[], settings: ModelSettings): PortfolioResult {
  const results = lines.map((line) => calculateLine(line, settings))
  const baselineCarbon = results.reduce((sum, result) => sum + result.baselineCarbon, 0)
  const alternativeCarbon = results.reduce((sum, result) => sum + result.alternativeCarbon, 0)
  const baselineCost = results.reduce((sum, result) => sum + result.baselineCost, 0)
  const alternativeCost = results.reduce((sum, result) => sum + result.alternativeCost, 0)
  const carbonSavings = baselineCarbon - alternativeCarbon
  const costSavings = baselineCost - alternativeCost
  const carbonPriceValue = (carbonSavings / 1000) * settings.carbonPriceUsdPerTonne

  return {
    lines: results,
    baselineCarbon,
    alternativeCarbon,
    carbonSavings,
    savingsPercent: baselineCarbon === 0 ? 0 : (carbonSavings / baselineCarbon) * 100,
    baselineCost,
    alternativeCost,
    costSavings,
    carbonPriceValue,
    netValue: costSavings + carbonPriceValue,
    confidenceScore:
      results.length === 0
        ? 0
        : results.reduce((sum, result) => sum + result.confidenceScore, 0) / results.length,
  }
}

export function findLowestCarbonAlternative(category: MaterialCategory, currentId: string) {
  const options = materialsByCategory[category].filter((material) => material.id !== currentId)
  return options.sort((a, b) => a.gwpPerUnit - b.gwpPerUnit)[0]
}

export function createDecisionBrief(
  profile: ProjectProfile,
  result: PortfolioResult,
  settings: ModelSettings,
) {
  const topLines = [...result.lines]
    .sort((a, b) => b.carbonSavings - a.carbonSavings)
    .slice(0, 6)
    .map(
      (item, index) =>
        `${index + 1}. ${item.line.workPackage}: switch ${item.baseline.product} to ${item.alternative.product} for ${(item.carbonSavings / 1000).toFixed(1)} tCO2e and ${formatCurrency(item.costSavings)} cost impact.`,
    )
    .join('\n')

  return `Project: ${profile.name}
Type: ${profile.projectType}, ${profile.areaM2.toLocaleString()} m2, ${profile.levels} level(s), ${profile.structure}
Model: ${profile.stage}; ${settings.transportDistanceKm} km assumed delivery; biogenic storage ${
    settings.includeBiogenicStorage ? 'included' : 'excluded'
  }.

Outcome:
- Baseline embodied carbon: ${(result.baselineCarbon / 1000).toFixed(1)} tCO2e
- Proposed embodied carbon: ${(result.alternativeCarbon / 1000).toFixed(1)} tCO2e
- Carbon savings: ${(result.carbonSavings / 1000).toFixed(1)} tCO2e (${result.savingsPercent.toFixed(1)}%)
- Baseline material cost: ${formatCurrency(result.baselineCost)}
- Proposed material cost: ${formatCurrency(result.alternativeCost)}
- Direct cost savings / premium: ${formatCurrency(result.costSavings)}
- Carbon-price value at ${formatCurrency(settings.carbonPriceUsdPerTonne)}/t: ${formatCurrency(result.carbonPriceValue)}
- Net value signal: ${formatCurrency(result.netValue)}
- Data confidence: ${result.confidenceScore.toFixed(0)} / 100

Highest-impact substitutions:
${topLines}

Procurement notes:
- Require current product-specific EPDs before award.
- Ask suppliers for max GWP per unit, not only recycled-content claims.
- Keep prices editable by bid package; public prices are directional.
- Re-run the model when structural grid, facade ratio, or finish quantities change.`
}

export function formatCarbon(valueKg: number) {
  if (Math.abs(valueKg) >= 1000) return `${(valueKg / 1000).toFixed(1)} tCO2e`
  return `${valueKg.toFixed(0)} kgCO2e`
}

export function formatCurrency(value: number) {
  const abs = Math.abs(value)
  const prefix = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `${prefix}$${Math.round(abs / 1000).toLocaleString()}k`
  return `${prefix}$${Math.round(abs).toLocaleString()}`
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}
