import { useMemo, useState, type ChangeEvent } from 'react';
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  Globe,
  Info,
  LayoutDashboard,
  Plus,
  Settings,
  Table as TableIcon,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  calculateAndersonDarling,
  calculateCapability,
  calculateControlCharts,
  getDistributionPdfValue,
  getHistogramData,
  getProbabilityPlotPoints,
  type SubgroupData,
} from '../utils/six-sigma-stats';
import type { Lang } from '../types/common';

type SixSigmaPageProps = {
  lang: Lang;
  onToggleLang: () => void;
  onBackToTools: () => void;
};

const createInitialSubgroups = (): SubgroupData[] =>
  Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    values: Array.from({ length: 5 }, () => 10 + Math.random() * 2 - 1),
  }));

const translations = {
  es: {
    title: 'Six Sigma Master',
    subtitle: 'Dashboard de Capacidad de Proceso',
    back: 'Volver a herramientas',
    dashboard: 'Dashboard',
    config: 'Datos a analizar',
    specLimits: 'Límites de Especificación',
    lsl: 'Límite Inferior (LSL)',
    nominal: 'Valor Nominal',
    usl: 'Límite Superior (USL)',
    subgroupSize: 'Tamaño de Subgrupo (n)',
    dataEntry: 'Entrada de Datos',
    bulkImport: 'Carga masiva',
    clear: 'Limpiar',
    add: 'Agregar',
    sample: 'Ejemplo',
    bulkLabel: 'Pega tus datos aquí separados por tabulador, coma o espacio.',
    cancel: 'Cancelar',
    import: 'Importar datos',
    id: 'ID',
    samplePrefix: 'Muestra',
    cp: 'Capacidad potencial',
    cpk: 'Capacidad real',
    pp: 'Desempeño potencial',
    ppk: 'Desempeño real',
    cpm: 'Índice de Taguchi',
    xBarTitle: 'Gráfico de Control X-Bar (Medias)',
    iTitle: 'Gráfico de Control I (Individuales)',
    rTitle: 'Gráfico de Control R (Rangos)',
    mrTitle: 'Gráfico de Control MR (Rango Móvil)',
    adPValue: 'Anderson-Darling p',
    detailedStats: 'Resumen Estadístico Detallado',
    processStats: 'Estadísticos de Proceso',
    mean: 'Media del proceso',
    sigmaWithin: 'Sigma (Corto Plazo)',
    sigmaOverall: 'Sigma (Largo Plazo)',
    normalityTest: 'Prueba de Normalidad',
    adStat: 'Anderson-Darling (A2)',
    pValue: 'Valor p',
    status: 'Estado',
    notNormal: 'No normal',
    specs: 'Especificaciones',
    interpretation: 'Interpretación',
    outOfControl: 'Proceso fuera de control.',
    inControl: 'Proceso bajo control estadístico.',
    capable: 'El proceso es capaz de cumplir con las especificaciones.',
    notCapable: 'El proceso no es capaz de cumplir con las especificaciones.',
    centered: 'El proceso está bien centrado.',
    notCentered: 'El proceso está desplazado respecto al nominal.',
    bestFit: 'Distribución sugerida',
    nonNormalStats: 'Capacidad ajustada (No normal - ISO 22514-2)',
    adjustedExplanation:
      'Dado que los datos no son normales, el cálculo de capacidad se ajusta con el método de percentiles.',
    excelImport: 'Importar Excel/CSV',
    excelError: 'Error al leer el archivo. Asegúrate de que el formato sea correcto.',
    importError: 'Error al procesar los datos. Asegúrate de que sean números válidos.',
    probabilityPlot: 'Gráfico de Probabilidad',
    histogram: 'Histograma',
    observedValue: 'Valor observado',
    logValue: 'Log(valor)',
    probability: 'Probabilidad',
    data: 'Datos',
    curveBasedOn: 'Curva basada en',
    topDistributions: 'Top 3 distribuciones sugeridas',
    distributionQuestion: 'Selecciona la distribución para el cálculo de capacidad.',
    selectedDistribution: 'Cálculo basado en la distribución seleccionada',
    goodnessOfFit: 'Prueba de ajuste',
    whyWeibull:
      'La distribución Weibull modela datos con asimetría, desgaste o procesos con límite natural en cero.',
    whyLognormal:
      'La distribución Lognormal aplica a procesos con valores positivos y cola larga a la derecha.',
    whyExponential:
      'La distribución Exponencial modela tiempos entre eventos o una tasa de falla constante.',
    whyNormal: 'La distribución Normal es adecuada para procesos estables y simétricos.',
    whyLogistic: 'La distribución Logistic es útil para datos simétricos con colas más pesadas que la normal.',
  },
  en: {
    title: 'Six Sigma Master',
    subtitle: 'Process Capability Dashboard',
    back: 'Back to tools',
    dashboard: 'Dashboard',
    config: 'Data to analyze',
    specLimits: 'Specification Limits',
    lsl: 'Lower Spec Limit (LSL)',
    nominal: 'Nominal Value',
    usl: 'Upper Spec Limit (USL)',
    subgroupSize: 'Subgroup Size (n)',
    dataEntry: 'Data Entry',
    bulkImport: 'Bulk import',
    clear: 'Clear',
    add: 'Add',
    sample: 'Sample',
    bulkLabel: 'Paste data here, separated by tab, comma, or space.',
    cancel: 'Cancel',
    import: 'Import data',
    id: 'ID',
    samplePrefix: 'Sample',
    cp: 'Potential capability',
    cpk: 'Actual capability',
    pp: 'Potential performance',
    ppk: 'Actual performance',
    cpm: 'Taguchi index',
    xBarTitle: 'X-Bar Control Chart (Means)',
    iTitle: 'I Control Chart (Individuals)',
    rTitle: 'R Control Chart (Ranges)',
    mrTitle: 'MR Control Chart (Moving Range)',
    adPValue: 'Anderson-Darling p',
    detailedStats: 'Detailed Statistical Summary',
    processStats: 'Process Statistics',
    mean: 'Process mean',
    sigmaWithin: 'Sigma (Within)',
    sigmaOverall: 'Sigma (Overall)',
    normalityTest: 'Normality Test',
    adStat: 'Anderson-Darling (A2)',
    pValue: 'p-value',
    status: 'Status',
    notNormal: 'Not normal',
    specs: 'Specifications',
    interpretation: 'Interpretation',
    outOfControl: 'Process out of control.',
    inControl: 'Process under statistical control.',
    capable: 'The process is capable of meeting specifications.',
    notCapable: 'The process is not capable of meeting specifications.',
    centered: 'The process is well centered.',
    notCentered: 'The process is shifted from nominal.',
    bestFit: 'Suggested distribution',
    nonNormalStats: 'Adjusted Capability (Non-normal - ISO 22514-2)',
    adjustedExplanation:
      'Since the data is non-normal, capability is adjusted with the percentile method.',
    excelImport: 'Import Excel/CSV',
    excelError: 'Error reading the file. Make sure the format is correct.',
    importError: 'Error processing data. Make sure the values are valid numbers.',
    probabilityPlot: 'Probability Plot',
    histogram: 'Histogram',
    observedValue: 'Observed value',
    logValue: 'Log(value)',
    probability: 'Probability',
    data: 'Data',
    curveBasedOn: 'Curve based on',
    topDistributions: 'Top 3 suggested distributions',
    distributionQuestion: 'Select the distribution for capability calculation.',
    selectedDistribution: 'Calculation based on selected distribution',
    goodnessOfFit: 'Goodness of Fit',
    whyWeibull:
      'Weibull models skewed data, wear-out behavior, or processes with a natural lower bound at zero.',
    whyLognormal:
      'Lognormal fits positive processes with a long right tail.',
    whyExponential:
      'Exponential models time between events or a constant failure rate.',
    whyNormal: 'Normal fits stable and symmetric processes.',
    whyLogistic: 'Logistic is useful for symmetric data with heavier tails than the normal curve.',
  },
};

