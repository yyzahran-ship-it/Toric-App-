// ═══════════════════════════════════════════════════════════════════════════
// Post-Refractive IOL Calculation Module
//
// Validated formulas from primary published sources. Key constants:
//   • SRK/T & Holladay 1 corneal height: half-chord = 2.75 mm (5.5 mm pupil)
//     → 2.75² = 7.5625  [Retzlaff JA et al. JCRS 1990;16:333-40]
//   • Haigis-L uses keratometric index n = 1.3315, so K = 331.5/r
//     [Haigis W. JCRS 2008;34:1106-15]
//   • SRK/T uses optical path length (Lopt); Hoffer Q & Holladay 1 use raw AL
// ═══════════════════════════════════════════════════════════════════════════

export type ProcedureType = 'LASIK' | 'PRK' | 'RK';

// ── Input interfaces ─────────────────────────────────────────────────────────

export interface PostRefNoHistoryInput {
  kFlat: number;
  kSteep: number;
  procedure: ProcedureType;
  // Topography (no history needed)
  pentacamTNP?: number;        // Pentacam TNP_Apex 4mm Zone — myopic LASIK/PRK (preferred)
  pentacamPWRSF4mm?: number;   // Pentacam PWR_SF_Pupil 4mm — sagittal curvature front, RK
  pentacamCTMin?: number;      // Pentacam CT_MIN µm — RK only
  galileiTCP2?: number;        // Galilei TCP2
  tomeyACCP?: number;          // Tomey ACCP / Nidek ACP/APP
  atlasCentralPower?: number;  // Atlas 9000 axial 4mm zone
  avgCentralPower?: number;    // Average central power from any topo (RK, not SimK)
  // Biometry
  axialLength?: number;        // AL (mm) — enables Ferrara method
  // Contact Lens Over-Refraction
  clBaseCurve?: number;
  clPower?: number;            // 0 for plano
  clRefractionWith?: number;   // SE with CL (D)
  clRefractionWithout?: number;// SE without CL (D)
}

export interface PostRefHistoryInput extends PostRefNoHistoryInput {
  preOpKFlat: number;
  preOpKSteep: number;
  preOpSEQ: number;
  postOpSEQ: number;
  lasikRx?: number;            // Refractive change performed (negative for myopic)
  vertexDistance?: number;     // default 0.012 m
  atlasRingMean0_3?: number;   // Pre-computed mean — overrides individual ring values
  atlasRing0mm?: number;
  atlasRing1mm?: number;
  atlasRing2mm?: number;
  atlasRing3mm?: number;
  atlasRing4mm?: number;
  effRP?: number;              // EyeSys EffRP (D)
  // IOL formula constants (for power calculation)
  haigisA0?: number;           // a0; derived from A-const if blank
  haigisA1?: number;           // a1; default 0.4
  haigisA2?: number;           // a2; default 0.1
  sfHolladay1?: number;        // SF (Holladay 1); derived from A-const if blank
  hofferPACD?: number;         // pACD (Hoffer Q); derived from A-const if blank
  measuredACD?: number;        // Anterior chamber depth (mm) — required for Haigis IOL power
}

