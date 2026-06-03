import type { Material } from '../data/materials'
import { getMaterialDossier, getRegionalAvailability, type Region } from '../data/materialIntelligence'
import type { PortfolioResult, ProjectProfile } from './calculator'

export type CertificationFit = 'Strong' | 'Promising' | 'Watch'

export interface CertificationOpportunity {
  system: string
  pathway: string
  fit: CertificationFit
  score: number
  potential: string
  evidence: string[]
  cautions: string[]
}

export interface CertificationSummary {
  opportunities: CertificationOpportunity[]
  epdReadyCount: number
  materialHealthWatchCount: number
  strongCount: number
  topEvidence: string[]
}

const interiorCategories = new Set(['Gypsum', 'Flooring', 'Ceilings', 'Coatings', 'Insulation', 'MEP'])

function fitFromScore(score: number): CertificationFit {
  if (score >= 84) return 'Strong'
  if (score >= 58) return 'Promising'
  return 'Watch'
}

function uniqueMaterials(result: PortfolioResult) {
  const byId = new Map<string, Material>()
  result.lines.forEach((line) => {
    byId.set(line.baseline.id, line.baseline)
    byId.set(line.alternative.id, line.alternative)
  })
  return [...byId.values()]
}

function countSignals(materials: Material[], matcher: (signal: string) => boolean) {
  return materials.filter((material) => getMaterialDossier(material).certificationSignals.some(matcher)).length
}

function weakRegionCount(materials: Material[], region: Region) {
  return materials.filter((material) => {
    const status = getRegionalAvailability(material, region).status
    return status === 'Limited' || status === 'Imported / verify' || status === 'Not typical'
  }).length
}