const parseNumberInput = (value: string) => {
  if (value.trim() === '') return Number.NaN;
  return Number(value);
};

const formatMetric = (value: number | undefined, decimals = 3) =>
  Number.isFinite(value) ? value!.toFixed(decimals) : '0.000';

const normalizeRowsToSubgroups = (rows: unknown[][], subgroupSize: number, nominal: number) => {
  const subgroups: SubgroupData[] = [];
  rows.forEach((row, index) => {
    const values = row
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (!values.length) return;

    subgroups.push({
      id: index + 1,
      values:
        values.length >= subgroupSize
          ? values.slice(0, subgroupSize)
          : [...values, ...Array(subgroupSize - values.length).fill(nominal)],
    });
  });
  return subgroups;
};

const parseCsvRows = (file: File): Promise<unknown[][]> =>
  new Promise((resolve, reject) => {
    Papa.parse<unknown[]>(file, {
      skipEmptyLines: true,
      complete: (results) => resolve((results.data || []) as unknown[][]),
      error: (error) => reject(error),
    });
  });

const getDistributionReason = (dist: string | undefined, t: (typeof translations)['es']) => {
  if (!dist) return '';
  if (dist.includes('Weibull')) return t.whyWeibull;
  if (dist.includes('Lognormal')) return t.whyLognormal;
  if (dist.includes('Exponential')) return t.whyExponential;
  if (dist.includes('Logistic')) return t.whyLogistic;
  if (dist.includes('Normal')) return t.whyNormal;
  return '';
};