export interface PostRefResult {
  method: string;
  methodName: string;
  requiresHistory: boolean;
  adjustedKFlat: number;
  adjustedKSteep: number;
  adjustedMeanK: number;
  iolPowerAdjustment?: number; // D to add to standard-formula IOL (Masket, Feiz etc.)
  elpK?: number;               // Pre-op K used only for ELP in Double-K methods
  reference: string;
  formula: string;
  warning?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveTopoCentral(input: PostRefNoHistoryInput): { k: number; fromTopo: boolean } {
  const topoK = input.pentacamTNP
    ?? input.pentacamPWRSF4mm
    ?? input.galileiTCP2
    ?? input.tomeyACCP
    ?? input.atlasCentralPower
    ?? input.avgCentralPower;
  return topoK != null
    ? { k: topoK, fromTopo: true }
    : { k: (input.kFlat + input.kSteep) / 2, fromTopo: false };
}

function toCorneaPlane(rxSpec: number, V = 0.012): number {
  const d = 1 - V * rxSpec;
  return Math.abs(d) < 0.001 ? rxSpec : rxSpec / d;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function kToR(k: number): number { return 337.5 / k; }

function resolveAtlasRingMean(input: PostRefHistoryInput): number | undefined {
  if (input.atlasRingMean0_3 != null) return input.atlasRingMean0_3;
  const vals = [
    input.atlasRing0mm, input.atlasRing1mm, input.atlasRing2mm,
    input.atlasRing3mm, input.atlasRing4mm,
  ].filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
}

function refrChange(input: PostRefHistoryInput): number {
  return input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ);
}

// ══════════════════════════════════════════════════════════════════════════════
// K-CORRECTION METHODS — NO HISTORY
// ══════════════════════════════════════════════════════════════════════════════

// 1. Shammas-PL
//    K_adj = 1.14 × K − 6.8
//    Ref: Shammas HJ, Shammas MC. JCRS 2007;33:429-35.
export function shammasNoHistory(input: PostRefNoHistoryInput): PostRefResult {
  const adj = (k: number) => round2(1.14 * k - 6.8);
  const kF = adj(input.kFlat);
  const kS = adj(input.kSteep);
  return {
    method: 'shammas',
    methodName: 'Shammas-PL',
    requiresHistory: false,
    adjustedKFlat: kF, adjustedKSteep: kS,
    adjustedMeanK: round2((kF + kS) / 2),
    reference: 'Shammas & Shammas, JCRS 2007;33:429-35',
    formula: 'K_adj = 1.14 × K − 6.8',
  };
}

// 2. Haigis-L (no history)
//    Uses corneal radius; keratometric index n = 1.3315 → K = 331.5/r
//    r_corr = 331.5 / (−5.1625×r + 82.2603 − 0.35)
//    K_adj  = 331.5 / r_corr  = −5.1625×r + 81.9103
//    Ref: Haigis W. JCRS 2008;34:1106-15.
export function haigisL(input: PostRefNoHistoryInput): PostRefResult {
  const adjustOneK = (k: number): number => {
    const r = kToR(k);
    const rCorr = 331.5 / (-5.1625 * r + 82.2603 - 0.35);
    // Haigis-L uses n=1.3315 → K = 331.5/r (NOT 337.5/r)
    return round2(331.5 / rCorr);
  };
  const kF = adjustOneK(input.kFlat);
  const kS = adjustOneK(input.kSteep);
  return {
    method: 'haigis-l',
    methodName: 'Haigis-L',
    requiresHistory: false,
    adjustedKFlat: kF, adjustedKSteep: kS,
    adjustedMeanK: round2((kF + kS) / 2),
    reference: 'Haigis W, JCRS 2008;34:1106-15',
    formula: 'r_corr = 331.5/(−5.1625×r + 82.2603 − 0.35);  K_adj = 331.5/r_corr  (n=1.3315)',
    warning: 'IOLMaster corneal radii preferred; K-derived radius used here.',
  };
}

// 3. Wang-Koch-Maloney
//    K_adj = (K_central × 1.114) − 6.1
//    Ref: Koch DD, Wang L. JCRS 2003;29:2039-42.
export function wangKochMaloney(input: PostRefNoHistoryInput): PostRefResult {
  const meanK = (input.kFlat + input.kSteep) / 2;
  const { k: srcK, fromTopo } = resolveTopoCentral(input);
  const kAdj = srcK * 1.114 - 6.1;
  const ratio = kAdj / srcK;
  return {
    method: 'wkm',
    methodName: 'Wang-Koch-Maloney',
    requiresHistory: false,
    adjustedKFlat:  round2(input.kFlat  * ratio),
    adjustedKSteep: round2(input.kSteep * ratio),
    adjustedMeanK:  round2(kAdj),
    reference: 'Koch & Wang, JCRS 2003;29:2039-42',
    formula: 'K_adj = (K_central × 1.114) − 6.1',
    warning: fromTopo ? undefined : 'Atlas axial-map central K preferred; SimK used as fallback.',
  };
}

// 4. Maloney Central Topography
//    K_adj = 1.1141 × K_topoCTR − 5.5
//    Ref: Maloney RK. / Hoffer KJ, IOL Power 2011, Ch.32.
export function maloneyMethod(input: PostRefNoHistoryInput): PostRefResult {
  const { k: srcK, fromTopo } = resolveTopoCentral(input);
  const kAdj = srcK * 1.1141 - 5.5;
  const ratio = kAdj / srcK;
  return {
    method: 'maloney',
    methodName: 'Maloney Topography',
    requiresHistory: false,
    adjustedKFlat:  round2(input.kFlat  * ratio),
    adjustedKSteep: round2(input.kSteep * ratio),
    adjustedMeanK:  round2(kAdj),
    reference: 'Maloney RK / Hoffer KJ, IOL Power 2011',
    formula: 'K_adj = 1.1141 × K_topoCTR − 5.5',
    warning: fromTopo ? undefined : 'Topographic central K preferred; SimK used as fallback.',
  };
}

// 5. Savini-Barboni-Zanini (topography)
//    K_adj = 1.114 × K_topo − 4.98
//    Ref: Savini G et al. JCRS 2006;32:217-22.
export function saviniBarboniZanini(input: PostRefNoHistoryInput): PostRefResult {
  const { k: srcK, fromTopo } = resolveTopoCentral(input);
  const kAdj = srcK * 1.114 - 4.98;
  const ratio = kAdj / srcK;
  return {
    method: 'savini',
    methodName: 'Savini-Barboni-Zanini',
    requiresHistory: false,
    adjustedKFlat:  round2(input.kFlat  * ratio),
    adjustedKSteep: round2(input.kSteep * ratio),
    adjustedMeanK:  round2(kAdj),
    reference: 'Savini G et al. JCRS 2006;32:217-22',
    formula: 'K_adj = 1.114 × K_topo − 4.98',
    warning: fromTopo ? undefined : 'Topographic central K preferred; SimK used as fallback.',
  };
}

// 6. Ferrara Adjusted Refractive Index (no history, requires AL, LASIK/PRK only)
//    n_adj = −0.0006×AL² + 0.0213×AL + 1.1572
//    K_adj = (n_adj − 1) × 1000 / r_postop
//    Ref: Ferrara G. / Hoffer KJ, IOL Power 2011.
export function ferraraMethod(input: PostRefNoHistoryInput): PostRefResult | null {
  if (input.axialLength == null || input.procedure === 'RK') return null;
  const AL = input.axialLength;
  const meanK = (input.kFlat + input.kSteep) / 2;
  const r = kToR(meanK);
  const newN = -0.0006 * AL * AL + 0.0213 * AL + 1.1572;
  const kAdj = (newN - 1) * 1000 / r;
  const ratio = kAdj / meanK;
  return {
    method: 'ferrara',
    methodName: 'Ferrara (No-History)',
    requiresHistory: false,
    adjustedKFlat:  round2(input.kFlat  * ratio),
    adjustedKSteep: round2(input.kSteep * ratio),
    adjustedMeanK:  round2(kAdj),
    reference: 'Ferrara G. / Hoffer KJ, IOL Power 2011',
    formula: `n_adj = −0.0006×${AL}² + 0.0213×${AL} + 1.1572 = ${round2(newN)};  K_adj = ${round2(kAdj)} D`,
  };
}

// 7. Contact Lens Over-Refraction (no history)
//    K = BCL + PCL + R(with CL) − R(without CL)
//    Ref: Ridley N (1948) / Soper & Goffman (1974).
export function contactLensMethod(input: PostRefNoHistoryInput): PostRefResult | null {
  const { clBaseCurve, clRefractionWith, clRefractionWithout } = input;
  if (clBaseCurve == null || clRefractionWith == null || clRefractionWithout == null) return null;
  const PCL = input.clPower ?? 0;
  const kAdj = clBaseCurve + PCL + clRefractionWith - clRefractionWithout;
  return {
    method: 'contact-lens',
    methodName: 'Contact Lens Over-Refraction',
    requiresHistory: false,
    adjustedKFlat: round2(kAdj), adjustedKSteep: round2(kAdj),
    adjustedMeanK: round2(kAdj),
    reference: 'Ridley 1948 / Soper & Goffman 1974',
    formula: `K = BCL(${clBaseCurve}) + PCL(${PCL}) + R_with(${clRefractionWith}) − R_without(${clRefractionWithout}) = ${round2(kAdj)} D`,
    warning: 'Hard PMMA plano CL only — not RGP. Requires VA ≥ 20/80.',
  };
}

// 8. Double-K No History (Aramberri)
//    ELP from assumed normal K = 43.5 D; IOL power from post-op K
//    Ref: Aramberri J. JCRS 2003;29:2049-52.
export function aramberriDoubleKNoHx(input: PostRefNoHistoryInput): PostRefResult {
  return {
    method: 'double-k-nohx',
    methodName: 'Double-K No History (Aramberri)',
    requiresHistory: false,
    adjustedKFlat:  round2(input.kFlat),
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    elpK: 43.5,
    reference: 'Aramberri J, JCRS 2003;29:2049-52',
    formula: 'ELP from K = 43.5 D (assumed pre-refractive);  IOL vergence from post-op K',
    warning: 'Assumes pre-refractive K = 43.5 D. Use with-history version when pre-op K known.',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// K-CORRECTION METHODS — WITH HISTORY
// ══════════════════════════════════════════════════════════════════════════════

// 9. Clinical History Method
//    K_adj = K_pre − ΔRx_corneal
//    ΔRx_corneal = post-op corneal Rx − pre-op corneal Rx  (positive for myopic correction)
//    Ref: Holladay JT. Refract Corneal Surg 1989;5:203.
export function clinicalHistoryMethod(input: PostRefHistoryInput): PostRefResult {
  const V = input.vertexDistance ?? 0.012;
  const preRxCornea  = toCorneaPlane(input.preOpSEQ,  V);
  const postRxCornea = toCorneaPlane(input.postOpSEQ, V);
  const dRx = postRxCornea - preRxCornea; // positive = improvement
  const kF = round2(input.preOpKFlat  - dRx);
  const kS = round2(input.preOpKSteep - dRx);
  return {
    method: 'clinical-history',
    methodName: 'Clinical History',
    requiresHistory: true,
    adjustedKFlat: kF, adjustedKSteep: kS,
    adjustedMeanK: round2((kF + kS) / 2),
    reference: 'Holladay JT, Refract Corneal Surg 1989;5:203',
    formula: `K_adj = K_pre − ΔRx_corneal  (ΔRx = ${round2(dRx)} D)`,
  };
}

// 10. Savini Adjusted Refractive Index (history, LASIK/PRK only)
//     n_adj = 1.338 + 0.0009856 × RCS
//     K_adj = (n_adj − 1) × 1000 / r_postop
//     Ref: Savini G et al. / Hoffer KJ, IOL Power 2011.
export function saviniAdjustedIndex(input: PostRefHistoryInput): PostRefResult | null {
  if (input.procedure === 'RK') return null;
  const RCS = refrChange(input);
  const meanK = (input.kFlat + input.kSteep) / 2;
  const r = kToR(meanK);
  const newN = 1.338 + 0.0009856 * RCS;
  const kAdj = (newN - 1) * 1000 / r;
  const ratio = kAdj / meanK;
  return {
    method: 'savini-adj-index',
    methodName: 'Savini Adjusted Index',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat  * ratio),
    adjustedKSteep: round2(input.kSteep * ratio),
    adjustedMeanK:  round2(kAdj),
    reference: 'Savini G et al. / Hoffer KJ, IOL Power 2011',
    formula: `n_adj = 1.338 + 0.0009856×${round2(RCS)} = ${round2(newN)};  K_adj = ${round2(kAdj)} D`,
  };
}

// 11. Double-K With History (Aramberri)
//     ELP from actual pre-op K; IOL vergence from post-op K
//     Ref: Aramberri J. JCRS 2003;29:2049-52.
export function aramberriDoubleKHx(input: PostRefHistoryInput): PostRefResult {
  const preOpMeanK = round2((input.preOpKFlat + input.preOpKSteep) / 2);
  return {
    method: 'double-k-hx',
    methodName: 'Double-K With History (Aramberri)',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat),
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    elpK: preOpMeanK,
    reference: 'Aramberri J, JCRS 2003;29:2049-52',
    formula: `ELP from pre-op K = ${preOpMeanK} D;  IOL vergence from post-op K`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// IOL POWER ADJUSTMENT METHODS (applied on top of standard formula)
// ══════════════════════════════════════════════════════════════════════════════

// 12. Masket Formula
//     IOL_adj = (−0.326 × ΔRx) + 0.101
//     ΔRx = refractive change performed (negative for myopic correction)
//     Ref: Masket S, Masket SE. JCRS 2006;32:430-34.
export function masketFormula(input: PostRefHistoryInput): PostRefResult {
  const dRx = refrChange(input);
  const iolAdj = round2((-0.326 * dRx) + 0.101);
  return {
    method: 'masket',
    methodName: 'Masket Formula',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat),
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    iolPowerAdjustment: iolAdj,
    reference: 'Masket & Masket, JCRS 2006;32:430-34',
    formula: `IOL_adj = (−0.326 × ${round2(dRx)}) + 0.101 = ${iolAdj >= 0 ? '+' : ''}${iolAdj} D`,
  };
}

// 13. Modified Masket
//     IOL_adj = (ΔMR × −0.4385) + 0.0295
//     Ref: Masket S. JCRS 2006 (second dataset).
export function modifiedMasket(input: PostRefHistoryInput): PostRefResult {
  const dRx = refrChange(input);
  const iolAdj = round2((dRx * -0.4385) + 0.0295);
  return {
    method: 'modified-masket',
    methodName: 'Modified Masket',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat),
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    iolPowerAdjustment: iolAdj,
    reference: 'Masket S, JCRS 2006',
    formula: `IOL_adj = (${round2(dRx)} × −0.4385) + 0.0295 = ${iolAdj >= 0 ? '+' : ''}${iolAdj} D`,
  };
}

// 14. Feiz-Mannis Method (history required)
//     IOL_final = IOL_calculated_with_preop_K − ΔSE/0.7
//     ΔSE = pre − post SEQ (negative for myopic correction, so −ΔSE/0.7 is positive)
//     Shown as IOL adjustment relative to an IOL calculated with pre-op K.
//     Ref: Feiz V, Mannis MJ. JCRS 2004;30:16-22.
export function feizMannis(input: PostRefHistoryInput): PostRefResult {
  const dSE = refrChange(input);
  // ΔSE is negative for myopic correction; IOL_adj = −dSE/0.7 > 0 for myopia
  const iolAdj = round2(-dSE / 0.7);
  return {
    method: 'feiz-mannis',
    methodName: 'Feiz-Mannis',
    requiresHistory: true,
    adjustedKFlat:  round2(input.preOpKFlat),
    adjustedKSteep: round2(input.preOpKSteep),
    adjustedMeanK:  round2((input.preOpKFlat + input.preOpKSteep) / 2),
    iolPowerAdjustment: iolAdj,
    reference: 'Feiz & Mannis, JCRS 2004;30:16-22',
    formula: `Uses pre-op K;  IOL_adj = −ΔSE/0.7 = ${iolAdj >= 0 ? '+' : ''}${iolAdj} D`,
    warning: 'K values shown are pre-op. IOL adjustment added to IOL calculated with pre-op K.',
  };
}

// 15. Adjusted Atlas 0–3mm (topo + history)
//     K_adj = Atlas_mean(0-3mm) − (0.2 × ΔMR)
//     Ref: Wang et al. / ASCRS Calculator
export function adjustedAtlas(input: PostRefHistoryInput): PostRefResult | null {
  const ringMean = resolveAtlasRingMean(input);
  if (ringMean == null) return null;
  const dMR = refrChange(input);
  const kAdj = round2(ringMean - 0.2 * dMR);
  const ratio = kAdj / ringMean;
  return {
    method: 'adj-atlas',
    methodName: 'Adjusted Atlas 0–3mm',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat  * ratio),
    adjustedKSteep: round2(input.kSteep * ratio),
    adjustedMeanK:  kAdj,
    reference: 'Wang et al. / ASCRS Calculator',
    formula: `K_adj = ${round2(ringMean)} − (0.2 × ${round2(dMR)}) = ${kAdj} D`,
  };
}