export function buildCertificationSummary(
  profile: ProjectProfile,
  result: PortfolioResult,
): CertificationSummary {
  const materialSet = uniqueMaterials(result)
  const alternatives = result.lines.map((line) => line.alternative)
  const interiorAlternatives = alternatives.filter((material) => interiorCategories.has(material.category))
  const savings = Math.max(0, result.savingsPercent)
  const epdReadyCount = materialSet.filter(
    (material) => material.confidence === 'EPD-led' || material.confidence === 'Manufacturer-led',
  ).length
  const lowEmittingCount = countSignals(interiorAlternatives, (signal) => signal.includes('low-emitting') || signal.includes('WELL'))
  const circularCount = countSignals(alternatives, (signal) => signal.includes('Circularity') || signal.includes('sourcing'))
  const materialHealthWatchCount = alternatives.filter(
    (material) => getMaterialDossier(material).redListRisk === 'High',
  ).length
  const regionWeak = weakRegionCount(alternatives, profile.region)
  const epdScore = Math.min(92, 34 + epdReadyCount * 5 + savings * 0.6)
  const carbonScore = Math.min(96, 42 + savings * 1.25 + epdReadyCount * 2 - regionWeak * 5)
  const healthScore = Math.max(28, Math.min(88, 48 + lowEmittingCount * 9 - materialHealthWatchCount * 14))
  const circularScore = Math.min(88, 35 + circularCount * 8 + savings * 0.5 - materialHealthWatchCount * 4)
  const ilfiScore = Math.min(92, 45 + savings * 1.1 - materialHealthWatchCount * 8)

  const opportunities: CertificationOpportunity[] = [
    {
      system: 'LEED v5',
      pathway: 'Assess embodied carbon plus Building Product Selection and Procurement',
      fit: fitFromScore(carbonScore),
      score: Math.round(carbonScore),
      potential:
        savings >= 20
          ? 'The scenario clears a 20% savings signal that is worth developing into a formal whole-building LCA package.'
          : 'The scenario is useful for early design, but needs more quantity detail or stronger substitutions to support high-value claims.',
      evidence: [
        'Whole-building LCA or material carbon worksheet by structure, enclosure, and hardscape',
        'Product-specific EPDs for highest spend and highest carbon products',
        'Regional baseline and buyout tracking through construction',
      ],
      cautions: [
        'Do not claim credit from this calculator alone; LEED review needs registered project documentation.',
        'Imported products need assessor acceptance and region-appropriate EPDs.',
      ],
    },
    {
      system: 'LEED v4.1',
      pathway: 'BPDO Environmental Product Declarations and low-emitting interior materials',
      fit: fitFromScore(epdScore),
      score: Math.round(epdScore),
      potential: `${epdReadyCount} modeled products have EPD or manufacturer-led documentation signals for disclosure tracking.`,
      evidence: [
        'EPD log with manufacturer, product, program operator, expiration date, and purchase package',
        'Low-emitting certificates for paints, flooring, ceilings, insulation, adhesives, and sealants',
        'Contractor substitution review during buyout',
      ],
      cautions: ['Structure/enclosure cost caps and product-count rules require a LEED AP or assessor review.'],
    },
    {
      system: 'BREEAM',
      pathway: 'Mat 01 life cycle impacts and construction product EPD evidence',
      fit: fitFromScore(Math.min(84, epdScore * 0.55 + savings * 0.35 + 10)),
      score: Math.round(Math.min(84, epdScore * 0.55 + savings * 0.35 + 10)),
      potential: 'The model creates a Mat 01-ready material comparison narrative when paired with a compliant LCA tool.',
      evidence: [
        'Elemental LCA model or BREEAM-compliant tool export',
        'EPD classification by dominant material category',
        'Evidence for reuse, recycling, or local authority constraints where claimed',
      ],
      cautions: ['BREEAM credits depend on scheme version, country, and licensed assessor interpretation.'],
    },
    {
      system: 'WELL v2',
      pathway: 'Materials restrictions, VOC restrictions, transparency, and optimization',
      fit: fitFromScore(healthScore),
      score: Math.round(healthScore),
      potential:
        materialHealthWatchCount === 0
          ? 'Interior material choices are moving in a healthy-material direction.'
          : `${materialHealthWatchCount} alternative product(s) need material-health review before WELL positioning.`,
      evidence: [
        'VOC emissions and content documentation for wet-applied and interior products',
        'HPD, Declare, SDS, or manufacturer ingredient disclosure',
        'Material restrictions checklist for high-risk chemistries',
      ],
      cautions: ['Low embodied carbon does not automatically mean low VOC or low hazard.'],
    },
    {
      system: 'ILFI Zero Carbon',
      pathway: '20% embodied-carbon reduction, lower-than-average interiors, and offset disclosure',
      fit: fitFromScore(ilfiScore),
      score: Math.round(ilfiScore),
      potential:
        savings >= 20
          ? 'The savings signal can support an ILFI Zero Carbon pre-assessment if A1-A5 scope is expanded.'
          : 'Push major structure/enclosure substitutions further before relying on this for ILFI Zero Carbon.',
      evidence: [
        'A1-A5 embodied carbon model for primary, exterior, and interior materials',
        'Documentation of lower-than-industry-average interior products',
        'Offset or carbon-sequestering material strategy for residual emissions',
      ],
      cautions: ['A1-A3-only product values must be expanded to A1-A5 for ILFI review.'],
    },
    {
      system: 'Living Building Challenge / Declare',
      pathway: 'Materials Petal screening, Red List avoidance, and manufacturer disclosure',
      fit: fitFromScore(Math.max(30, circularScore - materialHealthWatchCount * 10)),
      score: Math.round(Math.max(30, circularScore - materialHealthWatchCount * 10)),
      potential:
        materialHealthWatchCount === 0
          ? 'The scenario has no high-risk alternatives flagged by the tool, but every product still needs disclosure.'
          : 'High-risk plastic, foam, membrane, or MEP products should be replaced or documented with exceptions.',
      evidence: [
        'Declare labels or equivalent ingredient disclosure',
        'Red List screening by CAS/class where required',
        'Manufacturer letters for exceptions or substitutions',
      ],
      cautions: ['This is a screening signal, not a replacement for ILFI material vetting.'],
    },
    {
      system: profile.region === 'Europe' ? 'DGNB / EU Taxonomy' : 'Regional green building programs',
      pathway:
        profile.region === 'Europe'
          ? 'Life-cycle assessment, responsible sourcing, and circular construction documentation'
          : 'Local low-carbon procurement, green building, and owner ESG documentation',
      fit: fitFromScore(Math.min(82, 32 + savings * 0.75 + epdReadyCount * 3 - regionWeak * 5)),
      score: Math.round(Math.min(82, 32 + savings * 0.75 + epdReadyCount * 3 - regionWeak * 5)),
      potential: 'Use the output as a shortlist for regional assessor review and owner procurement standards.',
      evidence: [
        'Local assessor matrix',
        'Country-appropriate EPDs or product passports',
        'Region-specific cost and availability quotes',
      ],
      cautions: ['Regional schemes change frequently and require local professional confirmation.'],
    },
  ].sort((a, b) => b.score - a.score)

  return {
    opportunities,
    epdReadyCount,
    materialHealthWatchCount,
    strongCount: opportunities.filter((opportunity) => opportunity.fit === 'Strong').length,
    topEvidence: [
      'Product-specific EPDs for high-carbon packages',
      'Supplier quotes tied to exact product, region, and quantity',
      profile.projectType === 'Interior fit-out'
        ? 'VOC and ingredient disclosures for interiors'
        : 'Formal LCA export for certification review',
    ],
  }
}
