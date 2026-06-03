import { materials, materialsByCategory, type Material, type MaterialCategory } from './materials'

export type Region = 'North America' | 'Europe' | 'Gulf / MENA' | 'Latin America'

export type AvailabilityStatus = 'Preferred' | 'Available' | 'Limited' | 'Imported / verify' | 'Not typical'
export type EvidenceLevel = 'Verified EPD' | 'Manufacturer claim' | 'Category benchmark' | 'Concept estimate'
export type RedListRisk = 'Low' | 'Medium' | 'High'

export interface RegionalAvailability {
  status: AvailabilityStatus
  confidence: number
  priceFactor: number
  leadTimeWeeks: [number, number]
  notes: string
}

export interface RegionProfile {
  costMultiplier: number
  carbonGridSignal: string
  marketNotes: string[]
  procurementReality: string
}

export interface PriceSignal {
  seriesId: string
  label: string
  sourceUrl: string
  updateCadence: string
  coverage: string
  caveat: string
}

export interface MaterialDossier {
  evidenceLevel: EvidenceLevel
  reductionRangePercent: [number, number]
  regionAvailability: Record<Region, RegionalAvailability>
  priceSignal: PriceSignal
  technicalSpecs: string[]
  performanceCriteria: string[]
  submittals: string[]
  procurementQuestions: string[]
  designConstraints: string[]
  installRisks: string[]
  serviceNotes: string[]
  certificationSignals: string[]
  redListRisk: RedListRisk
  redListNotes: string
}

type DossierSeed = Omit<MaterialDossier, 'evidenceLevel' | 'reductionRangePercent' | 'regionAvailability'>

type DossierOverride = Partial<DossierSeed> & {
  reductionRangePercent?: [number, number]
  regionAvailability?: Partial<Record<Region, RegionalAvailability>>
}

const fredBase = 'https://fred.stlouisfed.org/data/'

export const regions: Region[] = ['North America', 'Europe', 'Gulf / MENA', 'Latin America']

export const regionProfiles: Record<Region, RegionProfile> = {
  'North America': {
    costMultiplier: 1,
    carbonGridSignal: 'Strong EAF steel, broad EPD adoption, uneven low-carbon concrete availability by metro.',
    marketNotes: [
      'Named low-carbon concrete, steel, gypsum, insulation, and flooring products are most mature in major US and Canadian markets.',
      'Ready-mix concrete pricing remains local; supplier quote and mix design approval are required before bid use.',
    ],
    procurementReality:
      'Best region for named-product matching, but prices still move by batch plant, volume, union package, and freight radius.',
  },
  Europe: {
    costMultiplier: 1.08,
    carbonGridSignal: 'Strong EPD norms, mature timber supply, and early carbon-captured cement availability.',
    marketNotes: [
      'Carbon-captured cement and mass timber options are stronger than most global regions, but product names vary by country.',
      'Use EN 15804+A2 EPDs and local tender price indexes where available.',
    ],
    procurementReality:
      'Excellent certification data depth, with country-specific product substitutions required for North American brands.',
  },
  'Gulf / MENA': {
    costMultiplier: 1.18,
    carbonGridSignal: 'High cooling loads, import logistics, and variable EPD coverage make regional checks critical.',
    marketNotes: [
      'Concrete, cement, aluminum, facade, and MEP packages are locally important; timber and bio-based products can be limited.',
      'Freight and lead-time risk should be modeled explicitly for imported low-carbon products.',
    ],
    procurementReality:
      'Treat many best-in-class products as specification targets until local distributors and EPDs are confirmed.',
  },
  'Latin America': {
    costMultiplier: 0.86,
    carbonGridSignal: 'Major cement and concrete suppliers exist, with variable EPD depth and strong cost sensitivity.',
    marketNotes: [
      'Cement, concrete, masonry, local wood, and recycled aggregates can be strong opportunities when local data is available.',
      'Named US/EU interior products may require substitutions or distributor confirmation.',
    ],
    procurementReality:
      'Use the tool to set GWP caps and alternates, then validate brand availability city by city.',
  },
}

const availabilityScore: Record<AvailabilityStatus, number> = {
  Preferred: 96,
  Available: 82,
  Limited: 58,
  'Imported / verify': 42,
  'Not typical': 18,
}

const evidenceMap: Record<Material['confidence'], EvidenceLevel> = {
  'EPD-led': 'Verified EPD',
  'Manufacturer-led': 'Manufacturer claim',
  Benchmark: 'Category benchmark',
  Estimate: 'Concept estimate',
}

