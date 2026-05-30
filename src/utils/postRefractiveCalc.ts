// ═══════════════════════════════════════════════════════════════════════════
// Post-Refractive IOL Calculation Module
//
// Implements the methods used by the ASCRS & ESCRS post-refractive calculators.
// Formulas extracted from primary published sources:
//
// [Shammas]   Shammas HJ, Shammas MC. Am J Ophthalmol 2003;136:426-32.
//             JCRS 2007;33:429-35. K_corr = 1.14×K − 6.8
// [Haigis-L]  Haigis W. JCRS 2008;34:1106-15.
//             r_corr = 331.5/(−5.1625×r_meas + 82.2603 − 0.35)
// [WKM]       Wang L, Koch DD. JCRS 2003;29:2039-42.
//             K_adj = (Atlas_central × 1.114) − 6.1
// [History]   Holladay JT. Refract Corneal Surg 1989;5:203.
// [Masket]    Masket S, Masket SE. JCRS 2006;32:430-34.
//             IOL_adj = (−0.326 × ΔRx) + 0.101
// [ModMasket] Masket S. JCRS 2006 (Modified/Hill variant).
//             IOL_adj = (ΔMR × −0.4385) + 0.0295
// [Feiz]      Feiz V, Mannis MJ. JCRS 2004;30:16-22.
//             IOL_adj = IOL_preK − ΔSE/0.7
// [Latkany]   Latkany DL et al. JCRS 2005;31:562-70.
//             IOL_adj = IOL_flatK + (−0.47 × ΔMR + 0.85)
// [AdjAtlas]  Wang et al. IOL_adj = AtlasMean_0-3 − (0.2 × ΔMR)
// [AdjEffRP]  Koch D, Wang L. IOL_adj = EffRP − (0.15 × ΔMR) − 0.05
// ═══════════════════════════════════════════════════════════════════════════

export type ProcedureType = 'LASIK' | 'PRK' | 'RK';

export interface PostRefNoHistoryInput {
  kFlat: number;    // Current (post-op) flat K (D)
  kSteep: number;   // Current (post-op) steep K (D)
  procedure: ProcedureType;
}

export interface PostRefHistoryInput extends PostRefNoHistoryInput {
  preOpKFlat: number;
  preOpKSteep: number;
  preOpSEQ: number;     // Spectacle plane SEQ (D, negative for myopia)
  postOpSEQ: number;
  lasikRx?: number;     // Refractive change performed (D, negative = myopic)
  vertexDistance?: number; // Default 0.012 m
  // Optional topography inputs
  atlasCentralPower?: number; // Atlas axial map central K (D) — for WKM
  atlasRingMean0_3?: number;  // Atlas 0–3mm ring mean (D) — for Adjusted Atlas
  effRP?: number;             // EyeSys EffRP (D) — for Adjusted EffRP
}

