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
// [Maloney]   Maloney RK. Central topography method.
//             K_adj = 1.1141 × TKPO-CTR − 5.5
// [Savini]    Savini G, Barboni P, Zanini M. JCRS 2006.
//             K_adj = 1.114 × KtPO − 4.98
// [DblK-NoHx] Aramberri J. JCRS 2003;29:2049-52 (no-history version).
//             ELP from K=43.5 D; IOL power from post-op K
// [DblK-Hx]  Aramberri J. JCRS 2003;29:2049-52 (with-history version).
//             ELP from pre-op K; IOL power from post-op K
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
  // Optional topography — no pre-op history required
  // Myopic LASIK / PRK
  pentacamTNP?: number;       // Pentacam TNP_Apex_4.0mm Zone (D) — myopic LASIK/PRK
  galileiTCP2?: number;       // Galilei TCP2 (D)
  tomeyACCP?: number;         // Tomey ACCP / Nidek ACP/APP (D)
  atlasCentralPower?: number; // Atlas 9000 4mm zone central K (D)
  // RK-specific
  pentacamPWRSF4mm?: number;  // Pentacam PWR_SF_Pupil_4.0mm Zone (D) — sagittal curvature (RK)
  pentacamCTMin?: number;     // Pentacam CT_MIN — minimum central corneal thickness (µm)
  avgCentralPower?: number;   // Average Central Power from topo devices (D) — RK, not SimK
}

export interface PostRefHistoryInput extends PostRefNoHistoryInput {
  preOpKFlat: number;
  preOpKSteep: number;
  preOpSEQ: number;     // Spectacle plane SEQ (D, negative for myopia)
  postOpSEQ: number;
  lasikRx?: number;     // Refractive change performed (D, negative = myopic)
  vertexDistance?: number; // Default 0.012 m
  // Topography inputs (history-dependent methods)
  atlasRingMean0_3?: number;  // Atlas 0–3mm ring mean (D) — overrides individual ring values
  atlasRing0mm?: number;      // Atlas ring 0mm (D) — LASIK/PRK
  atlasRing1mm?: number;      // Atlas ring 1mm (D)
  atlasRing2mm?: number;      // Atlas ring 2mm (D)
  atlasRing3mm?: number;      // Atlas ring 3mm (D)
  atlasRing4mm?: number;      // Atlas ring 4mm (D) — RK (rings go 1–4mm, not 0–3mm)
  effRP?: number;             // EyeSys EffRP (D)
  // OCT (RTVue or Avanti XR)
  octNetCornealPower?: number;       // Net Corneal Power (D)
  octPosteriorCornealPower?: number; // Posterior Corneal Power (D)
  centralCornealThickness?: number;  // Central pachymetry (µm)
  // Lens constants (for future Haigis IOL power calculation)
  haigisA0?: number;          // Haigis a0 (if empty, converted from A-const)
  haigisA1?: number;          // Haigis a1 (if empty, 0.4 used)
  haigisA2?: number;          // Haigis a2 (if empty, 0.1 used)
  sfHolladay1?: number;       // SF (Holladay 1)
  acd?: number;               // Anterior chamber depth (mm)
  lensThickness?: number;     // Crystalline lens thickness (mm)
  wtw?: number;               // White-to-white (mm)
  keratometricIndex?: number; // Device keratometric index (default 1.3375)
  // Modern formula A-constants (ESCRS: Barrett, Cooke K6, EVO, Hill-RBF, Hoffer QST, Kane, Pearl DGS)
  barrettAConst?: number;     // Barrett Universal II / True-K A-constant
  cookeAConst?: number;       // Cooke K6 A-constant
  evoAConst?: number;         // EVO formula A-constant
  hillRBFAConst?: number;     // Hill-RBF A-constant
  hofferPACD?: number;        // Hoffer QST pACD (predicted ACD)
  kaneAConst?: number;        // Kane formula A-constant
  pearlDGSAConst?: number;    // Pearl DGS A-constant
  // Eye flags
  isArgosAL?: boolean;        // Axial length measured by Zeiss Argos (Sum-of-Segments)
  isKeratoconus?: boolean;    // Keratoconus eye (some formulas have specific modes)
}