const priceSignals: Record<string, PriceSignal> = {
  readyMix: {
    seriesId: 'PCU327320327320',
    label: 'BLS/FRED PPI: Ready-mix concrete manufacturing',
    sourceUrl: `${fredBase}PCU327320327320`,
    updateCadence: 'Monthly official PPI, checked nightly by Netlify function',
    coverage: 'United States national index; use as benchmark inflation signal outside the US.',
    caveat: 'Concrete unit prices are hyper-local and must be confirmed by plant quote and mix design.',
  },
  cement: {
    seriesId: 'WPS1322',
    label: 'BLS/FRED PPI: Cement, hydraulic',
    sourceUrl: `${fredBase}WPS1322`,
    updateCadence: 'Monthly official PPI, checked nightly by Netlify function',
    coverage: 'United States commodity index for cement price movement.',
    caveat: 'Carbon-captured and scarce low-carbon cements can price outside commodity movement.',
  },
  steel: {
    seriesId: 'WPU1017',
    label: 'BLS/FRED PPI: Steel mill products',
    sourceUrl: `${fredBase}WPU1017`,
    updateCadence: 'Monthly official PPI, checked nightly by Netlify function',
    coverage: 'United States steel mill products index.',
    caveat: 'Fabrication, connection complexity, and project tonnage can dominate raw steel movement.',
  },
  lumber: {
    seriesId: 'WPS0811',
    label: 'BLS/FRED PPI: Softwood lumber',
    sourceUrl: `${fredBase}WPS0811`,
    updateCadence: 'Monthly official PPI, checked nightly by Netlify function',
    coverage: 'United States softwood lumber index.',
    caveat: 'Mass timber and engineered lumber require supplier quote, grade, panel layup, and fire-rating review.',
  },
  gypsum: {
    seriesId: 'WPU1371',
    label: 'BLS/FRED PPI: Gypsum products',
    sourceUrl: `${fredBase}WPU1371`,
    updateCadence: 'Monthly official PPI, checked nightly by Netlify function',
    coverage: 'United States gypsum products index.',
    caveat: 'Panel thickness, fire rating, mold resistance, and distributor stock change package pricing.',
  },
  plastics: {
    seriesId: 'WPU0721',
    label: 'BLS/FRED PPI: Plastic construction products',
    sourceUrl: `${fredBase}WPU0721`,
    updateCadence: 'Monthly official PPI, checked nightly by Netlify function',
    coverage: 'United States plastic construction products index.',
    caveat: 'Foam insulation, membranes, and resilient flooring have brand-specific premiums and chemical-risk differences.',
  },
  benchmark: {
    seriesId: 'BENCHMARK',
    label: 'Supplier quote benchmark',
    sourceUrl: 'https://carbonleadershipforum.org/download/987513125/?tmstv=1767729171',
    updateCadence: 'Editable concept estimate; no universal public live-price feed',
    coverage: 'Directional model value by category and region.',
    caveat: 'Use for planning only; bid packages need local supplier quote and EPD confirmation.',
  },
}

const preferred = (notes: string, factor = 1, lead: [number, number] = [1, 4]): RegionalAvailability => ({
  status: 'Preferred',
  confidence: 92,
  priceFactor: factor,
  leadTimeWeeks: lead,
  notes,
})

const available = (notes: string, factor = 1.04, lead: [number, number] = [2, 6]): RegionalAvailability => ({
  status: 'Available',
  confidence: 78,
  priceFactor: factor,
  leadTimeWeeks: lead,
  notes,
})

const limited = (notes: string, factor = 1.14, lead: [number, number] = [5, 12]): RegionalAvailability => ({
  status: 'Limited',
  confidence: 56,
  priceFactor: factor,
  leadTimeWeeks: lead,
  notes,
})

const imported = (notes: string, factor = 1.28, lead: [number, number] = [8, 18]): RegionalAvailability => ({
  status: 'Imported / verify',
  confidence: 42,
  priceFactor: factor,
  leadTimeWeeks: lead,
  notes,
})

const notTypical = (notes: string, factor = 1.45, lead: [number, number] = [12, 24]): RegionalAvailability => ({
  status: 'Not typical',
  confidence: 20,
  priceFactor: factor,
  leadTimeWeeks: lead,
  notes,
})

const universalAvailability: Record<Region, RegionalAvailability> = {
  'North America': available('Commonly procurable; verify local distributor and product-specific EPD.', 1, [1, 5]),
  Europe: available('Commonly procurable with country-specific brands and EN 15804 EPDs.', 1.05, [2, 6]),
  'Gulf / MENA': limited('Often available through regional suppliers or importers; check lead time and freight carbon.', 1.16, [4, 12]),
  'Latin America': limited('Availability varies by city; local supplier data is essential.', 0.96, [3, 10]),
}

const categoryAvailability: Record<MaterialCategory, Record<Region, RegionalAvailability>> = {
  Concrete: {
    'North America': preferred('Local ready-mix market with growing low-carbon mix availability.', 1, [1, 3]),
    Europe: preferred('Strong EPD culture and low-cement mix adoption; use country-specific EPDs.', 1.07, [1, 4]),
    'Gulf / MENA': available('Concrete is broadly local, but SCMs and low-carbon binders vary by supplier.', 1.12, [2, 8]),
    'Latin America': available('Local concrete supply is strong; low-carbon claims need mix-specific EPD review.', 0.88, [1, 6]),
  },
  Cement: {
    'North America': available('Lower-carbon cement options exist, but carbon-captured cement is not broadly local.', 1.02, [2, 6]),
    Europe: preferred('Best current region for carbon-captured cement and national EPD depth.', 1.1, [1, 5]),
    'Gulf / MENA': limited('Imported low-carbon cement may be feasible; confirm compatibility and customs lead time.', 1.2, [5, 14]),
    'Latin America': available('Major cement producers operate regionally; product names and EPDs vary.', 0.92, [2, 8]),
  },
  Steel: {
    'North America': preferred('EAF steel and mill EPDs are mature for structural steel and rebar.', 1, [2, 7]),
    Europe: available('Low-carbon steel routes exist, but named North American products need substitution.', 1.08, [3, 8]),
    'Gulf / MENA': available('Steel is available, but EPD depth and recycled-content claims need careful review.', 1.16, [4, 10]),
    'Latin America': available('Regional mills and imported steel both possible; require mill-specific EPD or certificate.', 0.9, [3, 9]),
  },
  'Mass timber': {
    'North America': preferred('Mature CLT/glulam supply in many markets; fire and connection engineering remain critical.', 1.03, [4, 12]),
    Europe: preferred('Strong mass timber ecosystem with national suppliers and mature detailing practice.', 1.08, [4, 10]),
    'Gulf / MENA': imported('Often imported and climate/logistics sensitive; mockup humidity and fire strategy early.', 1.35, [10, 22]),
    'Latin America': limited('Promising where local forestry and fabrication align; verify FSC/PEFC and structural grades.', 1.04, [8, 18]),
  },
  'Wood framing': {
    'North America': preferred('Strong light-frame and engineered lumber availability.', 1, [1, 5]),
    Europe: available('Available with different grading, spans, and regional suppliers.', 1.08, [2, 7]),
    'Gulf / MENA': imported('Imported wood products need moisture, termite, fire, and treatment review.', 1.3, [8, 18]),
    'Latin America': available('Local and imported options vary widely; verify structural grade and forestry certification.', 0.9, [3, 10]),
  },
  Masonry: universalAvailability,
  Insulation: universalAvailability,
  Gypsum: universalAvailability,
  Facade: universalAvailability,
  Glazing: universalAvailability,
  Roofing: universalAvailability,
  Flooring: universalAvailability,
  Ceilings: universalAvailability,
  Coatings: universalAvailability,
  Civil: {
    'North America': preferred('Asphalt, aggregate, and recycled base materials are highly local.', 1, [1, 4]),
    Europe: available('Use national specifications and recycled aggregate rules.', 1.06, [2, 6]),
    'Gulf / MENA': available('Strong civil materials supply; recycled-content quality and heat performance need review.', 1.12, [2, 8]),
    'Latin America': available('Local aggregates and asphalt are available; recycled supply varies by city.', 0.86, [1, 7]),
  },
  MEP: universalAvailability,
}

