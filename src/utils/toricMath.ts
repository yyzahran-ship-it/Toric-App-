const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// Toric IOL cylinder powers for common platforms (corneal plane equivalent)
export const IOL_PLATFORMS: Record<string, { name: string; cylinders: number[] }> = {
  acrysof: {
    name: 'Alcon AcrySof / Clareon Toric',
    cylinders: [1.03, 1.55, 2.06, 2.57, 3.08, 3.60, 4.11],
    // T2-T9 corneal plane equivalents (D)
  },
  tecnis: {
    name: 'J&J TECNIS Toric',
    cylinders: [1.03, 1.55, 2.06, 2.57, 3.08, 4.11],
  },
  at_torbi: {
    name: 'ZEISS AT TORBI',
    cylinders: [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
  },
  envista: {
    name: 'Bausch + Lomb enVista Toric',
    cylinders: [1.25, 2.0, 2.75, 3.5],
  },
  tflex: {
    name: 'Rayner T-flex Toric',
    cylinders: [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0],
  },
  generic: {
    name: 'Generic (0.5 D steps)',
    cylinders: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0],
  },
};

export interface ToricInput {
  k1Power: number;  // flat K (D)
  k1Axis: number;   // flat meridian axis 0-180°
  k2Power: number;  // steep K (D)
  sia: number;      // SIA magnitude (D)
  siaAxis: number;  // incision axis 0-180°
  platform: string; // key from IOL_PLATFORMS
}

export interface IOLOption {
  cylinder: number;   // corneal plane (D)
  residual: number;   // predicted residual astigmatism (D)
  isBest: boolean;
}

export interface ToricResult {
  effectiveMag: number;   // net corneal astigmatism (D)
  effectiveAxis: number;  // recommended IOL placement axis 0-180°
  iolOptions: IOLOption[];
  bestCylinder: number;
  bestResidual: number;
}

export function calcToric(input: ToricInput): ToricResult {
  const { k1Power, k1Axis, k2Power, sia, siaAxis, platform } = input;

  // Corneal astigmatism vector (steep axis = k1Axis + 90)
  const cornealMag = Math.abs(k2Power - k1Power);
  const steepAxis = (k1Axis + 90) % 180;
  const Cx = cornealMag * Math.cos(2 * toRad(steepAxis));
  const Cy = cornealMag * Math.sin(2 * toRad(steepAxis));

  // SIA vector: incision flattens at siaAxis, effectively adding astigmatism
  // with steep meridian = siaAxis (ATR for temporal incision at 0°)
  const Sx = sia * Math.cos(2 * toRad(siaAxis));
  const Sy = sia * Math.sin(2 * toRad(siaAxis));

  // Net effective corneal (what the toric IOL needs to correct)
  const Ex = Cx + Sx;
  const Ey = Cy + Sy;
  const effectiveMag = Math.sqrt(Ex * Ex + Ey * Ey);

  let effectiveAxis = toDeg(Math.atan2(Ey, Ex)) / 2;
  if (effectiveAxis < 0) effectiveAxis += 180;
  effectiveAxis = Math.round(effectiveAxis) % 180;

  const cylinders = IOL_PLATFORMS[platform]?.cylinders ?? IOL_PLATFORMS.generic.cylinders;

  const iolOptions: IOLOption[] = cylinders.map(cylinder => {
    const residual = calcResidualAtAxis(effectiveMag, effectiveAxis, cylinder, effectiveAxis);
    return { cylinder, residual, isBest: false };
  });

  // Best = closest to effectiveMag without over-correcting (minimise residual)
  let bestIdx = 0;
  let minResidual = Infinity;
  iolOptions.forEach((opt, i) => {
    if (opt.residual < minResidual) { minResidual = opt.residual; bestIdx = i; }
  });
  iolOptions[bestIdx].isBest = true;

  return {
    effectiveMag: Math.round(effectiveMag * 100) / 100,
    effectiveAxis,
    iolOptions,
    bestCylinder: iolOptions[bestIdx].cylinder,
    bestResidual: Math.round(minResidual * 100) / 100,
  };
}