export default function SixSigmaPage({ lang, onToggleLang, onBackToTools }: SixSigmaPageProps) {
  const t = translations[lang];
  const [lsl, setLsl] = useState<number>(9);
  const [usl, setUsl] = useState<number>(11);
  const [nominal, setNominal] = useState<number>(10);
  const [subgroupSize, setSubgroupSize] = useState<number>(5);
  const [subgroups, setSubgroups] = useState<SubgroupData[]>(createInitialSubgroups);
  const [activeTab, setActiveTab] = useState<'config' | 'dashboard'>('dashboard');
  const [selectedDist, setSelectedDist] = useState<string | undefined>(undefined);
  const [bulkData, setBulkData] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const allData = useMemo(() => subgroups.flatMap((subgroup) => subgroup.values), [subgroups]);
  const stats = useMemo(() => {
    if (!allData.length) return null;
    return calculateCapability(subgroups, lsl, usl, nominal, selectedDist);
  }, [allData.length, lsl, nominal, selectedDist, subgroups, usl]);
  const controlCharts = useMemo(() => (subgroups.length ? calculateControlCharts(subgroups) : null), [subgroups]);
  const probPlotData = useMemo(
    () => (allData.length ? getProbabilityPlotPoints(allData, stats?.bestFitDist || 'Normal') : []),
    [allData, stats?.bestFitDist]
  );
  const adTest = useMemo(() => {
    if (!allData.length) return { aSquared: 0, aSquaredAdj: 0, pValue: 0 };
    const dist = stats?.bestFitDist || 'Normal';
    const suggestion = stats?.suggestions.find((item) => item.name === dist);
    if (suggestion) return { aSquared: suggestion.aSquared, aSquaredAdj: suggestion.aSquared, pValue: suggestion.pValue };
    return calculateAndersonDarling(allData);
  }, [allData, stats?.bestFitDist, stats?.suggestions]);
  const histogramData = useMemo(() => {
    if (!allData.length) return [];
    const bins = getHistogramData(allData, 12);
    const binWidth = bins.length > 1 ? bins[1].mid - bins[0].mid : 1;
    const totalCount = allData.length;
    const dist = stats?.bestFitDist || 'Normal';
    return bins.map((bin) => ({
      ...bin,
      curve: getDistributionPdfValue(dist, allData, bin.mid) * totalCount * binWidth,
    }));
  }, [allData, stats?.bestFitDist]);

  const handleAddSubgroup = () => {
    const newId = subgroups.length > 0 ? Math.max(...subgroups.map((subgroup) => subgroup.id)) + 1 : 1;
    setSubgroups([...subgroups, { id: newId, values: Array(subgroupSize).fill(nominal) }]);
  };

  const handleRemoveSubgroup = (id: number) => {
    setSubgroups(subgroups.filter((subgroup) => subgroup.id !== id));
  };

  const handleGenerateSample = () => {
    setSubgroups(
      Array.from({ length: 15 }, (_, index) => ({
        id: index + 1,
        values: Array.from({ length: subgroupSize }, () => nominal + (Math.random() * 0.4 - 0.2)),
      }))
    );
    setSelectedDist(undefined);
  };

  const handleBulkImport = () => {
    try {
      const rows = bulkData
        .trim()
        .split('\n')
        .map((line) => line.split(/[\t,; ]+/));
      const newSubgroups = normalizeRowsToSubgroups(rows, subgroupSize, nominal);
      if (newSubgroups.length > 0) {
        setSubgroups(newSubgroups);
        setShowBulkImport(false);
        setBulkData('');
        setSelectedDist(undefined);
        setImportError(null);
      }
    } catch {
      setImportError(t.importError);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const lowerName = file.name.toLowerCase();
      const rows = lowerName.endsWith('.csv')
        ? await parseCsvRows(file)
        : (await readXlsxFile(file))[0]?.data ?? [];
      const newSubgroups = normalizeRowsToSubgroups(rows as unknown[][], subgroupSize, nominal);

      if (newSubgroups.length > 0) {
        setSubgroups(newSubgroups);
        setSelectedDist(undefined);
        setImportError(null);
      } else {
        setImportError(t.excelError);
      }
    } catch {
      setImportError(t.excelError);
    }
  };

  const handleValueChange = (subgroupId: number, index: number, value: string) => {
    const num = parseNumberInput(value);
    setSubgroups(
      subgroups.map((subgroup) =>
        subgroup.id === subgroupId
          ? { ...subgroup, values: subgroup.values.map((current, i) => (i === index ? num : current)) }
          : subgroup
      )
    );
  };

  const handleSubgroupSizeChange = (value: number) => {
    setSubgroupSize(value);
    setSubgroups(
      subgroups.map((subgroup) => ({
        ...subgroup,
        values:
          subgroup.values.length > value
            ? subgroup.values.slice(0, value)
            : [...subgroup.values, ...Array(value - subgroup.values.length).fill(nominal)],
      }))
    );
    setSelectedDist(undefined);
  };

  const isCentered = stats ? Math.abs(stats.mean - nominal) < Math.abs(usl - lsl) * 0.1 : false;
  const distributionReason = getDistributionReason(stats?.bestFitDist, t);
  const chartLabelX =
    stats?.bestFitDist === 'Weibull' || stats?.bestFitDist === 'Lognormal' ? t.logValue : t.observedValue;
  const chartLabelY =
    stats?.bestFitDist === 'Weibull'
      ? 'Log(-Log(1-p))'
      : stats?.bestFitDist === 'Exponential'
        ? '-Log(1-p)'
        : stats?.bestFitDist === 'Logistic'
          ? 'Log(p/(1-p))'
          : 'Z-Score';

  return (
    <div className="app-shell">
      <header className="app-header sticky top-0 z-30 px-5 md:px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onBackToTools}
              className="app-button app-button-secondary px-3 py-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.back}
            </button>

            <div className="flex items-center gap-3">
              <div className="app-icon-tile">
                <TrendingUp size={22} />
              </div>
              <div>
                <h1 className="text-xl app-title">{t.title}</h1>
                <p className="text-xs font-medium app-muted uppercase">{t.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleLang}
              className="app-button app-button-secondary px-3 py-2 text-xs"
            >
              <Globe className="w-4 h-4" />
              {lang === 'es' ? 'EN' : 'ES'}
            </button>
            <nav className="app-tabs">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`app-tab ${activeTab === 'dashboard' ? 'app-tab-active' : ''}`}
              >
                <LayoutDashboard size={18} />
                {t.dashboard}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`app-tab ${activeTab === 'config' ? 'app-tab-active' : ''}`}
              >
                <Settings size={18} />
                {t.config}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="p-5 md:p-6 max-w-[1600px] mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'config' ? (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="app-panel p-6 h-fit">
                <div className="flex items-center gap-2 mb-6">
                  <Settings style={{ color: 'var(--app-primary)' }} size={20} />
                  <h2 className="text-lg app-title">{t.specLimits}</h2>
                </div>

                <div className="space-y-5">
                  {[
                    { label: t.lsl, value: lsl, setter: setLsl },
                    { label: t.nominal, value: nominal, setter: setNominal },
                    { label: t.usl, value: usl, setter: setUsl },
                  ].map((field) => (
                    <label key={field.label} className="block">
                      <span className="app-label">{field.label}</span>
                      <input
                        type="number"
                        value={Number.isNaN(field.value) ? '' : field.value}
                        onChange={(event) => field.setter(parseNumberInput(event.target.value))}
                        className="app-input px-4 py-3 font-medium"
                      />
                    </label>
                  ))}

                  <label className="block pt-4 border-t app-divider">
                    <span className="app-label">{t.subgroupSize}</span>
                    <select
                      value={subgroupSize}
                      onChange={(event) => handleSubgroupSizeChange(Number(event.target.value))}
                      className="app-input px-4 py-3 font-medium cursor-pointer"
                    >
                      {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="lg:col-span-2 app-panel overflow-hidden flex flex-col">
                <div className="p-5 md:p-6 border-b app-divider flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon style={{ color: 'var(--app-primary)' }} size={20} />
                    <h2 className="text-lg app-title">{t.dataEntry}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateSample}
                      className="app-button app-button-secondary px-3 py-2 text-sm"
                    >
                      {t.sample}
                    </button>
                    <label className="app-button app-button-success px-3 py-2 text-sm">
                      <Upload size={17} />
                      {t.excelImport}
                      <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowBulkImport(!showBulkImport)}
                      className="app-button app-button-secondary px-3 py-2 text-sm"
                    >
                      {t.bulkImport}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubgroups([]);
                        setSelectedDist(undefined);
                      }}
                      className="app-button app-button-danger px-3 py-2 text-sm"
                    >
                      {t.clear}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSubgroup}
                      className="app-button app-button-primary px-3 py-2 text-sm"
                    >
                      <Plus size={17} />
                      {t.add}
                    </button>
                  </div>
                </div>

                {(importError || showBulkImport) && (
                  <div className="border-b app-divider">
                    <AnimatePresence>
                      {showBulkImport && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="p-5 md:p-6 overflow-hidden" style={{ background: 'var(--app-bg)' }}
                        >
                          <label className="app-label">
                            {t.bulkLabel}
                          </label>
                          <textarea
                            value={bulkData}
                            onChange={(event) => setBulkData(event.target.value)}
                            placeholder={'10.1 10.2 9.8 10.0 10.1\n9.9 10.3 10.1 9.7 10.2'}
                            className="app-input h-32 p-4 font-mono text-sm mb-4"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowBulkImport(false)}
                              className="app-button app-button-secondary px-4 py-2 text-sm"
                            >
                              {t.cancel}
                            </button>
                            <button
                              type="button"
                              onClick={handleBulkImport}
                              className="app-button app-button-primary px-5 py-2 text-sm"
                            >
                              {t.import}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {importError && <p className="px-6 pb-4 text-sm app-text-danger">{importError}</p>}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="app-table-head">
                        <th className="px-5 py-4 text-xs font-bold uppercase w-20">{t.id}</th>
                        {Array.from({ length: subgroupSize }).map((_, index) => (
                          <th key={index} className="px-5 py-4 text-xs font-bold uppercase">
                            {t.samplePrefix} {index + 1}
                          </th>
                        ))}
                        <th className="px-5 py-4 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {subgroups.map((subgroup) => (
                        <tr key={subgroup.id} className="hover:bg-slate-50/70 transition-colors group">
                          <td className="px-5 py-4 font-mono text-sm app-muted font-bold">#{subgroup.id}</td>
                          {subgroup.values.map((value, index) => (
                            <td key={index} className="px-4 py-2 min-w-32">
                              <input
                                type="number"
                                step="any"
                                value={Number.isNaN(value) ? '' : value}
                                onChange={(event) => handleValueChange(subgroup.id, index, event.target.value)}
                                className="app-input px-3 py-2 font-medium"
                              />
                            </td>
                          ))}
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveSubgroup(subgroup.id)}
                              className="app-button app-button-danger app-button-icon"
                              aria-label="Remove subgroup"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ControlChartCard
                  title={subgroupSize === 1 ? t.iTitle : t.xBarTitle}
                  color="indigo"
                  data={controlCharts?.xBar.points || []}
                  cl={controlCharts?.xBar.cl}
                  ucl={controlCharts?.xBar.ucl}
                  lcl={controlCharts?.xBar.lcl}
                  interpretation={controlCharts?.xBar.points.some((point) => point.isOutlier) ? t.outOfControl : t.inControl}
                  interpretationLabel={t.interpretation}
                />
                <ControlChartCard
                  title={subgroupSize === 1 ? t.mrTitle : t.rTitle}
                  color="emerald"
                  data={controlCharts?.rChart.points || []}
                  cl={controlCharts?.rChart.cl}
                  ucl={controlCharts?.rChart.ucl}
                  lcl={controlCharts?.rChart.lcl}
                  interpretation={controlCharts?.rChart.points.some((point) => point.isOutlier) ? t.outOfControl : t.inControl}
                  interpretationLabel={t.interpretation}
                />

                <section className="app-panel p-6 flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <h3 className="app-title flex items-center gap-2">
                      <div className="w-2 h-6 bg-blue-500 rounded-full" />
                      {t.probabilityPlot} ({stats?.bestFitDist || 'Normal'})
                    </h3>
                    <div className="app-badge app-badge-primary">
                      {t.adPValue}: {adTest.pValue.toFixed(4)}
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          type="number"
                          dataKey="val"
                          name={t.observedValue}
                          stroke="#94A3B8"
                          fontSize={12}
                          domain={['auto', 'auto']}
                          label={{ value: chartLabelX, position: 'bottom', offset: 0, fontSize: 10, fontWeight: 'bold' }}
                        />
                        <YAxis
                          type="number"
                          dataKey="z"
                          name={t.probability}
                          stroke="#94A3B8"
                          fontSize={12}
                          label={{ value: chartLabelY, angle: -90, position: 'left', fontSize: 10, fontWeight: 'bold' }}
                        />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Scatter name={t.data} data={probPlotData} fill="#3B82F6" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <ChartInterpretation label={t.interpretation}>
                    {adTest.pValue > 0.05
                      ? `${lang === 'es' ? 'Los datos parecen seguir una distribución' : 'The data appears to follow a'} ${stats?.bestFitDist || 'Normal'}.`
                      : `${lang === 'es' ? 'Los datos no parecen seguir una distribución' : 'The data does not appear to follow a'} ${stats?.bestFitDist || 'Normal'}.`}
                  </ChartInterpretation>
                </section>

                <section className="app-panel p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="app-title flex items-center gap-2">
                      <div className="w-2 h-6 rounded-full" style={{ background: 'var(--app-chart-warning)' }} />
                      {t.histogram} ({stats?.bestFitDist || 'Normal'})
                    </h3>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
                      <ComposedChart data={histogramData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="mid" stroke="#94A3B8" fontSize={10} tickFormatter={(value) => Number(value).toFixed(2)} />
                        <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        {!Number.isNaN(lsl) && (
                          <ReferenceLine x={lsl} stroke="#F43F5E" strokeWidth={2} label={{ position: 'top', value: 'LSL', fill: '#F43F5E', fontSize: 10, fontWeight: 'bold' }} />
                        )}
                        {!Number.isNaN(usl) && (
                          <ReferenceLine x={usl} stroke="#F43F5E" strokeWidth={2} label={{ position: 'top', value: 'USL', fill: '#F43F5E', fontSize: 10, fontWeight: 'bold' }} />
                        )}
                        <Bar dataKey="count" fill="#FDE68A" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="curve" stroke="#D97706" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <ChartInterpretation label={t.interpretation}>
                    {stats && stats.ppk >= 1.33 ? t.capable : t.notCapable} {isCentered ? t.centered : t.notCentered}{' '}
                    {t.curveBasedOn}: {stats?.bestFitDist || 'Normal'}
                  </ChartInterpretation>
                </section>
              </div>

              <div className={`grid grid-cols-1 md:grid-cols-2 ${stats?.isNormal ? 'xl:grid-cols-5' : 'xl:grid-cols-2'} gap-4`}>
                {[
                  { label: 'Cp', value: stats?.cp, target: 1.33, desc: t.cp },
                  { label: 'Cpk', value: stats?.cpk, target: 1.33, desc: t.cpk },
                  { label: 'Pp', value: stats?.pp, target: 1.33, desc: t.pp },
                  { label: 'Ppk', value: stats?.ppk, target: 1.33, desc: t.ppk },
                  { label: 'Cpm', value: stats?.cpm, target: 1.33, desc: t.cpm },
                ]
                  .filter((item) => (stats?.isNormal ? true : item.label === 'Pp' || item.label === 'Ppk'))
                  .map((item) => (
                    <MetricCard key={item.label} {...item} />
                  ))}
              </div>

              {stats && (
                <section className="app-panel p-6" style={{ background: 'var(--app-primary-soft)', borderColor: 'var(--app-primary-border)' }}>
                  <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--app-primary-text)' }}>
                    <TrendingUp size={20} />
                    <h2 className="font-bold text-lg">{stats.isNormal && !selectedDist ? t.detailedStats : t.nonNormalStats}</h2>
                  </div>

                  {stats.suggestions.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase mb-3">{t.topDistributions}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {stats.suggestions.map((suggestion) => (
                          <button
                            key={suggestion.name}
                            type="button"
                            onClick={() => setSelectedDist(suggestion.name)}
                            className={`p-3 rounded-lg border transition-all text-left flex flex-col gap-1 cursor-pointer ${
                              stats.bestFitDist === suggestion.name
                                ? 'text-white shadow-sm'
                                : ''
                            }`}
                            style={stats.bestFitDist === suggestion.name ? { background: 'var(--app-primary)', borderColor: 'var(--app-primary)' } : { borderColor: 'var(--app-primary-border)', color: 'var(--app-primary-text)' }}
                          >
                            <span className="flex items-center justify-between">
                              <span className="font-bold text-sm">{suggestion.name}</span>
                              {stats.bestFitDist === suggestion.name && <CheckCircle2 size={14} />}
                            </span>
                            <span className="text-[10px]" style={{ color: stats.bestFitDist === suggestion.name ? 'color-mix(in srgb, white 82%, var(--app-primary-soft))' : 'var(--app-text-soft)' }}>
                              p-value: {suggestion.pValue.toFixed(4)}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] italic" style={{ color: 'var(--app-primary)' }}>{t.distributionQuestion}</p>
                    </div>
                  )}

                  {(!stats.isNormal || selectedDist) && (
                    <>
                      <p className="text-sm mb-4" style={{ color: 'var(--app-primary-text)' }}>
                        {selectedDist ? `${t.selectedDistribution}: ${selectedDist}` : t.adjustedExplanation}
                      </p>
                      {distributionReason && (
                        <div className="app-callout app-callout-primary flex items-start gap-2 mb-4">
                          <Info size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--app-primary)' }} />
                          <p className="text-xs italic" style={{ color: 'var(--app-primary-text)' }}>{distributionReason}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AdjustedMetric label="Pp (Adjusted)" value={stats.nonNormalPp ?? stats.pp} />
                        <AdjustedMetric label="Ppk (Adjusted)" value={stats.nonNormalPpk ?? stats.ppk} />
                      </div>
                    </>
                  )}
                </section>
              )}

              <section className="app-panel overflow-hidden">
                <div className="p-6 border-b app-divider flex items-center gap-2">
                  <Info style={{ color: 'var(--app-primary)' }} size={20} />
                  <h2 className="text-lg app-title">{t.detailedStats}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  <SummaryBlock title={t.processStats}>
                    <SummaryRow label={t.mean} value={stats?.mean.toFixed(4) || '0.0000'} />
                    {adTest.pValue > 0.05 && (
                      <SummaryRow label={t.sigmaWithin} value={stats?.sigmaWithin.toFixed(4) || '0.0000'} />
                    )}
                    <SummaryRow label={t.sigmaOverall} value={stats?.sigmaOverall.toFixed(4) || '0.0000'} />
                  </SummaryBlock>
                  <SummaryBlock title={stats?.bestFitDist === 'Normal' ? t.normalityTest : t.goodnessOfFit}>
                    <SummaryRow label={t.adStat} value={adTest.aSquared.toFixed(4)} />
                    <SummaryRow label={t.pValue} value={adTest.pValue.toFixed(4)} />
                    <SummaryRow
                      label={t.status}
                      value={adTest.pValue > 0.05 ? stats?.bestFitDist || 'Normal' : t.notNormal}
                      valueClassName={adTest.pValue > 0.05 ? 'app-text-success' : 'app-text-danger'}
                    />
                    {adTest.pValue <= 0.05 && stats?.bestFitDist && (
                      <SummaryRow label={t.bestFit} value={stats.bestFitDist} valueClassName="app-text-primary" />
                    )}
                  </SummaryBlock>
                  <SummaryBlock title={t.specs}>
                    <SummaryRow label="LSL" value={String(lsl)} />
                    <SummaryRow label={lang === 'es' ? 'Nominal' : 'Nominal'} value={String(nominal)} />
                    <SummaryRow label="USL" value={String(usl)} />
                  </SummaryBlock>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ControlChartCard({
  title,
  color,
  data,
  cl,
  ucl,
  lcl,
  interpretation,
  interpretationLabel,
}: {
  title: string;
  color: 'indigo' | 'emerald';
  data: { x: number; y: number; isOutlier: boolean }[];
  cl?: number;
  ucl?: number;
  lcl?: number;
  interpretation: string;
  interpretationLabel: string;
}) {
  const stroke = color === 'indigo' ? 'var(--app-chart-primary)' : 'var(--app-chart-secondary)';
  const barStyle = { background: color === 'indigo' ? 'var(--app-chart-primary)' : 'var(--app-chart-secondary)' };

  return (
    <section className="app-panel p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="app-title flex items-center gap-2">
          <div className="w-2 h-6 rounded-full" style={barStyle} />
          {title}
        </h3>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="x" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            {Number.isFinite(cl) && (
              <ReferenceLine y={cl} stroke={stroke} strokeWidth={2} label={{ position: 'right', value: 'CL', fill: stroke, fontSize: 10, fontWeight: 'bold' }} />
            )}
            {Number.isFinite(ucl) && (
              <ReferenceLine y={ucl} stroke="#F43F5E" strokeDasharray="5 5" label={{ position: 'right', value: 'UCL', fill: '#F43F5E', fontSize: 10, fontWeight: 'bold' }} />
            )}
            {Number.isFinite(lcl) && (
              <ReferenceLine y={lcl} stroke="#F43F5E" strokeDasharray="5 5" label={{ position: 'right', value: 'LCL', fill: '#F43F5E', fontSize: 10, fontWeight: 'bold' }} />
            )}
            <Line
              type="monotone"
              dataKey="y"
              stroke={stroke}
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cx === undefined || cy === undefined) return null;
                return (
                  <circle
                    key={`dot-${payload.x}`}
                    cx={cx}
                    cy={cy}
                    r={payload.isOutlier ? 6 : 4}
                    fill={payload.isOutlier ? '#F43F5E' : stroke}
                    stroke="white"
                    strokeWidth={2}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartInterpretation label={interpretationLabel}>{interpretation}</ChartInterpretation>
    </section>
  );
}