const categorySeeds: Record<MaterialCategory, DossierSeed> = {
  Concrete: {
    priceSignal: priceSignals.readyMix,
    technicalSpecs: ['Compressive strength class', 'cementitious content', 'SCM percentage', 'water-cement ratio', 'A1-A3 GWP per m3'],
    performanceCriteria: ['28-day strength', 'early-strength schedule', 'pumpability', 'finish tolerance', 'durability exposure class'],
    submittals: ['Product-specific EPD', 'mix design', 'batch tickets', 'admixture list', 'curing plan'],
    procurementQuestions: ['What is the max kgCO2e/m3 at the required strength?', 'Can the plant supply the mix in the project season?', 'Does the EPD match the local plant and mix?'],
    designConstraints: ['SCM levels can affect early strength and cold-weather curing.', 'Ultra-low mixes need mockup and schedule coordination.'],
    installRisks: ['Late substitution can affect finish, set time, and testing.', 'Carbon-cured or specialty binders need installer familiarity.'],
    serviceNotes: ['Service life is normally governed by durability, cover, exposure, and crack control rather than GWP alone.'],
    certificationSignals: ['LEED EPD', 'LEED v5 embodied carbon', 'BREEAM Mat 01', 'ILFI Zero Carbon', 'Buy Clean style GWP limits'],
    redListRisk: 'Low',
    redListNotes: 'Concrete usually has low material-health risk, but admixtures and sealers should be screened.',
  },
  Cement: {
    priceSignal: priceSignals.cement,
    technicalSpecs: ['Cement type', 'clinker factor', 'SCM content', 'CCS allocation method', 'kgCO2e/t binder'],
    performanceCriteria: ['Strength development', 'setting time', 'sulfate/chloride exposure compatibility', 'local code acceptance'],
    submittals: ['Cement EPD', 'mill certificate', 'chain-of-custody or CCS certificate', 'concrete compatibility notes'],
    procurementQuestions: ['Is the claimed reduction mass-balanced, physically delivered, or certificate-backed?', 'Which cement class is available locally?'],
    designConstraints: ['Binder changes must be coordinated with concrete mix design and curing assumptions.'],
    installRisks: ['Scarce low-carbon cement can create procurement bottlenecks.', 'Allocation claims need owner and assessor acceptance.'],
    serviceNotes: ['Use cement selection as one lever inside a concrete performance specification, not as an isolated substitution.'],
    certificationSignals: ['LEED EPD', 'LEED v5 embodied carbon', 'BREEAM Mat 01', 'ILFI Zero Carbon'],
    redListRisk: 'Low',
    redListNotes: 'Primary concern is carbon intensity, not Red List chemistry.',
  },
  Steel: {
    priceSignal: priceSignals.steel,
    technicalSpecs: ['Section or bar grade', 'yield strength', 'mill route', 'recycled content', 'kgCO2e/kg A1-A3'],
    performanceCriteria: ['Structural grade', 'weldability', 'fire protection compatibility', 'fabrication tolerance'],
    submittals: ['Mill EPD', 'material test reports', 'fabricator quote', 'coating/fireproofing data'],
    procurementQuestions: ['Which mill produced the steel?', 'Is the low-carbon claim EAF-based, renewable-power-backed, or offset-backed?', 'Can the fabricator maintain the specified mill source?'],
    designConstraints: ['Material efficiency and tonnage reduction can outperform product substitution alone.'],
    installRisks: ['Mill substitutions can erase carbon savings if not controlled in buyout.', 'Lead times vary by section size.'],
    serviceNotes: ['Durability and fire protection strategy can change whole-package carbon.'],
    certificationSignals: ['LEED EPD', 'LEED sourcing', 'LEED v5 embodied carbon', 'BREEAM Mat 01', 'ILFI Zero Carbon'],
    redListRisk: 'Low',
    redListNotes: 'Screen coatings, fireproofing, and primers for material-health risk.',
  },
  'Mass timber': {
    priceSignal: priceSignals.lumber,
    technicalSpecs: ['Panel layup', 'species', 'grade', 'adhesive type', 'biogenic carbon accounting method', 'fire rating'],
    performanceCriteria: ['Span/vibration', 'fire resistance', 'moisture protection', 'acoustic build-up', 'connection design'],
    submittals: ['EPD', 'FSC/PEFC certificate', 'shop drawings', 'fire engineering report', 'moisture management plan'],
    procurementQuestions: ['Is forestry certification available?', 'What is the shipping distance and moisture plan?', 'How is biogenic carbon reported?'],
    designConstraints: ['Grid, lateral system, fire strategy, and acoustic assemblies determine the real carbon outcome.'],
    installRisks: ['Water exposure during erection can create quality risk.', 'Long-lead fabrication requires early design freeze.'],
    serviceNotes: ['Long-term value depends on protection from moisture, fire strategy, and reuse potential.'],
    certificationSignals: ['LEED sourcing', 'LEED v5 embodied carbon', 'BREEAM Mat 01', 'ILFI Zero Carbon', 'Circularity'],
    redListRisk: 'Medium',
    redListNotes: 'Wood is usually favorable, but adhesives, treatments, and fire retardants need screening.',
  },
  'Wood framing': {
    priceSignal: priceSignals.lumber,
    technicalSpecs: ['Species/grade', 'span tables', 'I-joist depth', 'adhesive system', 'forest certification'],
    performanceCriteria: ['Structural capacity', 'vibration', 'fire separation', 'moisture durability', 'acoustics'],
    submittals: ['Supplier EPD where available', 'span tables', 'forestry certificate', 'shop/floor layout'],
    procurementQuestions: ['Is the product locally stocked?', 'Can the package be optimized to reduce waste?', 'Which forestry certification is available?'],
    designConstraints: ['Span, fire, and acoustic requirements can increase build-up carbon if unmanaged.'],
    installRisks: ['Moisture exposure and framing waste can erode performance and savings.'],
    serviceNotes: ['Design for protection, repairability, and efficient spans.'],
    certificationSignals: ['LEED sourcing', 'LEED EPD', 'BREEAM Mat 01', 'ILFI Zero Carbon'],
    redListRisk: 'Medium',
    redListNotes: 'Screen engineered wood adhesives, preservatives, and fire treatments.',
  },
  Masonry: {
    priceSignal: priceSignals.benchmark,
    technicalSpecs: ['Unit density', 'compressive strength', 'cement content', 'recycled content', 'kgCO2e/unit or m2'],
    performanceCriteria: ['Compressive strength', 'fire resistance', 'moisture durability', 'thermal mass'],
    submittals: ['EPD if available', 'unit data sheet', 'mortar/grout specs', 'recycled-content documentation'],
    procurementQuestions: ['Can lightweight or low-cement block meet structural and fire requirements?', 'Is local production available?'],
    designConstraints: ['Wall thickness, reinforcement, grout, and finish requirements affect whole-wall carbon.'],
    installRisks: ['Substituting block density can affect acoustic, fire, and anchorage assumptions.'],
    serviceNotes: ['High service life can be valuable where durability and reuse are realistic.'],
    certificationSignals: ['LEED EPD', 'BREEAM Mat 01', 'LEED sourcing'],
    redListRisk: 'Low',
    redListNotes: 'Generally low Red List risk; coatings and sealers require screening.',
  },
  Insulation: {
    priceSignal: priceSignals.plastics,
    technicalSpecs: ['R-value', 'density', 'compressive strength', 'vapor permeability', 'flame/smoke rating', 'kgCO2e/m2 at R target'],
    performanceCriteria: ['Thermal resistance', 'moisture behavior', 'fire rating', 'air/water barrier compatibility'],
    submittals: ['EPD', 'thermal data sheet', 'fire test', 'VOC/emissions certificate where interior exposed', 'installation guide'],
    procurementQuestions: ['What is the GWP at the project R-value?', 'Are blowing agents low-GWP?', 'Does the assembly need vapor-open or vapor-closed insulation?'],
    designConstraints: ['Carbon savings must not compromise condensation, drying, or fire strategy.'],
    installRisks: ['Gaps, compression, and poor continuity reduce operational performance.', 'Foam substitutions can trigger code/fire review.'],
    serviceNotes: ['Operational energy impact can exceed material carbon when assembly performance changes.'],
    certificationSignals: ['LEED EPD', 'LEED low-emitting materials', 'WELL materials', 'BREEAM Mat 01', 'Red List screening'],
    redListRisk: 'High',
    redListNotes: 'Foams can carry blowing-agent and flame-retardant concerns; mineral wool/cellulose usually screen better.',
  },
  Gypsum: {
    priceSignal: priceSignals.gypsum,
    technicalSpecs: ['Thickness', 'Type X/fire rating', 'moisture/mold resistance', 'panel weight', 'kgCO2e/m2'],
    performanceCriteria: ['Fire assembly listing', 'mold resistance', 'impact resistance', 'finish level'],
    submittals: ['EPD or LCA', 'UL assembly', 'submittal sheet', 'SDS', 'recycled-paper documentation'],
    procurementQuestions: ['Does the lower-carbon panel match the exact UL design?', 'Is the panel locally stocked in required thickness?'],
    designConstraints: ['Do not break fire or acoustic assembly requirements when changing boards.'],
    installRisks: ['Panel substitutions can fail inspection if UL design does not match.', 'Moisture areas require correct board type.'],
    serviceNotes: ['Waste rate matters; right-size board ordering and recycling reduce impact.'],
    certificationSignals: ['LEED EPD', 'LEED low-emitting materials', 'WELL materials', 'BREEAM Mat 01'],
    redListRisk: 'Low',
    redListNotes: 'Generally low risk; verify additives, paper, and mold-resistant chemistry where relevant.',
  },
  Facade: {
    priceSignal: priceSignals.benchmark,
    technicalSpecs: ['Panel material', 'finish system', 'attachment method', 'fire classification', 'kgCO2e/m2'],
    performanceCriteria: ['Wind load', 'water penetration', 'fire propagation', 'thermal bridging', 'maintenance life'],
    submittals: ['EPD', 'fire test', 'shop drawings', 'finish warranty', 'maintenance data'],
    procurementQuestions: ['Can a lower-carbon cladding meet fire, durability, and warranty needs?', 'What is the subframe carbon?'],
    designConstraints: ['Facade carbon includes panels, rails, fasteners, insulation, and waste.'],
    installRisks: ['Subframe changes can add carbon and thermal bridges.', 'Finish durability can change replacement cycles.'],
    serviceNotes: ['Long life, repairability, and local replacement panels matter.'],
    certificationSignals: ['LEED EPD', 'BREEAM Mat 01', 'LEED v5 embodied carbon', 'Red List screening'],
    redListRisk: 'Medium',
    redListNotes: 'Screen aluminum composite cores, coatings, sealants, and pressure-treated wood.',
  },
  Glazing: {
    priceSignal: priceSignals.benchmark,
    technicalSpecs: ['U-value', 'SHGC', 'visible transmittance', 'spacer type', 'frame material', 'kgCO2e/m2'],
    performanceCriteria: ['Thermal performance', 'solar control', 'condensation resistance', 'acoustics', 'wind load'],
    submittals: ['EPD if available', 'NFRC/CE data', 'shop drawings', 'warranty', 'reuse assessment for salvaged units'],
    procurementQuestions: ['Does added glass carbon reduce operational loads enough for this climate?', 'Can reused units meet performance and warranty?'],
    designConstraints: ['Window-to-wall ratio and frame choice often dominate product selection.'],
    installRisks: ['Imported or reused glazing needs tolerance, seal, and warranty review.'],
    serviceNotes: ['Service life and replaceability are key for whole-life performance.'],
    certificationSignals: ['LEED EPD', 'BREEAM Mat 01', 'Energy performance credits', 'Circularity'],
    redListRisk: 'Medium',
    redListNotes: 'Screen sealants, spacers, and frame finishes.',
  },
  Roofing: {
    priceSignal: priceSignals.plastics,
    technicalSpecs: ['Membrane/panel type', 'thickness', 'solar reflectance', 'wind uplift', 'kgCO2e/m2'],
    performanceCriteria: ['Waterproofing', 'wind uplift', 'fire rating', 'heat island performance', 'maintenance access'],
    submittals: ['EPD', 'warranty', 'fire/wind test', 'installation guide', 'recycled-content or coating documentation'],
    procurementQuestions: ['Can the roof reduce operational cooling or support PV?', 'What is the replacement cycle?'],
    designConstraints: ['Durability and reflectance can outweigh small upfront carbon differences.'],
    installRisks: ['Wrong substrate, fastener, or detailing can void warranty.', 'Hot climates need heat-aging review.'],
    serviceNotes: ['Design for inspection, repair, and PV compatibility.'],
    certificationSignals: ['LEED heat island', 'LEED EPD', 'BREEAM Mat 01', 'Red List screening'],
    redListRisk: 'High',
    redListNotes: 'Plastic membranes and asphalt products can carry chemical screening concerns.',
  },
  Flooring: {
    priceSignal: priceSignals.plastics,
    technicalSpecs: ['Wear layer', 'backing', 'adhesive', 'VOC emissions', 'kgCO2e/m2', 'replacement cycle'],
    performanceCriteria: ['Durability', 'slip resistance', 'cleanability', 'VOC emissions', 'acoustics'],
    submittals: ['EPD', 'HPD/Declare where available', 'VOC certificate', 'maintenance plan', 'take-back program'],
    procurementQuestions: ['What is the GWP including backing and adhesive?', 'Can a take-back or low-VOC path support certification?'],
    designConstraints: ['Short replacement cycles can dominate whole-life carbon.'],
    installRisks: ['Substrate moisture and adhesive selection affect failures and VOC claims.'],
    serviceNotes: ['Maintenance chemistry and replacement frequency are material to long-term value.'],
    certificationSignals: ['LEED low-emitting materials', 'LEED EPD', 'WELL materials', 'BREEAM Mat 01', 'Circularity'],
    redListRisk: 'High',
    redListNotes: 'PVC/LVT and some adhesives need Red List and VOC review; bio-based products often screen better.',
  },
  Ceilings: {
    priceSignal: priceSignals.benchmark,
    technicalSpecs: ['NRC', 'CAC', 'fire rating', 'recycled content', 'kgCO2e/m2', 'attachment method'],
    performanceCriteria: ['Acoustic performance', 'plenum access', 'fire rating', 'VOC emissions'],
    submittals: ['EPD', 'acoustic data', 'VOC certificate', 'HPD/Declare where available', 'installation guide'],
    procurementQuestions: ['Can acoustic need be met with less material?', 'Is take-back available?'],
    designConstraints: ['Open ceilings can reduce material but may increase acoustic or MEP requirements.'],
    installRisks: ['Suspension system and seismic bracing can add carbon.'],
    serviceNotes: ['Access, cleaning, and replacement frequency matter.'],
    certificationSignals: ['LEED EPD', 'LEED low-emitting materials', 'WELL materials', 'BREEAM Mat 01'],
    redListRisk: 'Medium',
    redListNotes: 'Screen binders, facings, and felt chemistry.',
  },
  Coatings: {
    priceSignal: priceSignals.benchmark,
    technicalSpecs: ['VOC content', 'emissions testing', 'coverage rate', 'binder type', 'service life'],
    performanceCriteria: ['Washability', 'adhesion', 'mold resistance', 'substrate compatibility', 'VOC emissions'],
    submittals: ['VOC certificate', 'SDS', 'product data sheet', 'HPD/Declare where available'],
    procurementQuestions: ['Does the coating comply by both VOC content and emissions path?', 'Can mineral or low-impact coating meet durability?'],
    designConstraints: ['Coating carbon is small per unit but huge by area and replacement cycle.'],
    installRisks: ['Substrate prep, humidity, and curing affect performance.'],
    serviceNotes: ['Lower maintenance repaint cycles can create real savings.'],
    certificationSignals: ['LEED low-emitting materials', 'WELL materials', 'Red List screening'],
    redListRisk: 'Medium',
    redListNotes: 'VOC, preservatives, pigments, and solvents need material-health screening.',
  },
  Civil: {
    priceSignal: priceSignals.benchmark,
    technicalSpecs: ['Mix type', 'RAP percentage', 'binder grade', 'aggregate source', 'kgCO2e/t'],
    performanceCriteria: ['Structural capacity', 'rutting resistance', 'drainage', 'freeze-thaw durability', 'heat performance'],
    submittals: ['Mix design', 'EPD if available', 'RAP/recycled aggregate documentation', 'local spec compliance'],
    procurementQuestions: ['What recycled content can meet the pavement spec?', 'How far is aggregate hauled?', 'Can warm-mix asphalt be used?'],
    designConstraints: ['Hardscape area reduction and permeable systems can outperform material substitution.'],
    installRisks: ['Weather, compaction, and binder temperature affect durability.'],
    serviceNotes: ['Maintenance cycle and resurfacing frequency are central to whole-life carbon.'],
    certificationSignals: ['LEED rainwater/heat island', 'BREEAM Mat 01', 'ILFI Zero Carbon', 'Low-carbon procurement'],
    redListRisk: 'Medium',
    redListNotes: 'Asphalt and solvents should be screened where material-health programs apply.',
  },
  MEP: {
    priceSignal: priceSignals.benchmark,
    technicalSpecs: ['Pipe material', 'diameter', 'pressure rating', 'joining method', 'kgCO2e/kg or m'],
    performanceCriteria: ['Pressure/temperature rating', 'water quality', 'fire rating', 'plenum requirements', 'service access'],
    submittals: ['EPD if available', 'product data sheet', 'code compliance', 'SDS', 'warranty'],
    procurementQuestions: ['Can lower-carbon pipe meet code, pressure, and plenum needs?', 'Does product chemistry conflict with certification goals?'],
    designConstraints: ['Routing efficiency and pipe sizing are as important as material substitution.'],
    installRisks: ['Joining method, firestop, and plenum rules can change accepted material.'],
    serviceNotes: ['Leaks, maintenance access, and replaceability matter more than first-cost alone.'],
    certificationSignals: ['LEED EPD', 'WELL materials', 'Red List screening', 'BREEAM Mat 01'],
    redListRisk: 'High',
    redListNotes: 'PEX, PVC, insulation, adhesives, and firestop products need chemical screening.',
  },
}