export function calcResidualAtAxis(
  effectiveMag: number,
  effectiveAxis: number,
  iolCylinder: number,
  iolPlacedAxis: number,
): number {
  const Ex = effectiveMag * Math.cos(2 * toRad(effectiveAxis));
  const Ey = effectiveMag * Math.sin(2 * toRad(effectiveAxis));
  const Ix = iolCylinder * Math.cos(2 * toRad(iolPlacedAxis));
  const Iy = iolCylinder * Math.sin(2 * toRad(iolPlacedAxis));
  const Rx = Ex - Ix;
  const Ry = Ey - Iy;
  return Math.round(Math.sqrt(Rx * Rx + Ry * Ry) * 100) / 100;
}

// Barrett-style posterior corneal astigmatism correction.
// Posterior cornea contributes ~0.3 D ATR (steep horizontal, double-angle = (0.3, 0)).
// WTR anterior → total is less than anterior K; ATR anterior → total is more.
export function applyPCA(
  k1Power: number,
  k1Axis: number,
  k2Power: number,
): { adjustedMag: number; adjustedAxis: number } {
  const cornealMag = Math.abs(k2Power - k1Power);
  const steepAxis = (k1Axis + 90) % 180;
  const Ax = cornealMag * Math.cos(2 * toRad(steepAxis));
  const Ay = cornealMag * Math.sin(2 * toRad(steepAxis));
  // ATR posterior component: steep at 0° → double-angle = (0.3, 0)
  const PCA = 0.3;
  const Tx = Ax + PCA;
  const Ty = Ay;
  const adjustedMag = Math.sqrt(Tx * Tx + Ty * Ty);
  let adjustedAxis = toDeg(Math.atan2(Ty, Tx)) / 2;
  if (adjustedAxis < 0) adjustedAxis += 180;
  return { adjustedMag: Math.round(adjustedMag * 100) / 100, adjustedAxis: Math.round(adjustedAxis) % 180 };
}

export interface AlpinsVectors {
  tia: { mag: number; axis: number };
  sia: { mag: number; axis: number };
  dv: { mag: number; axis: number };
  ci: number;    // correction index (SIA/TIA), ideal = 1.0
  me: number;    // magnitude of error = |SIA| - |TIA|, ideal = 0
  ae: number;    // angle of error (degrees), ideal = 0
  is: number;    // index of success = |DV|/|TIA|, ideal = 0
}

// Alpins vector analysis. Both tia and sia specified as {mag (D), axis (°)}.
export function calcAlpins(
  tia: { mag: number; axis: number },
  sia: { mag: number; axis: number },
): AlpinsVectors {
  const TIAx = tia.mag * Math.cos(2 * toRad(tia.axis));
  const TIAy = tia.mag * Math.sin(2 * toRad(tia.axis));
  const SIAx = sia.mag * Math.cos(2 * toRad(sia.axis));
  const SIAy = sia.mag * Math.sin(2 * toRad(sia.axis));
  const DVx = TIAx - SIAx;
  const DVy = TIAy - SIAy;
  const dvMag = Math.sqrt(DVx * DVx + DVy * DVy);
  let dvAxis = toDeg(Math.atan2(DVy, DVx)) / 2;
  if (dvAxis < 0) dvAxis += 180;
  const ci = tia.mag > 0 ? sia.mag / tia.mag : 0;
  const me = sia.mag - tia.mag;
  // Angle of error in double-angle space / 2
  const tiaAngle = toDeg(Math.atan2(TIAy, TIAx));
  const siaAngle = toDeg(Math.atan2(SIAy, SIAx));
  let ae = (siaAngle - tiaAngle) / 2;
  while (ae > 90) ae -= 180;
  while (ae < -90) ae += 180;
  return {
    tia,
    sia,
    dv: { mag: Math.round(dvMag * 100) / 100, axis: Math.round(dvAxis) % 180 },
    ci: Math.round(ci * 100) / 100,
    me: Math.round(me * 100) / 100,
    ae: Math.round(ae * 10) / 10,
    is: tia.mag > 0 ? Math.round((dvMag / tia.mag) * 100) / 100 : 0,
  };
}

// How residual changes every 5° of rotation from placed axis (for the rotation-effect chart)
export function rotationEffect(
  effectiveMag: number,
  effectiveAxis: number,
  iolCylinder: number,
  placedAxis: number,
): Array<{ deg: number; residual: number }> {
  const result: Array<{ deg: number; residual: number }> = [];
  for (let delta = -90; delta <= 90; delta += 5) {
    const axis = ((placedAxis + delta) % 180 + 180) % 180;
    result.push({ deg: delta, residual: calcResidualAtAxis(effectiveMag, effectiveAxis, iolCylinder, axis) });
  }
  return result;
}
