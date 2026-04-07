export function calculateGageRR(data: any[], partCol: string, opCol: string, measCol: string, lsl?: number, usl?: number, sigmaMultiplier: number = 6, includeInteraction: boolean = true) {
  // Extract values
  const records = data.map(d => ({
    part: String(d[partCol]),
    op: String(d[opCol]),
    meas: Number(d[measCol])
  })).filter(d => !isNaN(d.meas));

  const parts = Array.from(new Set(records.map(d => d.part)));
  const ops = Array.from(new Set(records.map(d => d.op)));
  
  const a = parts.length;
  const b = ops.length;
  
  // Calculate replicates per part-op combination
  const counts: Record<string, number> = {};
  records.forEach(d => {
    const key = `${d.part}|${d.op}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  
  const n = Math.min(...Object.values(counts));
  
  if (a < 2 || b < 2 || n < 2) {
    throw new Error("Not enough data for ANOVA");
  }
  
  // To keep it balanced, we take exactly `n` records per combination
  const balancedRecords = [];
  const currentCounts: Record<string, number> = {};
  for (const d of records) {
    const key = `${d.part}|${d.op}`;
    currentCounts[key] = (currentCounts[key] || 0) + 1;
    if (currentCounts[key] <= n) {
      balancedRecords.push(d);
    }
  }
  
  const N = a * b * n;
  
  const overallMean = balancedRecords.reduce((sum, d) => sum + d.meas, 0) / N;
  
  const partMeans: Record<string, number> = {};
  const opMeans: Record<string, number> = {};
  const partOpMeans: Record<string, number> = {};
  
  parts.forEach(p => partMeans[p] = 0);
  ops.forEach(o => opMeans[o] = 0);
  parts.forEach(p => ops.forEach(o => partOpMeans[`${p}|${o}`] = 0));
  
  balancedRecords.forEach(d => {
    partMeans[d.part] += d.meas / (b * n);
    opMeans[d.op] += d.meas / (a * n);
    partOpMeans[`${d.part}|${d.op}`] += d.meas / n;
  });
  
  let ssTotal = 0;
  balancedRecords.forEach(d => {
    ssTotal += Math.pow(d.meas - overallMean, 2);
  });
  
  let ssPart = 0;
  parts.forEach(p => {
    ssPart += b * n * Math.pow(partMeans[p] - overallMean, 2);
  });
  
  let ssOp = 0;
  ops.forEach(o => {
    ssOp += a * n * Math.pow(opMeans[o] - overallMean, 2);
  });
  
  let ssPartOp = 0;
  parts.forEach(p => {
    ops.forEach(o => {
      ssPartOp += n * Math.pow(partOpMeans[`${p}|${o}`] - partMeans[p] - opMeans[o] + overallMean, 2);
    });
  });
  
  const ssError = ssTotal - ssPart - ssOp - ssPartOp;
  
  const dfPart = a - 1;
  const dfOp = b - 1;
  const dfPartOp = (a - 1) * (b - 1);
  const dfError = a * b * (n - 1);
  
  const msPart = ssPart / dfPart;
  const msOp = ssOp / dfOp;
  const msPartOp = ssPartOp / dfPartOp;
  const msError = ssError / dfError;
  
  let varRepeatability = msError;
  let varInteraction = 0;
  let varOp = 0;
  let varPart = 0;

  if (includeInteraction) {
    varRepeatability = msError;
    varInteraction = (msPartOp - msError) / n;
    if (varInteraction < 0) varInteraction = 0;
    
    varOp = (msOp - msPartOp) / (a * n);
    if (varOp < 0) varOp = 0;
    
    varPart = (msPart - msPartOp) / (b * n);
    if (varPart < 0) varPart = 0;
  } else {
    // Pooled Error (Interaction removed)
    const ssErrorPooled = ssError + ssPartOp;
    const dfErrorPooled = dfError + dfPartOp;
    const msErrorPooled = ssErrorPooled / dfErrorPooled;
    
    varRepeatability = msErrorPooled;
    varInteraction = 0;
    
    varOp = (msOp - msErrorPooled) / (a * n);
    if (varOp < 0) varOp = 0;
    
    varPart = (msPart - msErrorPooled) / (b * n);
    if (varPart < 0) varPart = 0;
  }
  
  const varReproducibility = varOp + varInteraction;
  const varGage = varRepeatability + varReproducibility;
  const varTotal = varGage + varPart;
  
  const pctContribGage = (varGage / varTotal) * 100;
  const pctContribRepeat = (varRepeatability / varTotal) * 100;
  const pctContribReprod = (varReproducibility / varTotal) * 100;
  const pctContribOp = (varOp / varTotal) * 100;
  const pctContribInteraction = (varInteraction / varTotal) * 100;
  const pctContribPart = (varPart / varTotal) * 100;
  
  const sdGage = Math.sqrt(varGage);
  const sdRepeat = Math.sqrt(varRepeatability);
  const sdReprod = Math.sqrt(varReproducibility);
  const sdOp = Math.sqrt(varOp);
  const sdInteraction = Math.sqrt(varInteraction);
  const sdPart = Math.sqrt(varPart);
  const sdTotal = Math.sqrt(varTotal);
  
  const pctStudyGage = (sdGage / sdTotal) * 100;
  const pctStudyRepeat = (sdRepeat / sdTotal) * 100;
  const pctStudyReprod = (sdReprod / sdTotal) * 100;
  const pctStudyOp = (sdOp / sdTotal) * 100;
  const pctStudyInteraction = (sdInteraction / sdTotal) * 100;
  const pctStudyPart = (sdPart / sdTotal) * 100;
  
  let ndc = Math.floor(1.41 * (sdPart / sdGage));
  if (ndc < 1) ndc = 1;
  
  // Control Charts (X-bar and R)
  const groupData: Record<string, number[]> = {};
  balancedRecords.forEach(d => {
    const key = `${d.part}|${d.op}`;
    if (!groupData[key]) groupData[key] = [];
    groupData[key].push(d.meas);
  });

  let sumR = 0;
  let countR = 0;
  const rDataMap: Record<string, any> = {};
  const xBarDataMap: Record<string, any> = {};

  parts.forEach(p => {
    rDataMap[p] = { part: p };
    xBarDataMap[p] = { part: p };
    ops.forEach(o => {
      const vals = groupData[`${p}|${o}`];
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      const r = max - min;
      const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;

      rDataMap[p][o] = r;
      xBarDataMap[p][o] = mean;

      sumR += r;
      countR++;
    });
  });

  const R_bar = sumR / countR;
  const X_dbl_bar = overallMean;

  const d3_table: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.076, 8: 0.136, 9: 0.184, 10: 0.223 };
  const d4_table: Record<number, number> = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114, 6: 2.004, 7: 1.924, 8: 1.864, 9: 1.816, 10: 1.777 };
  const a2_table: Record<number, number> = { 2: 1.880, 3: 1.023, 4: 0.729, 5: 0.577, 6: 0.483, 7: 0.419, 8: 0.373, 9: 0.337, 10: 0.308 };

  const n_clamp = Math.min(Math.max(n, 2), 10);
  const D3 = d3_table[n_clamp] || 0;
  const D4 = d4_table[n_clamp] || 1.777;
  const A2 = a2_table[n_clamp] || 0.308;

  const UCL_R = D4 * R_bar;
  const LCL_R = D3 * R_bar;
  const UCL_X = X_dbl_bar + A2 * R_bar;
  const LCL_X = X_dbl_bar - A2 * R_bar;

  const rData = parts.map(p => rDataMap[p]);
  const xBarData = parts.map(p => xBarDataMap[p]);

  // Tolerance
  let hasTolerance = false;
  let pctTolGage = 0, pctTolRepeat = 0, pctTolReprod = 0, pctTolOp = 0, pctTolInteraction = 0, pctTolPart = 0;

  if (lsl !== undefined && usl !== undefined && usl > lsl) {
    hasTolerance = true;
    const tol = usl - lsl;
    pctTolGage = (sigmaMultiplier * sdGage / tol) * 100;
    pctTolRepeat = (sigmaMultiplier * sdRepeat / tol) * 100;
    pctTolReprod = (sigmaMultiplier * sdReprod / tol) * 100;
    pctTolOp = (sigmaMultiplier * sdOp / tol) * 100;
    pctTolInteraction = (sigmaMultiplier * sdInteraction / tol) * 100;
    pctTolPart = (sigmaMultiplier * sdPart / tol) * 100;
  }

  const getQuartile = (arr: number[], q: number) => {
    const pos = (arr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (arr[base + 1] !== undefined) {
      return arr[base] + rest * (arr[base + 1] - arr[base]);
    } else {
      return arr[base];
    }
  };

  const partChartData = parts.map(p => {
    const obj: any = { part: p, mean: partMeans[p] };
    const vals = balancedRecords.filter(d => d.part === p).map(d => d.meas);
    vals.forEach((v, i) => {
      obj[`val_${i}`] = v;
    });
    return obj;
  });
  const maxValsPerPart = a > 0 ? balancedRecords.filter(d => d.part === parts[0]).length : 0;

  const opChartData = ops.map(o => {
    const vals = balancedRecords.filter(d => d.op === o).map(d => d.meas).sort((a, b) => a - b);
    const min = vals[0];
    const max = vals[vals.length - 1];
    const q1 = getQuartile(vals, 0.25);
    const median = getQuartile(vals, 0.5);
    const q3 = getQuartile(vals, 0.75);
    const mean = opMeans[o];
    
    return {
      op: o,
      min, q1, median, q3, max, mean,
      box: [q1, q3],
      whisker: [median - min, max - median]
    };
  });

  return {
    varGage, varRepeatability, varReproducibility, varOp, varInteraction, varPart, varTotal,
    pctContribGage, pctContribRepeat, pctContribReprod, pctContribOp, pctContribInteraction, pctContribPart,
    sdGage, sdRepeat, sdReprod, sdOp, sdInteraction, sdPart, sdTotal,
    pctStudyGage, pctStudyRepeat, pctStudyReprod, pctStudyOp, pctStudyInteraction, pctStudyPart,
    ndc,
    hasTolerance, pctTolGage, pctTolRepeat, pctTolReprod, pctTolOp, pctTolInteraction, pctTolPart,
    rData, xBarData, R_bar, X_dbl_bar, UCL_R, LCL_R, UCL_X, LCL_X,
    ops, partChartData, maxValsPerPart, opChartData,
    includeInteraction
  };
}
