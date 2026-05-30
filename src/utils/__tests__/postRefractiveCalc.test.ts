/**
 * Post-Refractive IOL Calculator — Model Validation Test Suite
 *
 * Expected values are derived from the published formulas and cross-checked
 * against the same intermediate computations used by the ASCRS and ESCRS
 * post-refractive IOL calculators.
 *
 * Reference validation cases (marked PDF-VAL) come from the Kotlin/Python
 * reference implementation provided in the project PDFs.
 *
 * All K values in diopters (D), axial length in mm.
 */

import {
  shammasNoHistory,
  haigisL,
  wangKochMaloney,
  maloneyMethod,
  saviniBarboniZanini,
  aramberriDoubleKNoHx,
  aramberriDoubleKHx,
  clinicalHistoryMethod,
  masketFormula,
  modifiedMasket,
  feizMannis,
  latkanyFlatK,
  adjustedAtlas,
  adjustedEffRP,
  noHistoryConsensus,
  runAllMethods,
  srktPower,
  srktPowerDoubleK,
  roundQtr,
} from '../postRefractiveCalc';

// ─── helpers ─────────────────────────────────────────────────────────────────
const near = (a: number, b: number, tol = 0.02) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

// ─── TEST CASES ──────────────────────────────────────────────────────────────

// Post-LASIK moderate myopia (the standard reference case throughout)
const BASE_NO_HX = {
  kFlat: 38.5,
  kSteep: 39.5,
  procedure: 'LASIK' as const,
};
const BASE_HX = {
  ...BASE_NO_HX,
  preOpKFlat: 44.0,
  preOpKSteep: 45.0,
  preOpSEQ: -4.50,
  postOpSEQ: -0.25,
  lasikRx: -4.25,
};

