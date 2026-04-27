const XR_FACTORS: Record<number, { A2: number; D3: number; D4: number; d2: number }> = {
  2: { A2: 1.88, D3: 0, D4: 3.267, d2: 1.128 },
  3: { A2: 1.023, D3: 0, D4: 2.574, d2: 1.693 },
  4: { A2: 0.729, D3: 0, D4: 2.282, d2: 2.059 },
  5: { A2: 0.577, D3: 0, D4: 2.114, d2: 2.326 },
  6: { A2: 0.483, D3: 0, D4: 2.004, d2: 2.534 },
  7: { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
  8: { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 },
  9: { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.97 },
  10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 },
};

export type SubgroupData = {
  id: number;
  values: number[];
};

export type DistributionSuggestion = {
  name: string;
  pValue: number;
  aSquared: number;
};

export type CapabilityResult = {
  mean: number;
  sigmaWithin: number;
  sigmaOverall: number;
  cp: number;
  cpk: number;
  pp: number;
  ppk: number;
  cpm: number;
  lsl: number;
  usl: number;
  nominal: number;
  isNormal: boolean;
  bestFitDist?: string;
  nonNormalPp?: number;
  nonNormalPpk?: number;
  suggestions: DistributionSuggestion[];
};

export type ControlChartResult = {
  xBar: {
    points: { x: number; y: number; isOutlier: boolean }[];
    cl: number;
    ucl: number;
    lcl: number;
  };
  rChart: {
    points: { x: number; y: number; isOutlier: boolean }[];
    cl: number;
    ucl: number;
    lcl: number;
  };
};

export type AndersonDarlingResult = {
  aSquared: number;
  aSquaredAdj: number;
  pValue: number;
};

const finiteValues = (values: number[]) => values.filter((value) => Number.isFinite(value));

const mean = (values: number[]) => {
  const data = finiteValues(values);
  if (!data.length) return 0;
  return data.reduce((sum, value) => sum + value, 0) / data.length;
};

const sampleStandardDeviation = (values: number[]) => {
  const data = finiteValues(values);
  if (data.length < 2) return 0;
  const avg = mean(data);
  const variance = data.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (data.length - 1);
  return Math.sqrt(Math.max(variance, 0));
};

const clampProbability = (value: number) => Math.min(Math.max(value, 1e-10), 1 - 1e-10);

const erf = (value: number) => {
  const sign = value >= 0 ? 1 : -1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x));
  return sign * y;
};