export interface PostRefResult {
  method: string;
  methodName: string;
  requiresHistory: boolean;
  adjustedKFlat: number;
  adjustedKSteep: number;
  adjustedMeanK: number;
  iolPowerAdjustment?: number; // D added to standard formula IOL power
  reference: string;
  formula: string;
  warning?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Spectacle → corneal plane refraction (vertex 12 mm) */
function toCorneaPlane(rxSpec: number, V = 0.012): number {
  const d = 1 - V * rxSpec;
  if (Math.abs(d) < 0.001) return rxSpec;
  return rxSpec / d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert K (D) to corneal radius (mm) using keratometric index 1.3375 */
function kToR(k: number): number { return 337.5 / k; }
/** Convert corneal radius (mm) to K (D) */
function rToK(r: number): number { return 337.5 / r; }

// ══════════════════════════════════════════════════════════════════════════
// 1. SHAMMAS-PL NO-HISTORY
//    K_corr = 1.14 × K_post − 6.8
//    Ref: Shammas HJ, Am J Ophthalmol 2003 / JCRS 2007
// ══════════════════════════════════════════════════════════════════════════
export function shammasNoHistory(input: PostRefNoHistoryInput): PostRefResult {
  const adj = (k: number) => 1.14 * k - 6.8;
  const kFlatAdj  = adj(input.kFlat);
  const kSteepAdj = adj(input.kSteep);
  return {
    method: 'shammas',
    methodName: 'Shammas-PL No-History',
    requiresHistory: false,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2((kFlatAdj + kSteepAdj) / 2),
    reference: 'Shammas & Shammas, JCRS 2007',
    formula: 'K_adj = 1.14 × K − 6.8',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 2. HAIGIS-L (exact published coefficients, no history needed)
//    r_corr = 331.5 / (−5.1625 × r_meas + 82.2603 − 0.35)
//    K_adj  = 337.5 / r_corr
//    Ref: Haigis W, JCRS 2008;34:1106–15.
//    Validated: r_meas=8.73mm → K_adj≈37.5 D
// ══════════════════════════════════════════════════════════════════════════
export function haigisL(input: PostRefNoHistoryInput): PostRefResult {
  const adjustOneK = (k: number): number => {
    const r = kToR(k);
    const rCorr = 331.5 / (-5.1625 * r + 82.2603 - 0.35);
    return rToK(rCorr);
  };

  const kFlatAdj  = adjustOneK(input.kFlat);
  const kSteepAdj = adjustOneK(input.kSteep);

  return {
    method: 'haigis-l',
    methodName: 'Haigis-L',
    requiresHistory: false,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2((kFlatAdj + kSteepAdj) / 2),
    reference: 'Haigis W, JCRS 2008;34:1106–15',
    formula: 'r_corr = 331.5/(−5.1625×r + 82.2603 − 0.35); K_adj = 337.5/r_corr',
    warning: 'IOLMaster corneal radii preferred; K-derived radius used here.',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 3. WANG-KOCH-MALONEY (topography-based, no history)
//    K_adj = (Atlas_central_K × 1.114) − 6.1
//    Ref: Koch D, Wang L. JCRS 2003;29:2039-42.
//    Note: Designed for Atlas axial-map central K; applied to SimK as fallback.
// ══════════════════════════════════════════════════════════════════════════
export function wangKochMaloney(
  input: PostRefNoHistoryInput,
  atlasCentralPower?: number,
): PostRefResult {
  const meanK = (input.kFlat + input.kSteep) / 2;
  const sourceK = atlasCentralPower ?? meanK;
  const isAtlas = atlasCentralPower != null;

  const kAdj = (sourceK * 1.114) - 6.1;
  // For astigmatism, apply the same correction ratio to flat and steep
  const ratio = kAdj / sourceK;
  const kFlatAdj  = input.kFlat  * ratio;
  const kSteepAdj = input.kSteep * ratio;

  return {
    method: 'wkm',
    methodName: 'Wang-Koch-Maloney',
    requiresHistory: false,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2(kAdj),
    reference: 'Koch & Wang, JCRS 2003;29:2039-42',
    formula: 'K_adj = (K_central × 1.114) − 6.1',
    warning: isAtlas ? undefined : 'Atlas central K preferred; SimK used as fallback.',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 4. CLINICAL HISTORY METHOD  (history required)
//    K_adj = K_pre − (Rx_post_corneal − Rx_pre_corneal)
//    Ref: Holladay JT, Refract Corneal Surg 1989
// ══════════════════════════════════════════════════════════════════════════
export function clinicalHistoryMethod(input: PostRefHistoryInput): PostRefResult {
  const V = input.vertexDistance ?? 0.012;
  const preRxCornea  = toCorneaPlane(input.preOpSEQ,  V);
  const postRxCornea = toCorneaPlane(input.postOpSEQ, V);
  const rcc = postRxCornea - preRxCornea; // negative for myopic correction

  const kFlatAdj  = input.preOpKFlat  - rcc;
  const kSteepAdj = input.preOpKSteep - rcc;

  return {
    method: 'clinical-history',
    methodName: 'Clinical History Method',
    requiresHistory: true,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2((kFlatAdj + kSteepAdj) / 2),
    reference: 'Holladay JT, Refract Corneal Surg 1989',
    formula: `K_adj = K_pre − ΔRx_corneal  (ΔRx = ${round2(rcc)} D)`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 5. MASKET FORMULA  (refractive change required)
//    IOL_adj = (−0.326 × ΔRx) + 0.101   [add to standard formula IOL]
//    ΔRx = LASIK refractive change (negative for myopic correction)
//    Ref: Masket & Masket, JCRS 2006;32:430-34.
// ══════════════════════════════════════════════════════════════════════════
export function masketFormula(input: PostRefHistoryInput): PostRefResult {
  const dRx = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ);
  const iolAdj = (-0.326 * dRx) + 0.101;

  return {
    method: 'masket',
    methodName: 'Masket Formula',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat),
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    iolPowerAdjustment: round2(iolAdj),
    reference: 'Masket & Masket, JCRS 2006;32:430-34',
    formula: `IOL_adj = (−0.326 × ${round2(dRx)}) + 0.101 = ${iolAdj >= 0 ? '+' : ''}${round2(iolAdj)} D`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 6. MODIFIED MASKET (Hill variant)
//    IOL_adj = (ΔMR × −0.4385) + 0.0295
//    Ref: Masket S, JCRS 2006 (second dataset / Hill modification)
// ══════════════════════════════════════════════════════════════════════════
export function modifiedMasket(input: PostRefHistoryInput): PostRefResult {
  const dRx = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ);
  const iolAdj = (dRx * -0.4385) + 0.0295;

  return {
    method: 'modified-masket',
    methodName: 'Modified Masket (Hill)',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat),
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    iolPowerAdjustment: round2(iolAdj),
    reference: 'Masket S, JCRS 2006 (Hill variant)',
    formula: `IOL_adj = (ΔMR × −0.4385) + 0.0295 = ${iolAdj >= 0 ? '+' : ''}${round2(iolAdj)} D`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 7. FEIZ-MANNIS METHOD  (history required)
//    Uses pre-op K in standard formula; adjusts IOL by ΔSE/0.7
//    IOL_final = IOL_preK − ΔSE/0.7  (ΔSE negative for myopic correction)
//    Ref: Feiz V, Mannis MJ. JCRS 2004;30:16-22.
// ══════════════════════════════════════════════════════════════════════════
export function feizMannis(input: PostRefHistoryInput): PostRefResult {
  const dSE = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ); // negative for myopia
  // IOL adjustment to add on top of an IOL calculated with pre-op Ks:
  //   IOL_adj = -dSE/0.7  (for myopia, dSE < 0, so adj > 0 — adds power)
  const iolAdj = -dSE / 0.7;

  return {
    method: 'feiz-mannis',
    methodName: 'Feiz-Mannis',
    requiresHistory: true,
    adjustedKFlat:  round2(input.preOpKFlat),
    adjustedKSteep: round2(input.preOpKSteep),
    adjustedMeanK:  round2((input.preOpKFlat + input.preOpKSteep) / 2),
    iolPowerAdjustment: round2(iolAdj),
    reference: 'Feiz & Mannis, JCRS 2004;30:16-22',
    formula: `Uses pre-op K; IOL_adj = −ΔSE/0.7 = ${iolAdj >= 0 ? '+' : ''}${round2(iolAdj)} D`,
    warning: 'K shown is pre-op; enter these K values in the Toric Calculator with the IOL adjustment.',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 8. LATKANY FLAT-K METHOD  (history required)
//    IOL_adj = IOL_flatK + (−0.47 × ΔMR + 0.85)  [IOL from SRK/T with flat K]
//    Expressed as IOL power adjustment to the flat-K calculation:
//    adj_component = −0.47 × ΔMR + 0.85
//    Ref: Latkany DL et al. JCRS 2005;31:562-70.
// ══════════════════════════════════════════════════════════════════════════
export function latkanyFlatK(input: PostRefHistoryInput): PostRefResult {
  const dMR = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ); // negative for myopia
  const iolAdj = (-0.47 * dMR) + 0.85; // positive for myopic correction

  return {
    method: 'latkany',
    methodName: 'Latkany Flat-K',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat),  // uses flat (minimum) K
    adjustedKSteep: round2(input.kFlat),  // same — flat K used for both
    adjustedMeanK:  round2(input.kFlat),
    iolPowerAdjustment: round2(iolAdj),
    reference: 'Latkany DL et al. JCRS 2005;31:562-70',
    formula: `IOL_adj = (−0.47 × ${round2(dMR)}) + 0.85 = ${iolAdj >= 0 ? '+' : ''}${round2(iolAdj)} D  [with flat K]`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 9. ADJUSTED ATLAS 0-3mm  (topography + history required)
//    K_adj = Atlas_0-3_mean − (0.2 × ΔMR)
//    Ref: Wang et al. / ASCRS Post-Refractive Calculator
// ══════════════════════════════════════════════════════════════════════════
export function adjustedAtlas(
  input: PostRefHistoryInput,
): PostRefResult | null {
  if (input.atlasRingMean0_3 == null) return null;

  const dMR = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ);
  const kAdj = input.atlasRingMean0_3 - (0.2 * dMR);
  const ratio = kAdj / input.atlasRingMean0_3;
  const kFlatAdj  = input.kFlat  * ratio;
  const kSteepAdj = input.kSteep * ratio;

  return {
    method: 'adj-atlas',
    methodName: 'Adjusted Atlas 0-3mm',
    requiresHistory: true,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2(kAdj),
    reference: 'Wang et al. / ASCRS Calculator',
    formula: `K_adj = ${input.atlasRingMean0_3} − (0.2 × ${round2(dMR)}) = ${round2(kAdj)} D`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 10. ADJUSTED EFF-RP  (EyeSys topography + history required)
//     K_adj = EffRP − (0.15 × ΔMR) − 0.05
//     Ref: Koch D, Wang L / ASCRS Calculator
// ══════════════════════════════════════════════════════════════════════════
export function adjustedEffRP(
  input: PostRefHistoryInput,
): PostRefResult | null {
  if (input.effRP == null) return null;

  const dMR = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ);
  const kAdj = input.effRP - (0.15 * dMR) - 0.05;
  const ratio = kAdj / input.effRP;
  const kFlatAdj  = input.kFlat  * ratio;
  const kSteepAdj = input.kSteep * ratio;

  return {
    method: 'adj-effrp',
    methodName: 'Adjusted EffRP (EyeSys)',
    requiresHistory: true,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2(kAdj),
    reference: 'Koch & Wang / ASCRS Calculator',
    formula: `K_adj = ${input.effRP} − (0.15 × ${round2(dMR)}) − 0.05 = ${round2(kAdj)} D`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// CONSENSUS: average K of all no-history methods (ASCRS/ESCRS approach)
// ══════════════════════════════════════════════════════════════════════════
export function noHistoryConsensus(results: PostRefResult[]): {
  meanKFlat: number; meanKSteep: number; meanK: number;
} {
  const noHx = results.filter(r => !r.requiresHistory && r.adjustedMeanK > 0);
  if (!noHx.length) return { meanKFlat: 0, meanKSteep: 0, meanK: 0 };
  return {
    meanKFlat:  round2(noHx.reduce((s, r) => s + r.adjustedKFlat,  0) / noHx.length),
    meanKSteep: round2(noHx.reduce((s, r) => s + r.adjustedKSteep, 0) / noHx.length),
    meanK:      round2(noHx.reduce((s, r) => s + r.adjustedMeanK,  0) / noHx.length),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// RUN ALL APPLICABLE METHODS
// ══════════════════════════════════════════════════════════════════════════
export function runAllMethods(
  noHxInput: PostRefNoHistoryInput,
  hxInput?: PostRefHistoryInput,
): PostRefResult[] {
  const results: PostRefResult[] = [];

  // No-history methods (always run)
  results.push(shammasNoHistory(noHxInput));
  if (noHxInput.procedure !== 'RK') {
    results.push(haigisL(noHxInput));
  }
  results.push(wangKochMaloney(noHxInput, hxInput?.atlasCentralPower));

  // History-based methods
  if (hxInput) {
    results.push(clinicalHistoryMethod(hxInput));
    results.push(masketFormula(hxInput));
    results.push(modifiedMasket(hxInput));
    results.push(feizMannis(hxInput));
    results.push(latkanyFlatK(hxInput));

    const atlas = adjustedAtlas(hxInput);
    if (atlas) results.push(atlas);

    const effrp = adjustedEffRP(hxInput);
    if (effrp) results.push(effrp);
  }

  return results;
}