const productOverrides: Record<string, DossierOverride> = {
  'amrize-ecotect': {
    reductionRangePercent: [30, 45],
    regionAvailability: {
      'North America': preferred('Named ECOtect/EVERtect portfolio is positioned for US and Canada markets.', 1.04, [1, 5]),
      Europe: notTypical('Use Holcim/Heidelberg/CEMEX country equivalents instead of specifying the North American brand.', 1.3, [8, 18]),
      'Gulf / MENA': imported('Treat as a low-carbon concrete performance target unless a local Amrize/Holcim equivalent is confirmed.', 1.24, [7, 16]),
      'Latin America': limited('Use supplier-specific low-carbon ready-mix equivalent and require local EPD.', 1.06, [4, 12]),
    },
    technicalSpecs: ['At least 30% lower carbon footprint versus standard Type 1/GU concrete', 'Available in multiple strengths', 'Conventional pumping and finishing behavior claimed'],
    procurementQuestions: ['Ask plant for the exact ECOtect mix EPD and strength class, not only the portfolio claim.'],
  },
  'heidelberg-evozero-cement': {
    reductionRangePercent: [85, 99],
    regionAvailability: {
      Europe: preferred('Heidelberg states evoZero is available across Europe during initial rollout.', 1.18, [4, 12]),
      'North America': imported('Use as a design benchmark; local carbon-captured cement supply is not typical.', 1.38, [10, 24]),
      'Gulf / MENA': imported('Likely import or certificate-backed procurement; assessor acceptance is required.', 1.45, [12, 26]),
      'Latin America': imported('Likely import or local alternative; confirm allocation method and product availability.', 1.42, [12, 26]),
    },
    procurementQuestions: ['Confirm whether the project receives physically delivered cement or certificate-backed allocation.'],
    designConstraints: ['CCS does not change cement chemistry, but allocation and chain-of-custody matter for claims.'],
  },
  'cemex-vertua-cement': {
    reductionRangePercent: [12, 35],
    regionAvailability: {
      'North America': preferred('CEMEX US lists Vertua sustainable cement and quote workflows.', 1.08, [2, 7]),
      Europe: available('CEMEX Vertua exists in multiple markets; verify local product class.', 1.09, [2, 8]),
      'Gulf / MENA': limited('CEMEX regional availability varies; verify local cement portfolio.', 1.16, [5, 12]),
      'Latin America': available('CEMEX has strong Latin American footprint; product names and EPD values vary.', 0.96, [2, 8]),
    },
  },
  'nucor-econiq-structural': {
    reductionRangePercent: [45, 75],
    regionAvailability: {
      'North America': preferred('Nucor Econiq is a North American steel certification path.', 1.08, [3, 9]),
      Europe: imported('Use local low-carbon steel equivalents; Nucor product should not be assumed available.', 1.28, [8, 20]),
      'Gulf / MENA': imported('Imported mill source may be possible, but freight and fabricator control are major risks.', 1.36, [10, 24]),
      'Latin America': imported('Treat as a target GWP/certification requirement unless supply chain is confirmed.', 1.22, [8, 20]),
    },
    procurementQuestions: ['Require mill, EPD, and Econiq certificate in the fabricator buyout package.'],
  },
  'weyerhaeuser-tji': {
    regionAvailability: {
      'North America': preferred('Weyerhaeuser TJI joists are a North American engineered-lumber product line.', 1, [1, 5]),
      Europe: notTypical('Use local I-joist suppliers and country span tables.', 1.24, [8, 16]),
      'Gulf / MENA': imported('Imported engineered lumber needs fire, moisture, termite, and customs review.', 1.35, [10, 22]),
      'Latin America': limited('May be available through importers; local equivalents should be evaluated.', 1.08, [6, 16]),
    },
  },
  'rockwool-comfortboard-80': {
    reductionRangePercent: [45, 78],
    regionAvailability: {
      'North America': preferred('Comfortboard 80 is a ROCKWOOL North America product with regional factories.', 1.05, [2, 6]),
      Europe: available('ROCKWOOL is mature in Europe, but product name and board specs differ by country.', 1.04, [2, 6]),
      'Gulf / MENA': limited('Mineral wool is feasible, but exact board density and facade-fire approvals need confirmation.', 1.18, [5, 14]),
      'Latin America': limited('Availability varies by distributor; verify density, R-value, and fire documentation.', 1.02, [4, 12]),
    },
    redListRisk: 'Low',
    redListNotes: 'Mineral wool usually screens better than plastic foam; binders and facings should still be checked.',
  },
  'owens-corning-ngx': {
    reductionRangePercent: [8, 25],
    regionAvailability: {
      'North America': preferred('FOAMULAR NGX is positioned for the North American insulation market.', 1.04, [1, 5]),
      Europe: notTypical('Use local XPS or foam alternatives with country EPDs and blowing-agent data.', 1.22, [8, 18]),
      'Gulf / MENA': limited('Foam board may be available, but exact NGX product and fire approvals need verification.', 1.16, [5, 14]),
      'Latin America': limited('Verify local distributor, blowing-agent claim, and fire documentation.', 1.04, [4, 12]),
    },
  },
  'usg-ecosmart-typex': {
    reductionRangePercent: [20, 30],
    regionAvailability: {
      'North America': preferred('USG EcoSmart is a North American gypsum panel line with public submittal data.', 1.02, [1, 5]),
      Europe: imported('Use Knauf/other regional low-carbon gypsum equivalents with matching fire assemblies.', 1.2, [7, 16]),
      'Gulf / MENA': imported('Confirm distribution and UL/fire assembly acceptance before specifying.', 1.22, [8, 18]),
      'Latin America': limited('May require regional USG/Knauf equivalent and local assembly review.', 1.04, [4, 12]),
    },
  },
  'flooring-interface-cquest': {
    reductionRangePercent: [35, 85],
    regionAvailability: {
      'North America': preferred('Interface commercial carpet tile is widely specified in North America.', 1.08, [2, 8]),
      Europe: preferred('Interface has mature European commercial flooring supply; verify product backing and EPD.', 1.08, [2, 8]),
      'Gulf / MENA': available('Available through commercial flooring channels; lead time and backing variant need confirmation.', 1.16, [5, 14]),
      'Latin America': available('Distributor confirmation required; specify EPD-backed backing variant.', 1.02, [4, 12]),
    },
    redListRisk: 'Medium',
    redListNotes: 'Good carbon signal, but adhesives, fibers, and backing chemistry still need VOC/HPD review.',
  },
  'flooring-lvt': {
    redListRisk: 'High',
    redListNotes: 'PVC flooring should be screened carefully for Living Building Challenge, WELL, and owner material-health policies.',
  },
  'roofing-tpo-membrane': {
    redListRisk: 'High',
    redListNotes: 'Plastic membrane chemistry and additives can trigger material-health review.',
  },
  'mep-pex-pipe': {
    redListRisk: 'High',
    redListNotes: 'Plastic piping can conflict with strict Red List policies even when carbon is lower than copper.',
  },
  'glazing-reused-window': {
    reductionRangePercent: [35, 75],
    certificationSignals: ['Circularity', 'LEED sourcing', 'LEED v5 embodied carbon', 'BREEAM Mat 01'],
    procurementQuestions: ['Confirm dimensions, seals, U-value, warranty, and code acceptance before relying on salvage savings.'],
  },
  'civil-recycled-aggregate': {
    reductionRangePercent: [20, 45],
    certificationSignals: ['LEED sourcing', 'BREEAM Mat 01', 'Circularity', 'Low-carbon procurement'],
  },
  'civil-warm-mix-rap': {
    reductionRangePercent: [12, 35],
    certificationSignals: ['BREEAM Mat 01', 'Low-carbon procurement', 'LEED heat island where paired with surface strategy'],
  },
  'paint-mineral-silicate': {
    redListRisk: 'Low',
    redListNotes: 'Mineral coatings usually screen well, but pigments and additives still need SDS/HPD review.',
  },
}