// 16. Adjusted EffRP (EyeSys + history)
//     K_adj = EffRP − (0.15 × ΔMR) − 0.05
//     Ref: Koch D, Wang L / ASCRS Calculator
export function adjustedEffRP(input: PostRefHistoryInput): PostRefResult | null {
  if (input.effRP == null) return null;
  const dMR = refrChange(input);
  const kAdj = round2(input.effRP - 0.15 * dMR - 0.05);
  const ratio = kAdj / input.effRP;
  return {
    method: 'adj-effrp',
    methodName: 'Adjusted EffRP (EyeSys)',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat  * ratio),
    adjustedKSteep: round2(input.kSteep * ratio),
    adjustedMeanK:  kAdj,
    reference: 'Koch & Wang / ASCRS Calculator',
    formula: `K_adj = ${input.effRP} − (0.15 × ${round2(dMR)}) − 0.05 = ${kAdj} D`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// IOL POWER FORMULAS
// Retzlaff 1990 (SRK/T), Holladay 1988, Hoffer 1993, Haigis 1993.
// Corneal height H: half-chord = 2.75 mm  →  2.75² = 7.5625
// ══════════════════════════════════════════════════════════════════════════════

export function roundQtr(d: number): number { return Math.round(d * 4) / 4; }

// Thin-lens vergence equation used by Hoffer Q, Holladay 1, and Haigis.
// These formulas use measured AL directly (no SRK/T optical-path correction).
function vergenceIOL(meanK: number, AL: number, ELP: number, targetRx = 0): number {
  const n = 1.336;
  const R = 337.5 / meanK;
  const IOL_emme = (1000 * n * (n * R - (n - 1) * AL))
                 / ((AL - ELP) * (n * R - (n - 1) * ELP));
  return targetRx === 0 ? IOL_emme
    : IOL_emme + targetRx / (1 - 0.012 * targetRx);
}

/**
 * SRK/T — Retzlaff JA et al. JCRS 1990;16:333-40.
 * Uses optical path length Lopt (not raw AL) in vergence equation.
 * Corneal height: half-chord = 2.75 mm (5.5 mm pupil diameter).
 */
export function srktPower(
  meanK: number, AL: number, AConst: number, targetRx = 0,
): number {
  const Lcor = AL <= 24.2
    ? AL
    : -3.446 + 1.716 * AL - 0.0237 * AL * AL;
  const Lopt = 0.97971 * Lcor + 0.65696;
  const R    = 337.5 / meanK;
  // Half-chord = 2.75 mm  →  2.75² = 7.5625
  const H   = R - Math.sqrt(R * R - 7.5625);
  const Csf = 0.62467 * AConst - 68.747;
  const ELP = H + Csf;
  const n   = 1.336;
  const IOL_emme = (1000 * n * (n * R - (n - 1) * Lopt))
                 / ((Lopt - ELP) * (n * R - (n - 1) * ELP));
  return targetRx === 0 ? IOL_emme
    : IOL_emme + targetRx / (1 - 0.012 * targetRx);
}

/**
 * SRK/T Double-K (Aramberri 2003).
 * ELP from elpK (pre-op or assumed 43.5 D); vergence from post-op K.
 */
export function srktPowerDoubleK(
  meanKPost: number, elpK: number, AL: number, AConst: number, targetRx = 0,
): number {
  const Lcor = AL <= 24.2
    ? AL
    : -3.446 + 1.716 * AL - 0.0237 * AL * AL;
  const Lopt   = 0.97971 * Lcor + 0.65696;
  const R_elp  = 337.5 / elpK;
  const H_elp  = R_elp - Math.sqrt(R_elp * R_elp - 7.5625);
  const ELP    = H_elp + (0.62467 * AConst - 68.747);
  const R_post = 337.5 / meanKPost;
  const n      = 1.336;
  const IOL_emme = (1000 * n * (n * R_post - (n - 1) * Lopt))
                 / ((Lopt - ELP) * (n * R_post - (n - 1) * ELP));
  return targetRx === 0 ? IOL_emme
    : IOL_emme + targetRx / (1 - 0.012 * targetRx);
}

/**
 * Hoffer Q — Hoffer KJ. JCRS 1993;19:700-712.
 * ELP = pACD + 0.3 × (AL − 23.5)   [simplified; full formula also includes K]
 * Uses measured AL directly.
 */
export function hofferQPower(meanK: number, AL: number, pACD: number, targetRx = 0): number {
  return vergenceIOL(meanK, AL, pACD + 0.3 * (AL - 23.5), targetRx);
}

/**
 * Holladay 1 — Holladay JT et al. JCRS 1988;14:17-24.
 * ELP = CCT + H_wtw + SF
 * H_wtw uses WHITE-TO-WHITE chord (corneal diameter ~11.5 mm), NOT pupil size.
 * WTW half-chord = 5.75 mm → 5.75² = 33.0625
 * CCT = 0.56 mm (mean central corneal thickness, constant in Holladay 1)
 * Uses measured AL directly (no SRK/T optical-path correction).
 */
export function holladay1Power(meanK: number, AL: number, SF: number, targetRx = 0): number {
  const R    = 337.5 / meanK;
  const H    = R - Math.sqrt(R * R - 33.0625); // WTW half-chord = 5.75 mm
  const CCT  = 0.56;
  return vergenceIOL(meanK, AL, CCT + H + SF, targetRx);
}

/** Holladay 1 Double-K: ELP from elpK; vergence from post-op K. */
export function holladay1PowerDoubleK(
  meanKPost: number, elpK: number, AL: number, SF: number, targetRx = 0,
): number {
  const R_elp = 337.5 / elpK;
  const H_elp = R_elp - Math.sqrt(R_elp * R_elp - 33.0625);
  return vergenceIOL(meanKPost, AL, 0.56 + H_elp + SF, targetRx);
}

/**
 * Haigis — Haigis W. JCRS 1993.
 * d = a0 + a1 × ACD_measured + a2 × AL
 * Uses measured ACD and raw AL.
 */
export function haigisIOLPower(
  meanK: number, AL: number, measuredACD: number,
  a0: number, a1 = 0.4, a2 = 0.1, targetRx = 0,
): number {
  return vergenceIOL(meanK, AL, a0 + a1 * measuredACD + a2 * AL, targetRx);
}

// A-constant → formula-specific constants
export function aConstToSF(A: number): number { return 0.5663 * A - 65.60; }
export function aConstToPACD(A: number): number { return 0.58357 * A - 63.896; }
export function aConstToHaigisA0(A: number): number { return 0.62467 * A - 72.434; }

// ══════════════════════════════════════════════════════════════════════════════
// CONSENSUS
// ══════════════════════════════════════════════════════════════════════════════

/** Mean K of all no-history, non-Double-K methods (ASCRS/ESCRS approach). */
export function noHistoryConsensus(results: PostRefResult[]): {
  meanKFlat: number; meanKSteep: number; meanK: number;
} {
  const noHx = results.filter(r => !r.requiresHistory && r.elpK == null && r.adjustedMeanK > 0);
  if (!noHx.length) return { meanKFlat: 0, meanKSteep: 0, meanK: 0 };
  return {
    meanKFlat:  round2(noHx.reduce((s, r) => s + r.adjustedKFlat,  0) / noHx.length),
    meanKSteep: round2(noHx.reduce((s, r) => s + r.adjustedKSteep, 0) / noHx.length),
    meanK:      round2(noHx.reduce((s, r) => s + r.adjustedMeanK,  0) / noHx.length),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// RUN ALL APPLICABLE METHODS
// ══════════════════════════════════════════════════════════════════════════════

export function runAllMethods(
  noHxInput: PostRefNoHistoryInput,
  hxInput?: PostRefHistoryInput,
): PostRefResult[] {
  const results: PostRefResult[] = [];

  // No-history K-correction methods
  results.push(shammasNoHistory(noHxInput));
  if (noHxInput.procedure !== 'RK') results.push(haigisL(noHxInput));
  results.push(wangKochMaloney(noHxInput));
  results.push(maloneyMethod(noHxInput));
  results.push(saviniBarboniZanini(noHxInput));

  const ferrara = ferraraMethod(noHxInput);
  if (ferrara) results.push(ferrara);

  const cl = contactLensMethod(noHxInput);
  if (cl) results.push(cl);

  results.push(aramberriDoubleKNoHx(noHxInput));

  // History-based methods
  if (hxInput) {
    results.push(clinicalHistoryMethod(hxInput));
    results.push(aramberriDoubleKHx(hxInput));

    const savAdj = saviniAdjustedIndex(hxInput);
    if (savAdj) results.push(savAdj);

    // IOL power adjustment methods (keep separate in display)
    results.push(masketFormula(hxInput));
    results.push(modifiedMasket(hxInput));
    results.push(feizMannis(hxInput));

    const atlas = adjustedAtlas(hxInput);
    if (atlas) results.push(atlas);

    const effrp = adjustedEffRP(hxInput);
    if (effrp) results.push(effrp);
  }

  return results;
}