const normalPdf = (x: number, mu: number, sigma: number) => {
  if (!Number.isFinite(sigma) || sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
};

const normalCdf = (x: number, mu: number, sigma: number) => {
  if (!Number.isFinite(sigma) || sigma <= 0) return x < mu ? 0 : 1;
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
};

// Acklam's inverse-normal approximation.
const normalInv = (pInput: number) => {
  const p = clampProbability(pInput);
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
};

const lognormalPdf = (x: number, mu: number, sigma: number) => {
  if (x <= 0 || sigma <= 0) return 0;
  const z = (Math.log(x) - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (x * sigma * Math.sqrt(2 * Math.PI));
};

const weibullPdf = (x: number, shape: number, scale: number) => {
  if (x < 0 || shape <= 0 || scale <= 0) return 0;
  return (shape / scale) * (x / scale) ** (shape - 1) * Math.exp(-((x / scale) ** shape));
};

const exponentialPdf = (x: number, rate: number) => {
  if (x < 0 || rate <= 0) return 0;
  return rate * Math.exp(-rate * x);
};

const minitabQuantile = (data: number[], p: number) => {
  const sorted = finiteValues(data).sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return 0;
  const i = p * (n + 1);
  if (i <= 1) return sorted[0];
  if (i >= n) return sorted[n - 1];
  const floor = Math.floor(i);
  const fraction = i - floor;
  return sorted[floor - 1] + fraction * (sorted[floor] - sorted[floor - 1]);
};

export function calculateCapability(
  subgroups: SubgroupData[],
  lsl: number,
  usl: number,
  nominal: number,
  selectedDist?: string
): CapabilityResult {
  const cleanedSubgroups = subgroups.map((subgroup) => ({ ...subgroup, values: finiteValues(subgroup.values) }));
  const allData = cleanedSubgroups.flatMap((subgroup) => subgroup.values);
  const n = cleanedSubgroups[0]?.values.length || 0;
  const processMean = mean(allData);
  const sigmaOverall = sampleStandardDeviation(allData);
  const ad = calculateAndersonDarling(allData);
  const isNormal = ad.pValue > 0.05;
  const suggestions = getDistributionSuggestions(allData);
  const bestFit = suggestions[0]?.name || 'Normal';
  const currentDist = selectedDist || bestFit;

  let sigmaWithin = 0;
  if (n === 1) {
    const movingRanges: number[] = [];
    for (let i = 1; i < allData.length; i += 1) {
      movingRanges.push(Math.abs(allData[i] - allData[i - 1]));
    }
    sigmaWithin = mean(movingRanges) / 1.128;
  } else {
    const ranges = cleanedSubgroups.map((subgroup) => Math.max(...subgroup.values) - Math.min(...subgroup.values));
    const rBar = mean(ranges);
    const d2 = XR_FACTORS[n]?.d2 || 1;
    sigmaWithin = rBar / d2;
  }

  const specWidth = usl - lsl;
  const cp = sigmaWithin > 0 ? specWidth / (6 * sigmaWithin) : 0;
  const cpk = sigmaWithin > 0 ? Math.min((usl - processMean) / (3 * sigmaWithin), (processMean - lsl) / (3 * sigmaWithin)) : 0;
  const pp = sigmaOverall > 0 ? specWidth / (6 * sigmaOverall) : 0;
  const ppk = sigmaOverall > 0 ? Math.min((usl - processMean) / (3 * sigmaOverall), (processMean - lsl) / (3 * sigmaOverall)) : 0;
  const cpmDenominator = 6 * Math.sqrt(sigmaOverall ** 2 + (processMean - nominal) ** 2);
  const cpm = cpmDenominator > 0 ? specWidth / cpmDenominator : 0;

  let nonNormalPp: number | undefined;
  let nonNormalPpk: number | undefined;

  if (currentDist !== 'Normal' && allData.length > 5) {
    let p99865 = 0;
    let p00135 = 0;
    let p50 = 0;

    if (currentDist === 'Weibull') {
      const { shape, scale } = weibullMLE(allData);
      const weibullQuantile = (p: number) => scale * (-Math.log(1 - p)) ** (1 / shape);
      p99865 = weibullQuantile(0.99865);
      p00135 = weibullQuantile(0.00135);
      p50 = weibullQuantile(0.5);
    } else if (currentDist === 'Lognormal') {
      const logData = allData.filter((value) => value > 0).map(Math.log);
      const mu = mean(logData);
      const sigma = sampleStandardDeviation(logData);
      const lognormalQuantile = (p: number) => Math.exp(mu + sigma * normalInv(p));
      p99865 = lognormalQuantile(0.99865);
      p00135 = lognormalQuantile(0.00135);
      p50 = lognormalQuantile(0.5);
    } else if (currentDist === 'Exponential') {
      const meanExp = mean(allData);
      const expQuantile = (p: number) => -meanExp * Math.log(1 - p);
      p99865 = expQuantile(0.99865);
      p00135 = expQuantile(0.00135);
      p50 = expQuantile(0.5);
    } else if (currentDist === 'Logistic') {
      const mu = mean(allData);
      const sigma = sampleStandardDeviation(allData);
      const s = (sigma * Math.sqrt(3)) / Math.PI;
      const logisticQuantile = (p: number) => mu + s * Math.log(p / (1 - p));
      p99865 = logisticQuantile(0.99865);
      p00135 = logisticQuantile(0.00135);
      p50 = logisticQuantile(0.5);
    } else {
      p99865 = minitabQuantile(allData, 0.99865);
      p00135 = minitabQuantile(allData, 0.00135);
      p50 = minitabQuantile(allData, 0.5);
    }

    const spread = p99865 - p00135;
    if (spread > 0) {
      nonNormalPp = specWidth / spread;
      nonNormalPpk = Math.min((usl - p50) / (p99865 - p50), (p50 - lsl) / (p50 - p00135));
    }
  }

  return {
    mean: processMean,
    sigmaWithin,
    sigmaOverall,
    cp,
    cpk,
    pp,
    ppk,
    cpm,
    lsl,
    usl,
    nominal,
    isNormal,
    bestFitDist: currentDist,
    nonNormalPp,
    nonNormalPpk,
    suggestions,
  };
}

export function calculateControlCharts(subgroups: SubgroupData[]): ControlChartResult {
  const cleanedSubgroups = subgroups.map((subgroup) => ({ ...subgroup, values: finiteValues(subgroup.values) }));
  const n = cleanedSubgroups[0]?.values.length || 0;

  if (n <= 1) {
    const allData = cleanedSubgroups.flatMap((subgroup) => subgroup.values);
    const xBar = mean(allData);
    const movingRanges: number[] = [];
    for (let i = 1; i < allData.length; i += 1) {
      movingRanges.push(Math.abs(allData[i] - allData[i - 1]));
    }
    const mrBar = mean(movingRanges);
    const xUcl = xBar + 2.66 * mrBar;
    const xLcl = xBar - 2.66 * mrBar;
    const mrUcl = 3.267 * mrBar;

    return {
      xBar: {
        points: allData.map((y, i) => ({ x: i + 1, y, isOutlier: y > xUcl || y < xLcl })),
        cl: xBar,
        ucl: xUcl,
        lcl: xLcl,
      },
      rChart: {
        points: movingRanges.map((y, i) => ({ x: i + 2, y, isOutlier: y > mrUcl || y < 0 })),
        cl: mrBar,
        ucl: mrUcl,
        lcl: 0,
      },
    };
  }

  const factors = XR_FACTORS[n] || XR_FACTORS[2];
  const subgroupMeans = cleanedSubgroups.map((subgroup) => mean(subgroup.values));
  const subgroupRanges = cleanedSubgroups.map((subgroup) => Math.max(...subgroup.values) - Math.min(...subgroup.values));
  const xDoubleBar = mean(subgroupMeans);
  const rBar = mean(subgroupRanges);
  const xUcl = xDoubleBar + factors.A2 * rBar;
  const xLcl = xDoubleBar - factors.A2 * rBar;
  const rUcl = factors.D4 * rBar;
  const rLcl = factors.D3 * rBar;

  return {
    xBar: {
      points: subgroupMeans.map((y, i) => ({ x: i + 1, y, isOutlier: y > xUcl || y < xLcl })),
      cl: xDoubleBar,
      ucl: xUcl,
      lcl: xLcl,
    },
    rChart: {
      points: subgroupRanges.map((y, i) => ({ x: i + 1, y, isOutlier: y > rUcl || y < rLcl })),
      cl: rBar,
      ucl: rUcl,
      lcl: rLcl,
    },
  };
}

export function getDistributionSuggestions(dataInput: number[]): DistributionSuggestion[] {
  const data = finiteValues(dataInput);
  const suggestions: DistributionSuggestion[] = [];
  const n = data.length;
  if (n < 5) return [{ name: 'Normal', pValue: 1, aSquared: 0 }];

  const allPositive = data.every((value) => value > 0);
  const normalAd = calculateAndersonDarling(data);
  suggestions.push({ name: 'Normal', pValue: normalAd.pValue, aSquared: normalAd.aSquaredAdj });

  if (allPositive) {
    const logAd = calculateAndersonDarling(data.map(Math.log));
    suggestions.push({ name: 'Lognormal', pValue: logAd.pValue, aSquared: logAd.aSquaredAdj });

    const { shape, scale } = weibullMLE(data);
    const sorted = [...data].sort((a, b) => a - b);
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      const z1 = 1 - Math.exp(-((sorted[i] / scale) ** shape));
      const z2 = 1 - Math.exp(-((sorted[n - 1 - i] / scale) ** shape));
      sum += (2 * (i + 1) - 1) * (Math.log(Math.max(z1, 1e-10)) + Math.log(Math.max(1 - z2, 1e-10)));
    }
    const aSq = -n - (1 / n) * sum;
    const aSqAdj = aSq * (1 + 0.2 / Math.sqrt(n));
    let pVal = 0;
    if (aSqAdj >= 1.038) {
      pVal = Math.exp(1.335 - 5.638 * aSqAdj + 0.406 * aSqAdj ** 2);
    } else if (aSqAdj >= 0.474) {
      pVal = Math.exp(1.173 - 4.191 * aSqAdj - 1.041 * aSqAdj ** 2);
    } else if (aSqAdj >= 0.34) {
      pVal = 1 - Math.exp(-1.17 + 13.5 * aSqAdj - 20.3 * aSqAdj ** 2);
    } else {
      pVal = 1 - Math.exp(-0.15 + 6.9 * aSqAdj - 12.1 * aSqAdj ** 2);
    }
    suggestions.push({ name: 'Weibull', pValue: Math.min(Math.max(pVal, 0), 1), aSquared: aSqAdj });

    const meanExp = mean(data);
    let sumE = 0;
    for (let i = 0; i < n; i += 1) {
      const p1 = 1 - Math.exp(-sorted[i] / meanExp);
      const p2 = 1 - Math.exp(-sorted[n - 1 - i] / meanExp);
      sumE += (2 * (i + 1) - 1) * (Math.log(Math.max(p1, 1e-10)) + Math.log(Math.max(1 - p2, 1e-10)));
    }
    const aSqE = -n - (1 / n) * sumE;
    const aSqEAdj = aSqE * (1 + 0.6 / n);
    let pValE = aSqEAdj >= 0.26
      ? Math.exp(0.1616 - 0.893 * aSqEAdj - 0.124 * aSqEAdj ** 2)
      : 1 - Math.exp(-12.22 + 115.9 * aSqEAdj - 282.3 * aSqEAdj ** 2);
    pValE = Math.min(Math.max(pValE, 0), 1);
    suggestions.push({ name: 'Exponential', pValue: pValE, aSquared: aSqEAdj });
  }

  const sortedLogist = [...data].sort((a, b) => a - b);
  const meanLogist = mean(sortedLogist);
  const stdLogist = sampleStandardDeviation(sortedLogist);
  const sLogist = (stdLogist * Math.sqrt(3)) / Math.PI || 1;
  let sumLogist = 0;
  for (let i = 0; i < n; i += 1) {
    const z1 = 1 / (1 + Math.exp(-(sortedLogist[i] - meanLogist) / sLogist));
    const z2 = 1 / (1 + Math.exp(-(sortedLogist[n - 1 - i] - meanLogist) / sLogist));
    sumLogist += (2 * (i + 1) - 1) * (Math.log(Math.max(z1, 1e-10)) + Math.log(Math.max(1 - z2, 1e-10)));
  }
  const aSqLogist = -n - (1 / n) * sumLogist;
  const aSqAdjLogist = aSqLogist * (1 + 0.25 / n);
  let pValLogist = 0;
  if (aSqAdjLogist >= 0.906) {
    pValLogist = Math.exp(0.648 - 5.756 * aSqAdjLogist + 0.852 * aSqAdjLogist ** 2);
  } else if (aSqAdjLogist > 0.555) {
    pValLogist = Math.exp(0.511 - 5.432 * aSqAdjLogist + 0.692 * aSqAdjLogist ** 2);
  } else {
    pValLogist = 1 - Math.exp(-1.905 + 13.505 * aSqAdjLogist - 18.42 * aSqAdjLogist ** 2);
  }
  suggestions.push({ name: 'Logistic', pValue: Math.min(Math.max(pValLogist, 0), 1), aSquared: aSqAdjLogist });

  return suggestions.sort((a, b) => b.pValue - a.pValue).slice(0, 3);
}

export function weibullMLE(dataInput: number[]) {
  const filtered = finiteValues(dataInput).filter((x) => x > 0);
  if (!filtered.length) return { shape: 1, scale: 1 };

  const lnX = filtered.map(Math.log);
  const meanLnX = mean(lnX);
  const stdLnX = sampleStandardDeviation(lnX);
  let k = 1.2825 / (stdLnX || 1);
  if (!Number.isFinite(k) || k <= 0) k = 1;

  for (let iter = 0; iter < 100; iter += 1) {
    let sumXk = 0;
    let sumXkLnX = 0;
    let sumXkLnX2 = 0;

    for (const x of filtered) {
      const xk = x ** k;
      const lnx = Math.log(x);
      sumXk += xk;
      sumXkLnX += xk * lnx;
      sumXkLnX2 += xk * lnx * lnx;
    }

    if (sumXk === 0) break;
    const f = sumXkLnX / sumXk - 1 / k - meanLnX;
    const df = (sumXkLnX2 * sumXk - sumXkLnX * sumXkLnX) / (sumXk * sumXk) + 1 / (k * k);
    if (df === 0 || !Number.isFinite(df)) break;

    const nextK = k - f / df;
    if (!Number.isFinite(nextK)) break;
    if (Math.abs(nextK - k) < 1e-7) {
      k = nextK;
      break;
    }
    k = nextK <= 0 ? 0.1 : nextK;
  }

  const sumXkFinal = filtered.reduce((acc, x) => acc + x ** k, 0);
  const scale = (sumXkFinal / filtered.length) ** (1 / k);
  return {
    shape: Number.isFinite(k) && k > 0 ? k : 1,
    scale: Number.isFinite(scale) && scale > 0 ? scale : mean(filtered) || 1,
  };
}

export function calculateAndersonDarling(dataInput: number[]): AndersonDarlingResult {
  const sorted = finiteValues(dataInput).sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 2) return { aSquared: 0, aSquaredAdj: 0, pValue: 1 };

  const avg = mean(sorted);
  const std = sampleStandardDeviation(sorted);
  if (std <= 0) return { aSquared: 0, aSquaredAdj: 0, pValue: 1 };

  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const z1 = normalCdf(sorted[i], avg, std);
    const z2 = normalCdf(sorted[n - 1 - i], avg, std);
    sum += (2 * (i + 1) - 1) * (Math.log(Math.max(z1, 1e-10)) + Math.log(Math.max(1 - z2, 1e-10)));
  }

  const aSquared = -n - (1 / n) * sum;
  const aSquaredAdj = aSquared * (1 + 0.75 / n + 2.25 / (n * n));
  let pValue = 0;
  if (aSquaredAdj >= 0.6) {
    pValue = Math.exp(1.2937 - 5.709 * aSquaredAdj + 0.0186 * aSquaredAdj ** 2);
  } else if (aSquaredAdj >= 0.34) {
    pValue = Math.exp(0.9177 - 4.279 * aSquaredAdj - 1.38 * aSquaredAdj ** 2);
  } else if (aSquaredAdj >= 0.2) {
    pValue = 1 - Math.exp(-8.318 + 42.796 * aSquaredAdj - 59.938 * aSquaredAdj ** 2);
  } else {
    pValue = 1 - Math.exp(-13.436 + 101.14 * aSquaredAdj - 223.73 * aSquaredAdj ** 2);
  }

  return { aSquared, aSquaredAdj, pValue: Math.min(Math.max(pValue, 0), 1) };
}