function mergeUnique(base: string[], extra?: string[]) {
  return [...new Set([...base, ...(extra ?? [])])]
}

function mergeDossierSeed(categorySeed: DossierSeed, override: DossierOverride = {}): DossierSeed {
  return {
    priceSignal: override.priceSignal ?? categorySeed.priceSignal,
    technicalSpecs: mergeUnique(categorySeed.technicalSpecs, override.technicalSpecs),
    performanceCriteria: mergeUnique(categorySeed.performanceCriteria, override.performanceCriteria),
    submittals: mergeUnique(categorySeed.submittals, override.submittals),
    procurementQuestions: mergeUnique(categorySeed.procurementQuestions, override.procurementQuestions),
    designConstraints: mergeUnique(categorySeed.designConstraints, override.designConstraints),
    installRisks: mergeUnique(categorySeed.installRisks, override.installRisks),
    serviceNotes: mergeUnique(categorySeed.serviceNotes, override.serviceNotes),
    certificationSignals: mergeUnique(categorySeed.certificationSignals, override.certificationSignals),
    redListRisk: override.redListRisk ?? categorySeed.redListRisk,
    redListNotes: override.redListNotes ?? categorySeed.redListNotes,
  }
}

function categoryBaseline(material: Material) {
  return (
    materialsByCategory[material.category].find((candidate) => candidate.unit === material.unit) ??
    materialsByCategory[material.category][0] ??
    material
  )
}

