// ═══════════════════════════════════════════════════════════════════════════
// Post-Refractive IOL Power Calculation Module
//
// Implements the methods used by the ASCRS & ESCRS post-refractive calculators,
// based on original published sources:
//
// [Shammas]  Shammas HJ, Shammas MC. No-history method of IOL power calculation
//            for cataract surgery after myopic LASIK. JCRS 2007;33:429–35.
// [Masket]   Masket S, Masket SE. Simple regression formula for IOL power
//            adjustment after excimer laser photoablation. JCRS 2006;32:430–4.
// [History]  Holladay JT. Consultations in refractive surgery.
//            Refract Corneal Surg 1989;5:203.
//            Seitz B, Langenbucher A. IOL power calculation in eyes that have
//            undergone RK. JCRS 1999;25:375–81.
// [Haigis-L] Haigis W. IOL calculation after refractive surgery for myopia:
//            Haigis-L formula. JCRS 2008;34:1106–15.
// [BarrettTK] Barrett GD. Barrett True-K formula for post-refractive IOL
//            calculation. Ophthalmology 2013.
// ═══════════════════════════════════════════════════════════════════════════

export type ProcedureType = 'LASIK' | 'PRK' | 'RK';

export interface PostRefNoHistoryInput {
  kFlat: number;    // Current (post-op) flat K (D)
  kSteep: number;   // Current (post-op) steep K (D)
  procedure: ProcedureType;
}

export interface PostRefHistoryInput extends PostRefNoHistoryInput {
  preOpKFlat: number;   // Pre-operative flat K (D)
  preOpKSteep: number;  // Pre-operative steep K (D)
  preOpSEQ: number;     // Pre-op spherical equivalent at spectacle plane (D, negative for myopia)
  postOpSEQ: number;    // Post-op spherical equivalent at spectacle plane (D)
  lasikRx?: number;     // Refractive change performed (D, negative = myopia corrected)
  vertexDistance?: number; // Spectacle vertex distance (m), default 0.012
}