function ChartInterpretation({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 app-status-bar">
      <h4 className="text-[10px] font-bold uppercase mb-2 app-muted">{label}</h4>
      <p className="text-sm app-muted">{children}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  target,
  desc,
}: {
  label: string;
  value: number | undefined;
  target: number;
  desc: string;
}) {
  const isOnTarget = Number.isFinite(value) && value! >= target;
  return (
    <div className="app-card app-card-hover p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold uppercase app-muted">{label}</span>
          {isOnTarget ? <CheckCircle2 size={16} className="app-text-success" /> : <AlertCircle size={16} className="app-text-warning" />}
        </div>
        <div className="text-3xl font-black app-title">{formatMetric(value)}</div>
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase mb-1 app-muted">{desc}</p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${Math.min(((value || 0) / 2) * 100, 100)}%`,
              background: isOnTarget ? 'var(--app-success)' : 'var(--app-warning)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AdjustedMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="app-card p-4">
      <div className="flex justify-between items-center gap-4">
        <span className="text-sm font-bold uppercase app-muted">{label}</span>
        <span className="text-2xl font-black" style={{ color: 'var(--app-primary)' }}>{formatMetric(value)}</span>
      </div>
    </div>
  );
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 space-y-4">
      <h4 className="text-xs font-bold uppercase app-muted">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="app-muted">{label}:</span>
      <span className={`font-bold text-right ${valueClassName}`}>{value}</span>
    </div>
  );
}