function calculatedReductionRange(material: Material, override?: [number, number]): [number, number] {
  if (override) return override
  const baseline = categoryBaseline(material)
  if (!baseline || baseline.id === material.id || baseline.gwpPerUnit === 0) return [0, 0]

  const reduction = ((baseline.gwpPerUnit - material.gwpPerUnit) / Math.abs(baseline.gwpPerUnit)) * 100
  const width =
    material.confidence === 'EPD-led'
      ? 6
      : material.confidence === 'Manufacturer-led'
        ? 10
        : material.confidence === 'Benchmark'
          ? 15
          : 22

  return [Math.max(-120, reduction - width), Math.min(120, reduction + width)]
}

function buildAvailability(material: Material, override?: DossierOverride) {
  const category = categoryAvailability[material.category]
  const merged = { ...category }

  regions.forEach((region) => {
    const next = override?.regionAvailability?.[region]
    if (next) merged[region] = next
  })

  return merged
}

export function getMaterialDossier(material: Material): MaterialDossier {
  const override = productOverrides[material.id]
  const seed = mergeDossierSeed(categorySeeds[material.category], override)

  return {
    ...seed,
    evidenceLevel: evidenceMap[material.confidence],
    reductionRangePercent: calculatedReductionRange(material, override?.reductionRangePercent),
    regionAvailability: buildAvailability(material, override),
  }
}