export function getProbabilityPlotPoints(dataInput: number[], distribution = 'Normal') {
  const sorted = finiteValues(dataInput).sort((a, b) => a - b);
  const n = sorted.length;

  return sorted.map((value, i) => {
    const p = (i + 0.5) / n;
    let x = value;
    let y = 0;

    if (distribution === 'Lognormal') {
      x = Math.log(Math.max(value, 1e-10));
      y = normalInv(p);
    } else if (distribution === 'Weibull') {
      x = Math.log(Math.max(value, 1e-10));
      y = Math.log(-Math.log(1 - p));
    } else if (distribution === 'Exponential') {
      y = -Math.log(1 - p);
    } else if (distribution === 'Logistic') {
      y = Math.log(p / (1 - p));
    } else {
      y = normalInv(p);
    }

    return { val: x, z: y, p: p * 100, originalVal: value };
  });
}

export function getHistogramData(dataInput: number[], binsCount = 10) {
  const data = finiteValues(dataInput);
  if (!data.length) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const binWidth = range / binsCount;

  return Array.from({ length: binsCount }, (_, i) => {
    const start = min + i * binWidth;
    const end = start + binWidth;
    const count = data.filter((value) => value >= start && (i === binsCount - 1 ? value <= end : value < end)).length;
    return {
      bin: `${start.toFixed(2)} - ${end.toFixed(2)}`,
      mid: start + binWidth / 2,
      count,
      density: count / (data.length * binWidth),
    };
  });
}

export function getDistributionPdfValue(distribution: string, dataInput: number[], x: number) {
  const data = finiteValues(dataInput);
  if (!data.length) return 0;

  if (distribution === 'Lognormal') {
    const logData = data.filter((value) => value > 0).map(Math.log);
    return lognormalPdf(x, mean(logData), sampleStandardDeviation(logData));
  }

  if (distribution === 'Weibull') {
    const { shape, scale } = weibullMLE(data);
    return weibullPdf(x, shape, scale);
  }

  if (distribution === 'Exponential') {
    const avg = mean(data);
    return avg > 0 ? exponentialPdf(x, 1 / avg) : 0;
  }

  if (distribution === 'Logistic') {
    const avg = mean(data);
    const sigma = sampleStandardDeviation(data);
    const s = (sigma * Math.sqrt(3)) / Math.PI || 1;
    const z = (x - avg) / s;
    return Math.exp(-z) / (s * (1 + Math.exp(-z)) ** 2);
  }

  return normalPdf(x, mean(data), sampleStandardDeviation(data));
}