// ─────────────────────────────────────────────────────────────────────────────
describe('Shammas-PL No-History  (K_adj = 1.14 × K − 6.8)', () => {
  test('standard post-LASIK case', () => {
    const r = shammasNoHistory(BASE_NO_HX);
    expect(r.adjustedKFlat).toBe(37.09);   // 1.14×38.5 − 6.8
    expect(r.adjustedKSteep).toBe(38.23);  // 1.14×39.5 − 6.8
    expect(r.adjustedMeanK).toBe(37.66);
    expect(r.requiresHistory).toBe(false);
  });

  test('normal-range K (no surgery expected)', () => {
    const r = shammasNoHistory({ kFlat: 43.0, kSteep: 44.0, procedure: 'LASIK' });
    expect(r.adjustedKFlat).toBe(42.22);   // 1.14×43.0 − 6.8
    expect(r.adjustedKSteep).toBe(43.36);  // 1.14×44.0 − 6.8
    expect(r.adjustedMeanK).toBe(42.79);
  });

  // PDF-VAL: shammas_pl(38.5) ≈ 37.09 (Python validation script)
  test('PDF reference: single K', () => {
    const single = { kFlat: 38.5, kSteep: 38.5, procedure: 'LASIK' as const };
    expect(shammasNoHistory(single).adjustedKFlat).toBe(37.09);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Haigis-L  (r_corr = 331.5/(−5.1625×r + 82.2603 − 0.35))', () => {
  test('standard post-LASIK case', () => {
    const r = haigisL(BASE_NO_HX);
    expect(r.adjustedKFlat).toBe(37.32);
    expect(r.adjustedKSteep).toBe(38.48);
    expect(r.adjustedMeanK).toBe(37.90);
    expect(r.requiresHistory).toBe(false);
  });

  // PDF-VAL: r_meas=8.73mm → K_adj≈37.51 D  (Haigis W, JCRS 2008)
  test('PDF reference: r_meas=8.73mm → K_adj≈37.51 D', () => {
    const kMeas = 337.5 / 8.73;                 // ≈38.66 D
    const single = { kFlat: kMeas, kSteep: kMeas, procedure: 'LASIK' as const };
    near(haigisL(single).adjustedKFlat, 37.51, 0.05);
  });

  test('RK procedure excluded from runAllMethods', () => {
    const res = runAllMethods({ kFlat: 38.5, kSteep: 39.5, procedure: 'RK' });
    expect(res.find(r => r.method === 'haigis-l')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Wang-Koch-Maloney  (K_adj = K_atlas × 1.114 − 6.1)', () => {
  // PDF-VAL: atlas=40.91 → 39.47 (Python validation script)
  test('PDF reference: atlas=40.91 → 39.47 D', () => {
    const r = wangKochMaloney(BASE_NO_HX, 40.91);
    expect(r.adjustedMeanK).toBe(39.47);
  });

  test('uses SimK fallback when no atlas provided', () => {
    const r = wangKochMaloney(BASE_NO_HX);          // SimK mean = 39.0
    near(r.adjustedMeanK, 37.35, 0.03);             // 39.0 × 1.114 − 6.1
    expect(r.warning).toMatch(/SimK used/);
  });

  test('no warning when atlas K provided', () => {
    const r = wangKochMaloney(BASE_NO_HX, 40.91);
    expect(r.warning).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Clinical History Method  (K_adj = K_pre − ΔRx_corneal)', () => {
  test('standard case with vertex correction', () => {
    const r = clinicalHistoryMethod(BASE_HX);
    // ΔRx_corneal ≈ 4.02 D (vertex-corrected difference)
    near(r.adjustedKFlat,  39.98, 0.03);
    near(r.adjustedKSteep, 40.98, 0.03);
    near(r.adjustedMeanK,  40.48, 0.03);
    expect(r.requiresHistory).toBe(true);
  });

  test('uses preOpKFlat/Steep not current K', () => {
    const r = clinicalHistoryMethod(BASE_HX);
    // Adjusted K must be between current K and pre-op K
    expect(r.adjustedKFlat).toBeGreaterThan(BASE_NO_HX.kFlat);
    expect(r.adjustedKFlat).toBeLessThan(BASE_HX.preOpKFlat);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Masket Formula  (IOL_adj = (−0.326 × ΔRx) + 0.101)', () => {
  test('dRx=−4.25 D', () => {
    const r = masketFormula(BASE_HX);
    expect(r.iolPowerAdjustment).toBe(1.49);   // (−0.326×−4.25)+0.101
    expect(r.adjustedMeanK).toBe(39.0);        // current SimK unchanged
  });

  test('larger correction gives larger adjustment', () => {
    const hx2 = { ...BASE_HX, lasikRx: -6.0 };
    const r = masketFormula(hx2);
    expect(r.iolPowerAdjustment).toBe(2.06);   // (−0.326×−6.0)+0.101
  });

  test('positive adjustment for myopic correction', () => {
    const r = masketFormula(BASE_HX);
    expect(r.iolPowerAdjustment).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Modified Masket (Hill)  (IOL_adj = (ΔMR × −0.4385) + 0.0295)', () => {
  test('dRx=−4.25 D', () => {
    const r = modifiedMasket(BASE_HX);
    expect(r.iolPowerAdjustment).toBe(1.89);   // (−4.25×−0.4385)+0.0295
  });

  test('larger correction than Masket for same dRx', () => {
    const m  = masketFormula(BASE_HX);
    const mm = modifiedMasket(BASE_HX);
    // Hill coefficients produce slightly higher adjustment
    expect(mm.iolPowerAdjustment!).toBeGreaterThan(m.iolPowerAdjustment!);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feiz-Mannis  (IOL_adj = −ΔSE/0.7, uses pre-op K)', () => {
  test('returns pre-op K values as the "adjusted" K', () => {
    const r = feizMannis(BASE_HX);
    expect(r.adjustedKFlat).toBe(44.0);
    expect(r.adjustedKSteep).toBe(45.0);
  });

  test('IOL adjustment for dSE=−4.25', () => {
    const r = feizMannis(BASE_HX);
    near(r.iolPowerAdjustment!, 6.07, 0.02);   // 4.25/0.7
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Latkany Flat-K  (IOL_adj = (−0.47 × ΔMR) + 0.85)', () => {
  test('dMR=−4.25 D', () => {
    const r = latkanyFlatK(BASE_HX);
    expect(r.iolPowerAdjustment).toBe(2.85);   // (−0.47×−4.25)+0.85
  });

  test('uses flat K for mean (flat-K method)', () => {
    const r = latkanyFlatK(BASE_HX);
    expect(r.adjustedMeanK).toBe(BASE_NO_HX.kFlat);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Adjusted Atlas 0-3mm  (K_adj = atlasRing − 0.2 × ΔMR)', () => {
  test('returns null when atlas ring mean not provided', () => {
    expect(adjustedAtlas(BASE_HX)).toBeNull();
  });

  test('adjusts atlas K by 20% of refractive change', () => {
    const hx = { ...BASE_HX, atlasRingMean0_3: 40.50 };
    const r = adjustedAtlas(hx)!;
    near(r.adjustedMeanK, 40.50 - 0.2 * (-4.25), 0.02);  // 40.50 + 0.85 = 41.35
    expect(r.requiresHistory).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Adjusted EffRP  (K_adj = EffRP − 0.15 × ΔMR − 0.05)', () => {
  test('returns null when EffRP not provided', () => {
    expect(adjustedEffRP(BASE_HX)).toBeNull();
  });

  test('adjusts EffRP correctly', () => {
    const hx = { ...BASE_HX, effRP: 41.20 };
    const r = adjustedEffRP(hx)!;
    // 41.20 − (0.15×−4.25) − 0.05 = 41.20 + 0.6375 − 0.05 = 41.79
    near(r.adjustedMeanK, 41.79, 0.02);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Maloney Central Topography  (K_adj = 1.1141 × TKPO-CTR − 5.5)', () => {
  test('uses topographic central K', () => {
    const r = maloneyMethod(BASE_NO_HX, 40.91);
    near(r.adjustedMeanK, 40.09, 0.03);   // 1.1141 × 40.91 − 5.5
    expect(r.warning).toBeUndefined();
  });

  test('falls back to SimK with warning', () => {
    const r = maloneyMethod(BASE_NO_HX);   // SimK mean = 39.0
    near(r.adjustedMeanK, 37.95, 0.03);   // 1.1141 × 39.0 − 5.5
    expect(r.warning).toMatch(/SimK/);
  });

  test('no history required', () => {
    expect(maloneyMethod(BASE_NO_HX).requiresHistory).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Savini-Barboni-Zanini  (K_adj = 1.114 × KtPO − 4.98)', () => {
  test('uses topographic central K', () => {
    const r = saviniBarboniZanini(BASE_NO_HX, 40.91);
    near(r.adjustedMeanK, 40.59, 0.03);   // 1.114 × 40.91 − 4.98
    expect(r.warning).toBeUndefined();
  });

  test('falls back to SimK with warning', () => {
    const r = saviniBarboniZanini(BASE_NO_HX);   // SimK mean = 39.0
    near(r.adjustedMeanK, 38.47, 0.03);          // 1.114 × 39.0 − 4.98
    expect(r.warning).toMatch(/SimK/);
  });

  test('no history required', () => {
    expect(saviniBarboniZanini(BASE_NO_HX).requiresHistory).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Double-K No History (Aramberri)  (elpK = 43.5 D assumed)', () => {
  test('keeps post-op K unchanged, sets elpK = 43.5', () => {
    const r = aramberriDoubleKNoHx(BASE_NO_HX);
    expect(r.adjustedMeanK).toBe(39.0);
    expect(r.elpK).toBe(43.5);
    expect(r.requiresHistory).toBe(false);
  });

  test('srktPowerDoubleK > srktPower with same post-op K (corrects +1.72 D formula error)', () => {
    const r = aramberriDoubleKNoHx(BASE_NO_HX);
    const standard = srktPower(r.adjustedMeanK, 24.0, 118.0);
    const doubleK  = srktPowerDoubleK(r.adjustedMeanK, r.elpK!, 24.0, 118.0);
    expect(doubleK).toBeGreaterThan(standard);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Double-K With History (Aramberri)  (elpK = actual pre-op K)', () => {
  test('keeps post-op K unchanged, uses actual pre-op mean K for ELP', () => {
    const r = aramberriDoubleKHx(BASE_HX);
    expect(r.adjustedMeanK).toBe(39.0);   // post-op K unchanged
    expect(r.elpK).toBe(44.5);            // (preOpKFlat=44 + preOpKSteep=45) / 2
    expect(r.requiresHistory).toBe(true);
  });

  test('history version has higher elpK than no-history assumed 43.5', () => {
    const noHx   = aramberriDoubleKNoHx(BASE_NO_HX);
    const withHx = aramberriDoubleKHx(BASE_HX);
    expect(withHx.elpK!).toBeGreaterThan(noHx.elpK!);   // 44.5 > 43.5
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('SRK/T IOL Power  (Retzlaff 1990)  ELP = H + 0.62467A − 68.747', () => {
  // Clinically expected: normal eye ~20-22 D
  test('normal eye baseline (K=43.5, AL=23.5, A=118.0)', () => {
    const iol = srktPower(43.5, 23.5, 118.0);
    near(iol, 21.38, 0.05);
    expect(roundQtr(iol)).toBe(21.5);
  });

  // Post-LASIK moderate myopia with Shammas-adjusted K
  test('post-LASIK (Shammas K=37.66, AL=24.0, A=118.4)', () => {
    const iol = srktPower(37.66, 24.0, 118.4);
    near(iol, 28.26, 0.10);
    expect(roundQtr(iol)).toBe(28.25);
  });

  // Post-LASIK with Haigis-L adjusted K
  test('post-LASIK (Haigis K=37.90, AL=24.0, A=118.0)', () => {
    const iol = srktPower(37.90, 24.0, 118.0);
    near(iol, 27.31, 0.10);
    expect(roundQtr(iol)).toBe(27.25);
  });

  test('long eye AL correction (>24.2mm triggers Lcor formula)', () => {
    const iol = srktPower(43.5, 26.0, 118.0);
    expect(iol).toBeLessThan(srktPower(43.5, 23.5, 118.0));  // longer eye → less IOL
  });

  test('A-constant effect: higher A → higher IOL power', () => {
    const iol118 = srktPower(43.5, 23.5, 118.0);
    const iol119 = srktPower(43.5, 23.5, 119.0);
    expect(iol119).toBeGreaterThan(iol118);
  });

  test('roundQtr snaps to nearest 0.25 D', () => {
    expect(roundQtr(21.0)).toBe(21.0);
    expect(roundQtr(21.1)).toBe(21.0);
    expect(roundQtr(21.13)).toBe(21.25);
    expect(roundQtr(21.375)).toBe(21.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('noHistoryConsensus', () => {
  test('averages all 5 no-history K-adjustment methods (excludes Double-K)', () => {
    const res = runAllMethods(BASE_NO_HX);
    const c = noHistoryConsensus(res);
    const sh  = shammasNoHistory(BASE_NO_HX);
    const hl  = haigisL(BASE_NO_HX);
    const wk  = wangKochMaloney(BASE_NO_HX);
    const mal = maloneyMethod(BASE_NO_HX);
    const sav = saviniBarboniZanini(BASE_NO_HX);
    const expectedMeanK = (sh.adjustedMeanK + hl.adjustedMeanK + wk.adjustedMeanK +
                           mal.adjustedMeanK + sav.adjustedMeanK) / 5;
    near(c.meanK, expectedMeanK, 0.05);
  });

  test('excludes history-based and Double-K methods', () => {
    const res = runAllMethods(BASE_NO_HX, BASE_HX);
    const c = noHistoryConsensus(res);
    const noHxKAdj = res.filter(r => !r.requiresHistory && r.elpK == null);
    const expectedMean = noHxKAdj.reduce((s, r) => s + r.adjustedMeanK, 0) / noHxKAdj.length;
    near(c.meanK, expectedMean, 0.02);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runAllMethods integration', () => {
  test('no-history: returns 6 methods (shammas, haigis-l, wkm, maloney, savini, double-k-nohx)', () => {
    const res = runAllMethods(BASE_NO_HX);
    expect(res.map(r => r.method)).toEqual([
      'shammas', 'haigis-l', 'wkm', 'maloney', 'savini', 'double-k-nohx',
    ]);
  });

  test('with history: returns 12 methods (no topo inputs)', () => {
    const res = runAllMethods(BASE_NO_HX, BASE_HX);
    expect(res).toHaveLength(12);
  });

  test('with topo inputs: returns 14 methods', () => {
    const hxTopo = {
      ...BASE_HX,
      atlasRingMean0_3: 40.50,
      effRP: 41.20,
      atlasCentralPower: 40.91,
    };
    const res = runAllMethods(BASE_NO_HX, hxTopo);
    expect(res).toHaveLength(14);
  });

  test('no-history consensus meanK < original mean K (post-LASIK adjustment)', () => {
    const res = runAllMethods(BASE_NO_HX);
    const c = noHistoryConsensus(res);
    const originalMean = (BASE_NO_HX.kFlat + BASE_NO_HX.kSteep) / 2;
    expect(c.meanK).toBeLessThan(originalMean);  // all methods reduce K
  });

  // ASCRS/ESCRS consistency check: K-adjustment methods should cluster within ±1.5D
  test('ASCRS/ESCRS consistency: no-history K-adjustment spread ≤ 1.5 D', () => {
    const res = runAllMethods(BASE_NO_HX);
    // Exclude Double-K methods — they keep post-op K unchanged (not K-adjustment)
    const meanKs = res.filter(r => !r.requiresHistory && r.elpK == null).map(r => r.adjustedMeanK);
    const spread = Math.max(...meanKs) - Math.min(...meanKs);
    expect(spread).toBeLessThanOrEqual(1.5);
  });

  // Masket IOL adjustment sign: must be positive for myopic LASIK (adds IOL power)
  test('Masket adjustment is positive for myopic correction', () => {
    const res = runAllMethods(BASE_NO_HX, BASE_HX);
    const masket = res.find(r => r.method === 'masket')!;
    expect(masket.iolPowerAdjustment).toBeGreaterThan(0);
  });

  // History-based methods must produce higher or equal adjusted K than no-history
  // (Clinical history restores to pre-op K level; no-history reduces further)
  test('clinical history K > Shammas K (history restores toward pre-op K)', () => {
    const res = runAllMethods(BASE_NO_HX, BASE_HX);
    const shammas = res.find(r => r.method === 'shammas')!;
    const clinHx  = res.find(r => r.method === 'clinical-history')!;
    expect(clinHx.adjustedMeanK).toBeGreaterThan(shammas.adjustedMeanK);
  });
});