export function getRegionalAvailability(material: Material, region: Region) {
  return getMaterialDossier(material).regionAvailability[region]
}

export function getRegionFitScore(material: Material, region: Region) {
  const availability = getRegionalAvailability(material, region)
  return Math.round((availabilityScore[availability.status] * 0.72 + availability.confidence * 0.28) * 10) / 10
}

export function compareRegionFit(a: Material, b: Material, region: Region) {
  const aScore = getRegionFitScore(a, region)
  const bScore = getRegionFitScore(b, region)
  if (aScore !== bScore) return bScore - aScore
  return a.gwpPerUnit - b.gwpPerUnit
}

export function getRegionalPrice(material: Material, region: Region, regionCostMultiplier: number) {
  const availability = getRegionalAvailability(material, region)
  return material.priceUsd * availability.priceFactor * regionCostMultiplier
}

export function regionPortfolioStats(activeMaterials: Material[], region: Region) {
  const statuses = activeMaterials.map((material) => getRegionalAvailability(material, region).status)
  const weak = statuses.filter((status) => status === 'Limited' || status === 'Imported / verify' || status === 'Not typical').length
  const preferredOrAvailable = statuses.filter((status) => status === 'Preferred' || status === 'Available').length
  const score =
    activeMaterials.length === 0
      ? 0
      : activeMaterials.reduce((sum, material) => sum + getRegionFitScore(material, region), 0) / activeMaterials.length

  return {
    score: Math.round(score),
    preferredOrAvailable,
    weak,
    total: activeMaterials.length,
  }
}

export function materialSearchText(material: Material) {
  const dossier = getMaterialDossier(material)
  return [
    material.brand,
    material.product,
    material.family,
    material.category,
    ...material.tags,
    ...material.specs,
    ...dossier.technicalSpecs,
    ...dossier.certificationSignals,
    ...regions.map((region) => dossier.regionAvailability[region].status),
  ]
    .join(' ')
    .toLowerCase()
}

export function evidenceScore(material: Material) {
  const base =
    material.confidence === 'EPD-led'
      ? 96
      : material.confidence === 'Manufacturer-led'
        ? 78
        : material.confidence === 'Benchmark'
          ? 64
          : 45
  return base
}

export function portfolioMaterialIds() {
  return new Set(materials.map((material) => material.id))
}