export interface PostRefResult {
  method: string;
  methodName: string;
  requiresHistory: boolean;
  adjustedKFlat: number;
  adjustedKSteep: number;
  adjustedMeanK: number;
  iolPowerAdjustment?: number; // D added to standard formula IOL power
  /** K to use for ELP in Double-K methods (Aramberri). undefined = same as adjustedMeanK */
  elpK?: number;
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

/**
 * Compute Atlas ring mean from individual values.
 * LASIK/PRK: uses rings 0–3mm. RK: uses rings 1–4mm. Returns mean of whatever is provided.
 * atlasRingMean0_3 overrides when set.
 */
function resolveAtlasRingMean(input: PostRefHistoryInput): number | undefined {
  if (input.atlasRingMean0_3 != null) return input.atlasRingMean0_3;
  const vals = [
    input.atlasRing0mm, input.atlasRing1mm, input.atlasRing2mm,
    input.atlasRing3mm, input.atlasRing4mm,
  ].filter((v): v is number => v != null);
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ══════════════════════════════════════════════════════════════════════════
// 9. ADJUSTED ATLAS 0-3mm  (topography + history required)
//    K_adj = Atlas_0-3_mean − (0.2 × ΔMR)
//    Ref: Wang et al. / ASCRS Post-Refractive Calculator
// ══════════════════════════════════════════════════════════════════════════
export function adjustedAtlas(
  input: PostRefHistoryInput,
): PostRefResult | null {
  const ringMean = resolveAtlasRingMean(input);
  if (ringMean == null) return null;

  const dMR = input.lasikRx ?? (input.preOpSEQ - input.postOpSEQ);
  const kAdj = ringMean - (0.2 * dMR);
  const ratio = kAdj / ringMean;
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
    formula: `K_adj = ${round2(ringMean)} − (0.2 × ${round2(dMR)}) = ${round2(kAdj)} D`,
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
// 11. MALONEY CENTRAL TOPOGRAPHY METHOD  (no history)
//     K_adj = 1.1141 × TKPO-CTR − 5.5
//     Ref: Maloney RK. / Hoffer KJ, IOL Power 2011, Ch.32.
//     Note: WKM revised the constant from −5.5 to −6.1 (Koch & Wang 2003).
// ══════════════════════════════════════════════════════════════════════════
export function maloneyMethod(
  input: PostRefNoHistoryInput,
  topoCentral?: number,
): PostRefResult {
  const meanK    = (input.kFlat + input.kSteep) / 2;
  const sourceK  = topoCentral ?? meanK;
  const isTopoK  = topoCentral != null;

  const kAdj  = sourceK * 1.1141 - 5.5;
  const ratio = kAdj / sourceK;
  const kFlatAdj  = input.kFlat  * ratio;
  const kSteepAdj = input.kSteep * ratio;

  return {
    method: 'maloney',
    methodName: 'Maloney Central Topography',
    requiresHistory: false,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2(kAdj),
    reference: 'Maloney RK / Hoffer KJ, IOL Power 2011',
    formula: 'K_adj = 1.1141 × TKPO-CTR − 5.5',
    warning: isTopoK ? undefined : 'Topographic central K preferred; SimK used as fallback.',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 12. SAVINI-BARBONI-ZANINI  (no history, topography-based)
//     K_adj = 1.114 × KtPO − 4.98
//     Ref: Savini G, Barboni P, Zanini M. JCRS 2006;32:217-22.
// ══════════════════════════════════════════════════════════════════════════
export function saviniBarboniZanini(
  input: PostRefNoHistoryInput,
  topoCentral?: number,
): PostRefResult {
  const meanK    = (input.kFlat + input.kSteep) / 2;
  const sourceK  = topoCentral ?? meanK;
  const isTopoK  = topoCentral != null;

  const kAdj  = sourceK * 1.114 - 4.98;
  const ratio = kAdj / sourceK;
  const kFlatAdj  = input.kFlat  * ratio;
  const kSteepAdj = input.kSteep * ratio;

  return {
    method: 'savini',
    methodName: 'Savini-Barboni-Zanini',
    requiresHistory: false,
    adjustedKFlat:  round2(kFlatAdj),
    adjustedKSteep: round2(kSteepAdj),
    adjustedMeanK:  round2(kAdj),
    reference: 'Savini G et al. JCRS 2006;32:217-22',
    formula: 'K_adj = 1.114 × KtPO − 4.98',
    warning: isTopoK ? undefined : 'Topographic central SimK preferred; manual K used as fallback.',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 13. DOUBLE-K METHOD (ARAMBERRI) — NO-HISTORY VERSION
//     ELP calculated with assumed normal K = 43.5 D
//     IOL power calculated with post-op K
//     Ref: Aramberri J. JCRS 2003;29:2049-52.
//     Fixes the formula error: SRK/T ELP error = +1.72 D (Hoffer 2011, Ch.32).
//     Note: elpK is stored separately; use srktPowerDoubleK() for IOL calc.
// ══════════════════════════════════════════════════════════════════════════
export function aramberriDoubleKNoHx(input: PostRefNoHistoryInput): PostRefResult {
  return {
    method: 'double-k-nohx',
    methodName: 'Double-K No History (Aramberri)',
    requiresHistory: false,
    adjustedKFlat:  round2(input.kFlat),
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    elpK: 43.5,  // assumed average pre-refractive K
    reference: 'Aramberri J, JCRS 2003;29:2049-52',
    formula: 'ELP from K=43.5 D (assumed normal); IOL power from post-op K',
    warning: 'Assumes pre-refractive K=43.5 D. More accurate if actual pre-op K is known.',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 14. DOUBLE-K METHOD (ARAMBERRI) — WITH HISTORY
//     ELP calculated with actual pre-op K
//     IOL power calculated with post-op K
//     Ref: Aramberri J. JCRS 2003;29:2049-52.
// ══════════════════════════════════════════════════════════════════════════
export function aramberriDoubleKHx(input: PostRefHistoryInput): PostRefResult {
  const preOpMeanK = round2((input.preOpKFlat + input.preOpKSteep) / 2);
  return {
    method: 'double-k-hx',
    methodName: 'Double-K With History (Aramberri)',
    requiresHistory: true,
    adjustedKFlat:  round2(input.kFlat),
    adjustedKSteep: round2(input.kSteep),
    adjustedMeanK:  round2((input.kFlat + input.kSteep) / 2),
    elpK: preOpMeanK,   // actual pre-op K used for ELP
    reference: 'Aramberri J, JCRS 2003;29:2049-52',
    formula: `ELP from pre-op K=${preOpMeanK} D; IOL power from post-op K`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// SRK/T IOL POWER FORMULA
// Retzlaff JA, Sanders DR, Kraff MC. JCRS 1990;16:333-40.
// ══════════════════════════════════════════════════════════════════════════

/** Round to nearest 0.25 D (standard IOL step) */
export function roundQtr(d: number): number {
  return Math.round(d * 4) / 4;
}

/**
 * SRK/T: IOL power for emmetropia (or targetRx at spectacle plane).
 * @param meanK  Mean keratometry (D)
 * @param AL     Axial length (mm)
 * @param AConst A-constant (e.g. 118.0 for AcrySof SA60AT)
 * @param targetRx  Target spectacle refraction (D, default 0 = emmetropia)
 */
export function srktPower(
  meanK: number,
  AL: number,
  AConst: number,
  targetRx = 0,
): number {
  // AL correction for long eyes
  const Lcor = AL <= 24.2
    ? AL
    : -3.446 + 1.716 * AL - 0.0237 * AL * AL;

  // Optical axial length
  const Lopt = 0.97971 * Lcor + 0.65696;

  // Corneal radius (mm)
  const R = 337.5 / meanK;

  // Corneal height (sagitta of 7mm chord)
  const H = R - Math.sqrt(R * R - 12.25);

  // Estimated lens position (ELP): Retzlaff 1990, JCRS 16:333
  const Csf = 0.62467 * AConst - 68.747;
  const ELP = H + Csf;

  const n = 1.336;

  // Vergence formula (Retzlaff 1990)
  const IOL_emme = (1000 * n * (n * R - (n - 1) * Lopt))
                 / ((Lopt - ELP) * (n * R - (n - 1) * ELP));

  if (targetRx === 0) return IOL_emme;

  // Adjust for target refraction (vertex 12 mm correction)
  const rxCornea = targetRx / (1 - 0.012 * targetRx);
  return IOL_emme + rxCornea;
}

/**
 * SRK/T Double-K: IOL power with separate K values for ELP and optics.
 * Implements the Aramberri (2003) correction for post-refractive eyes.
 * @param meanKPost  Post-op K used for IOL power vergence (D)
 * @param elpK       Pre-op (or assumed normal) K used for ELP calculation (D)
 */
export function srktPowerDoubleK(
  meanKPost: number,
  elpK: number,
  AL: number,
  AConst: number,
  targetRx = 0,
): number {
  const Lcor = AL <= 24.2
    ? AL
    : -3.446 + 1.716 * AL - 0.0237 * AL * AL;
  const Lopt = 0.97971 * Lcor + 0.65696;

  // ELP from elpK (pre-op or assumed normal K)
  const R_elp = 337.5 / elpK;
  const H_elp = R_elp - Math.sqrt(R_elp * R_elp - 12.25);
  const Csf   = 0.62467 * AConst - 68.747;
  const ELP   = H_elp + Csf;

  // IOL power vergence from post-op K
  const R_post = 337.5 / meanKPost;
  const n = 1.336;
  const IOL_emme = (1000 * n * (n * R_post - (n - 1) * Lopt))
                 / ((Lopt - ELP) * (n * R_post - (n - 1) * ELP));

  if (targetRx === 0) return IOL_emme;
  const rxCornea = targetRx / (1 - 0.012 * targetRx);
  return IOL_emme + rxCornea;
}

// ══════════════════════════════════════════════════════════════════════════
// CONSENSUS: average K of all no-history methods (ASCRS/ESCRS approach)
// Double-K methods are excluded — they don't adjust K, they adjust the ELP.
// ══════════════════════════════════════════════════════════════════════════
export function noHistoryConsensus(results: PostRefResult[]): {
  meanKFlat: number; meanKSteep: number; meanK: number;
} {
  // Exclude Double-K methods: they keep post-op K unchanged (ELP adjustment only)
  const noHx = results.filter(r => !r.requiresHistory && r.adjustedMeanK > 0 && r.elpK == null);
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

  // Best available topographic central K by priority:
  // Myopic LASIK: Pentacam TNP (total power) > Galilei TCP2 > Tomey ACCP > Atlas central
  // RK: Pentacam PWR_SF_Pupil > Average Central Power > Atlas central
  const topoCentral = noHxInput.pentacamTNP ??
                      noHxInput.pentacamPWRSF4mm ??
                      noHxInput.galileiTCP2 ??
                      noHxInput.tomeyACCP ??
                      noHxInput.atlasCentralPower ??
                      noHxInput.avgCentralPower ??
                      hxInput?.atlasCentralPower;

  // No-history K-correction methods
  results.push(shammasNoHistory(noHxInput));
  if (noHxInput.procedure !== 'RK') {
    results.push(haigisL(noHxInput));
  }
  results.push(wangKochMaloney(noHxInput, topoCentral));
  results.push(maloneyMethod(noHxInput, topoCentral));
  results.push(saviniBarboniZanini(noHxInput, topoCentral));

  // No-history Double-K (ELP correction)
  results.push(aramberriDoubleKNoHx(noHxInput));

  // History-based methods
  if (hxInput) {
    results.push(clinicalHistoryMethod(hxInput));
    results.push(masketFormula(hxInput));
    results.push(modifiedMasket(hxInput));
    results.push(feizMannis(hxInput));
    results.push(latkanyFlatK(hxInput));
    results.push(aramberriDoubleKHx(hxInput));  // Double-K with actual pre-op K

    const atlas = adjustedAtlas(hxInput);
    if (atlas) results.push(atlas);

    const effrp = adjustedEffRP(hxInput);
    if (effrp) results.push(effrp);
  }

  return results;
}