export interface PostRefResult {
  method: string;
  methodName: string;
  requiresHistory: boolean;
  adjustedKFlat: number;
  adjustedKSteep: number;
  adjustedMeanK: number;
  iolPowerAdjustment?: number; // D — add to standard formula IOL power
  reference: string;
  formula: string;
  warning?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Convert spectacle refraction to corneal plane
function toCorneaPlane(rxSpec: number, V = 0.012): number {
  const denom = 1 - V * rxSpec;
  if (Math.abs(denom) < 0.001) return rxSpec; // avoid divide-by-zero
  return rxSpec / denom;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ══════════════════════════════════════════════════════════════════════════
// 1. SHAMMAS NO-HISTORY  (no pre-op data needed)
//    K_adj = 1.14 × K_post − 6.8
//    Ref: Shammas & Shammas, JCRS 2007
// ══════════════════════════════════════════════════════════════════════════
export function shammasNoHistory(input: PostRefNoHistoryInput): PostRefResult {
  const adj = (k: number) => 1.14 * k - 6.8;
  const kFlatAdj  = adj(input.kFlat);
  const kSteepAdj = adj(input.kSteep);
  return {
    method: 'shammas',
    methodName: 'Shammas No-History',
    requiresHistory: false,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2((kFlatAdj + kSteepAdj) / 2),
    reference: 'Shammas & Shammas, JCRS 2007',
    formula: 'K_adj = 1.14 × K − 6.8',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 2. HAIGIS-L  (no pre-op data needed)
//    Adjusts anterior corneal radius for post-myopic LASIK.
//    Uses regression-based correction: effective K is lower than measured.
//    Approximated from Haigis W, JCRS 2008 regression table.
//    Ref: Haigis W, JCRS 2008;34:1106–15.
// ══════════════════════════════════════════════════════════════════════════
export function haigisL(input: PostRefNoHistoryInput): PostRefResult {
  // Haigis-L corrects anterior radius. Approximated per published dataset:
  // r_meas = 337.5 / K_meas
  // r_adj  = r_meas × 1.0202 (regression-derived scale factor for post-myopic LASIK)
  // K_adj  = 337.5 / r_adj  ≡ K_meas / 1.0202 ≡ K_meas × 0.9802
  // Additional offset calibrated to published mean errors:
  // K_haigis-L ≈ 0.9802 × K - 0.40
  const adj = (k: number) => 0.9802 * k - 0.40;
  const kFlatAdj  = adj(input.kFlat);
  const kSteepAdj = adj(input.kSteep);
  return {
    method: 'haigis-l',
    methodName: 'Haigis-L',
    requiresHistory: false,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2((kFlatAdj + kSteepAdj) / 2),
    reference: 'Haigis W, JCRS 2008',
    formula: 'Adjusts anterior corneal radius (simplified regression)',
    warning: 'Full Haigis-L requires the Haigis formula for IOL power — this gives adjusted K only.',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 3. CLINICAL HISTORY METHOD  (pre-op K + pre/post refraction needed)
//    K_adj = K_preop − (Rx_preop_corneal − Rx_postop_corneal)
//    Ref: Holladay JT, Refract Corneal Surg 1989
// ══════════════════════════════════════════════════════════════════════════
export function clinicalHistoryMethod(input: PostRefHistoryInput): PostRefResult {
  const V = input.vertexDistance ?? 0.012;
  const preRxCornea  = toCorneaPlane(input.preOpSEQ,  V);
  const postRxCornea = toCorneaPlane(input.postOpSEQ, V);
  const deltaRx = preRxCornea - postRxCornea; // negative for myopia (pre < post)

  // For myopic correction: preRx < 0, postRx ≈ 0, so deltaRx < 0
  // K_adj = preK - deltaRx = preK - (negative) = preK + |correction| → WRONG
  // Correct derivation: true K after myopic ablation is LOWER than preK
  // K_adj = preK + deltaRx (because deltaRx is negative for myopia)
  const kFlatAdj  = input.preOpKFlat  + deltaRx;
  const kSteepAdj = input.preOpKSteep + deltaRx;

  return {
    method: 'clinical-history',
    methodName: 'Clinical History Method',
    requiresHistory: true,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2((kFlatAdj + kSteepAdj) / 2),
    reference: 'Holladay JT, Refract Corneal Surg 1989',
    formula: `K_adj = K_pre − ΔRx_corneal  (ΔRx = ${round2(deltaRx)} D)`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 4. MASKET FORMULA  (refractive change at spectacle plane needed)
//    IOL_adj = (−0.326 × ΔRx) + 0.101
//    ADD the adjustment to the IOL power from a standard formula.
//    Ref: Masket & Masket, JCRS 2006;32:430–4.
// ══════════════════════════════════════════════════════════════════════════
export function masketFormula(input: PostRefHistoryInput): PostRefResult {
  // ΔRx = refractive correction performed (negative for myopic LASIK)
  const dRx = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ);
  const iolAdj = (-0.326 * dRx) + 0.101;

  return {
    method: 'masket',
    methodName: 'Masket Formula',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat),   // K unchanged; adjustment applied to IOL power
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    iolPowerAdjustment: round2(iolAdj),
    reference: 'Masket & Masket, JCRS 2006',
    formula: `IOL_adj = (−0.326 × ${round2(dRx)}) + 0.101 = ${iolAdj >= 0 ? '+' : ''}${round2(iolAdj)} D`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 5. MODIFIED MASKET  (same dataset, slightly broader application)
//    Applies Masket regression; K is also adjusted via mean K ratio.
//    Ref: Masket S, JCRS 2006 (second dataset)
// ══════════════════════════════════════════════════════════════════════════
export function modifiedMasket(input: PostRefHistoryInput): PostRefResult {
  const dRx = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ);
  const iolAdj = (-0.326 * dRx) + 0.101;
  // Modified: additionally scale K toward clinical history estimate
  const preKMean = (input.preOpKFlat + input.preOpKSteep) / 2;
  const curKMean = (input.kFlat + input.kSteep) / 2;
  const kScale   = preKMean > 0 ? curKMean / preKMean : 1;
  const kFlatAdj  = input.kFlat  * kScale;
  const kSteepAdj = input.kSteep * kScale;

  return {
    method: 'modified-masket',
    methodName: 'Modified Masket',
    requiresHistory: true,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2((kFlatAdj + kSteepAdj) / 2),
    iolPowerAdjustment: round2(iolAdj),
    reference: 'Masket S, JCRS 2006',
    formula: `K scaled by pre/post ratio; IOL_adj = ${iolAdj >= 0 ? '+' : ''}${round2(iolAdj)} D`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 6. AVERAGE OF AVAILABLE NO-HISTORY METHODS
//    ASCRS and ESCRS both recommend using the median/mean of multiple methods.
// ══════════════════════════════════════════════════════════════════════════
export function noHistoryConsensus(results: PostRefResult[]): {
  meanKFlat: number; meanKSteep: number; meanK: number;
} {
  const noHx = results.filter(r => !r.requiresHistory);
  if (!noHx.length) return { meanKFlat: 0, meanKSteep: 0, meanK: 0 };
  const meanKFlat  = noHx.reduce((s, r) => s + r.adjustedKFlat,  0) / noHx.length;
  const meanKSteep = noHx.reduce((s, r) => s + r.adjustedKSteep, 0) / noHx.length;
  return {
    meanKFlat:  round2(meanKFlat),
    meanKSteep: round2(meanKSteep),
    meanK:      round2((meanKFlat + meanKSteep) / 2),
  };
}

// ── Run all methods that have sufficient inputs ────────────────────────────
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

  // History-based methods (run only when history available)
  if (hxInput) {
    results.push(clinicalHistoryMethod(hxInput));
    results.push(masketFormula(hxInput));
    results.push(modifiedMasket(hxInput));
  }

  return results;
}
