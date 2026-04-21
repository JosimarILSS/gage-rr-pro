import { useEffect, useRef, useState } from 'react';
import { AlertCircle, BarChart3, CheckCircle2, FileDown, FileSpreadsheet, Globe, Info, LogOut, RotateCcw, Settings, ShieldCheck, Upload, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import SidebarLayout from '../layouts/SidebarLayout';
import PremiumUnlockCard from '../components/premium/PremiumUnlockCard';
import { t } from '../translations';
import type { UseGageRRWorkspaceResult } from '../hooks/useGageRRWorkspace';
import type { Lang } from '../types/common';

const PartTooltip = ({ active, payload, label, measLabel }: any) => {
  if (!active || !payload?.length) return null;
  const mean = payload.find((p: any) => p.dataKey === 'mean');
  const vals = payload.filter((p: any) => p.dataKey?.startsWith('val_') && p.value != null);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      {mean && <p className="text-indigo-600 font-medium mb-1">{`Media : ${Number(mean.value).toFixed(2)}`}</p>}
      {vals.map((v: any, i: number) => (
        <p key={i} className="text-slate-500">{`${measLabel} ${i + 1} : ${Number(v.value).toFixed(2)}`}</p>
      ))}
    </div>
  );
};

const OpTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const mean = payload.find((p: any) => p.dataKey === 'mean');
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm min-w-[140px]">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {mean && <p className="text-slate-600">{`Media : ${Number(mean.value).toFixed(2)}`}</p>}
    </div>
  );
};

const CrossedCircle = (props: any) => {
  const { cx, cy, stroke, fill } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} stroke={stroke || '#3b82f6'} fill={fill || '#fff'} strokeWidth={1.5} />
      <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke={stroke || '#3b82f6'} strokeWidth={1.5} />
      <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke={stroke || '#3b82f6'} strokeWidth={1.5} />
    </g>
  );
};

type AnalysisPageProps = {
  lang: Lang;
  onToggleLang: () => void;
  userEmail: string | null | undefined;
  onLogout: () => Promise<void>;
  esPremium: boolean;
  isCheckoutLoading: boolean;
  checkoutError: string | null;
  onUnlockPremium: () => Promise<void>;
  workspace: UseGageRRWorkspaceResult;
  showAdminAccessButton?: boolean;
  onGoToAdminAccess?: () => void;
};

export default function AnalysisPage({
  lang,
  onToggleLang,
  userEmail,
  onLogout,
  esPremium,
  isCheckoutLoading,
  checkoutError,
  onUnlockPremium,
  workspace,
  showAdminAccessButton = false,
  onGoToAdminAccess,
}: AnalysisPageProps) {
  const {
    problemDesc,
    setProblemDesc,
    fileName,
    data,
    columns,
    partCol,
    setPartCol,
    opCol,
    setOpCol,
    measCol,
    setMeasCol,
    lie,
    setLie,
    lse,
    setLse,
    sigmaMultiplier,
    setSigmaMultiplier,
    includeInteraction,
    setIncludeInteraction,
    showResults,
    setShowResults,
    handleFileUpload,
    resetWorkspace,
    validation,
    results,
  } = workspace;

  const section4Ref = useRef<HTMLDivElement>(null);
  const section5Ref = useRef<HTMLDivElement>(null);
  const mainPanelRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExportPDF = () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    document.body.classList.add('printing-pdf');

    const cleanup = () => {
      document.body.classList.remove('printing-pdf');
      setIsExportingPDF(false);
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => window.print(), 150);
  };

  // Al volver de Stripe con checkout=success, hacer scroll a sección 5
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success' && esPremium) {
      setTimeout(() => scrollTo(section5Ref), 600);
    }
  }, [esPremium]);

  const chartColors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <SidebarLayout
      mainRef={mainPanelRef}
      mobileSidebarCollapsed={data.length > 0}
      sidebar={
        <>
        <div>
          <div className="flex justify-between items-start mb-4 pr-12 md:pr-0">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" />
              {t[lang].title}
            </h1>
            <button
              onClick={onToggleLang}
              className="flex items-center gap-1.5 text-sm md:text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors bg-slate-100 px-3 py-2 md:px-2 md:py-1 rounded-lg md:rounded-md cursor-pointer"
            >
              <Globe className="w-4 h-4 md:w-3 md:h-3" />
              {lang === 'es' ? 'EN' : 'ES'}
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-1">{t[lang].subtitle}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{t[lang].step1}</h2>
          <textarea
            className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none h-32"
            placeholder={t[lang].problemPlaceholder}
            value={problemDesc}
            onChange={(e) => setProblemDesc(e.target.value)}
          />
        </div>

        <div id="print-sidebar-hide" className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{t[lang].loadData}</h2>
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-7 h-7 text-slate-400 mb-2" />
              <p className="text-sm text-slate-600"><span className="font-semibold">{t[lang].uploadPrompt}</span></p>
              <p className="text-xs text-slate-500">{t[lang].dragDrop}</p>
            </div>
            <input type="file" className="hidden" accept=".csv, .xlsx" onChange={handleFileUpload} />
          </label>

          {fileName && (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
              <FileSpreadsheet className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-xs text-indigo-700 font-medium truncate flex-1" title={fileName}>{fileName}</span>
            </div>
          )}

          <button
            onClick={resetWorkspace}
            disabled={!fileName}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              enabled:cursor-pointer enabled:bg-red-50 enabled:border enabled:border-red-200 enabled:text-red-600 enabled:hover:bg-red-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {lang === 'es' ? 'Reiniciar datos ingresados y análisis generado' : 'Reset entered data and generated analysis'}
          </button>

          <button
            onClick={handleExportPDF}
            disabled={!results || isExportingPDF}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              enabled:cursor-pointer enabled:bg-indigo-50 enabled:border enabled:border-indigo-200 enabled:text-indigo-600 enabled:hover:bg-indigo-100"
          >
            <FileDown className="w-3.5 h-3.5" />
            {isExportingPDF
              ? (lang === 'es' ? 'Generando PDF...' : 'Generating PDF...')
              : (lang === 'es' ? 'Generar PDF de los resultados' : 'Generate PDF of results')}
          </button>
        </div>

        <div id="print-logout-hide" className="mt-auto pt-6 border-t border-slate-200 space-y-3">
          {showAdminAccessButton && onGoToAdminAccess && (
            <button
              type="button"
              onClick={onGoToAdminAccess}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg px-3 py-2 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              {lang === 'es' ? 'Acceso a administración de usuarios' : 'User Admin Access'}
            </button>
          )}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 truncate pr-2" title={userEmail || ''}>
              {userEmail}
            </div>
            <button onClick={onLogout} className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
              {t[lang].logout}
            </button>
          </div>
        </div>
        </>
      }
    >
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <FileSpreadsheet className="w-16 h-16 mb-4 text-slate-300" />
            <h2 className="text-xl font-medium text-slate-600">{t[lang].waitingData}</h2>
            <p className="text-sm mt-2">{t[lang].uploadToStart}</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* 2. Mapeado de Datos */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                {t[lang].step2}
              </h2>
              
              <div className="overflow-x-auto mb-6 border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left text-slate-600">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      {columns.map(col => <th key={col} className="px-4 py-3">{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        {columns.map(col => <td key={col} className="px-4 py-2">{String(row[col] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].partCol}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={partCol} onChange={e => {setPartCol(e.target.value); setShowResults(false);}}>
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].opCol}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={opCol} onChange={e => {setOpCol(e.target.value); setShowResults(false);}}>
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].measCol}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={measCol} onChange={e => {setMeasCol(e.target.value); setShowResults(false);}}>
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].lsl}</label>
                  <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={lie} onChange={e => {setLie(e.target.value); setShowResults(false);}} placeholder="Ej. 10.5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].usl}</label>
                  <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={lse} onChange={e => {setLse(e.target.value); setShowResults(false);}} placeholder="Ej. 11.5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].multiplier}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={sigmaMultiplier} onChange={e => {setSigmaMultiplier(Number(e.target.value)); setShowResults(false);}}>
                    <option value={6}>{t[lang].mult6}</option>
                    <option value={5.15}>{t[lang].mult515}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].interaction}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={includeInteraction ? 'true' : 'false'} onChange={e => {setIncludeInteraction(e.target.value === 'true'); setShowResults(false);}}>
                    <option value="true">{t[lang].inclInteraction}</option>
                    <option value="false">{t[lang].omitInteraction}</option>
                  </select>
                </div>
              </div>
            </section>

            {/* 3. Validación de Supuestos */}
            {validation && (
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  {t[lang].step3}
                </h2>
                
                {!validation.valid ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-red-800 mb-2">{t[lang].invalidData}</h3>
                        <ul className="list-disc pl-5 text-sm text-red-700 space-y-1 mb-4">
                          {validation.errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                        <div className="bg-red-100 p-3 rounded-lg text-sm text-red-800 flex gap-2 items-start">
                          <Info className="w-4 h-4 mt-0.5 shrink-0" />
                          <p><strong>{t[lang].alternatives}</strong> {t[lang].alternativesText}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <p className="text-sm font-medium">{t[lang].validData}</p>
                    </div>
                    
                    <button
                      onClick={() => { setShowResults(true); setTimeout(() => scrollTo(section4Ref), 100); }}
                      className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <BarChart3 className="w-4 h-4" />
                      {t[lang].calcBtn}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* 4 & 5. Resultados e Interpretación */}
            {showResults && results && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section ref={section4Ref} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800 mb-6">{t[lang].step4}</h2>
                  
                  <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <tr>
                          <th className="px-4 py-3">{t[lang].source}</th>
                          <th className="px-4 py-3 text-right">{t[lang].varComp}</th>
                          <th className="px-4 py-3 text-right">{t[lang].pctContrib}</th>
                          <th className="px-4 py-3 text-right">{t[lang].stdDev}</th>
                          <th className="px-4 py-3 text-right">{t[lang].pctStudyVar}</th>
                          {results.hasTolerance && <th className="px-4 py-3 text-right">{t[lang].pctTol}</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        <tr className="font-medium text-slate-800 bg-slate-50/50">
                          <td className="px-4 py-3">{t[lang].totalGage}</td>
                          <td className="px-4 py-3 text-right">{results.varGage.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">{results.pctContribGage.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right">{results.sdGage.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">{results.pctStudyGage.toFixed(2)}%</td>
                          {results.hasTolerance && <td className="px-4 py-3 text-right">{results.pctTolGage.toFixed(2)}%</td>}
                        </tr>
                        <tr>
                          <td className="px-4 py-3 pl-8 text-slate-500">{t[lang].repeatability}</td>
                          <td className="px-4 py-3 text-right">{results.varRepeatability.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">{results.pctContribRepeat.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right">{results.sdRepeat.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">{results.pctStudyRepeat.toFixed(2)}%</td>
                          {results.hasTolerance && <td className="px-4 py-3 text-right">{results.pctTolRepeat.toFixed(2)}%</td>}
                        </tr>
                        <tr>
                          <td className="px-4 py-3 pl-8 text-slate-500">{t[lang].reproducibility}</td>
                          <td className="px-4 py-3 text-right">{results.varReproducibility.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">{results.pctContribReprod.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right">{results.sdReprod.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">{results.pctStudyReprod.toFixed(2)}%</td>
                          {results.hasTolerance && <td className="px-4 py-3 text-right">{results.pctTolReprod.toFixed(2)}%</td>}
                        </tr>
                        <tr>
                          <td className="px-4 py-3 pl-12 text-slate-400 text-sm">{t[lang].operator}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-500">{results.varOp.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-500">{results.pctContribOp.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-500">{results.sdOp.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-500">{results.pctStudyOp.toFixed(2)}%</td>
                          {results.hasTolerance && <td className="px-4 py-3 text-right text-sm text-slate-500">{results.pctTolOp.toFixed(2)}%</td>}
                        </tr>
                        {results.includeInteraction && (
                          <tr>
                            <td className="px-4 py-3 pl-12 text-slate-400 text-sm">{t[lang].opPart}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-500">{results.varInteraction.toFixed(5)}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-500">{results.pctContribInteraction.toFixed(2)}%</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-500">{results.sdInteraction.toFixed(5)}</td>
                            <td className="px-4 py-3 text-right text-sm text-slate-500">{results.pctStudyInteraction.toFixed(2)}%</td>
                            {results.hasTolerance && <td className="px-4 py-3 text-right text-sm text-slate-500">{results.pctTolInteraction.toFixed(2)}%</td>}
                          </tr>
                        )}
                        <tr className="font-medium text-slate-800 bg-slate-50/50">
                          <td className="px-4 py-3">{t[lang].partToPart}</td>
                          <td className="px-4 py-3 text-right">{results.varPart.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">{results.pctContribPart.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right">{results.sdPart.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">{results.pctStudyPart.toFixed(2)}%</td>
                          {results.hasTolerance && <td className="px-4 py-3 text-right">{results.pctTolPart.toFixed(2)}%</td>}
                        </tr>
                        <tr className="font-bold text-slate-900 bg-slate-100">
                          <td className="px-4 py-3">{t[lang].totalVar}</td>
                          <td className="px-4 py-3 text-right">{results.varTotal.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">100.00%</td>
                          <td className="px-4 py-3 text-right">{results.sdTotal.toFixed(5)}</td>
                          <td className="px-4 py-3 text-right">100.00%</td>
                          {results.hasTolerance && <td className="px-4 py-3 text-right">-</td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="bg-indigo-50 text-indigo-900 p-4 rounded-xl inline-flex items-center gap-2 font-medium">
                    <span className="text-indigo-600">{t[lang].ndc}</span> 
                    <span className="text-xl">{results.ndc}</span>
                  </div>

                  <div className="mt-10 h-80 w-full">
                    <h3 className="text-md font-bold text-slate-700 mb-6 text-center">{t[lang].compVarChart}</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            name: t[lang].totalGage,
                            [t[lang].pctStudyVar]: Number(results.pctStudyGage.toFixed(2)),
                            ...(results.hasTolerance ? { [t[lang].pctTol]: Number(results.pctTolGage.toFixed(2)) } : {})
                          },
                          {
                            name: t[lang].repeatability,
                            [t[lang].pctStudyVar]: Number(results.pctStudyRepeat.toFixed(2)),
                            ...(results.hasTolerance ? { [t[lang].pctTol]: Number(results.pctTolRepeat.toFixed(2)) } : {})
                          },
                          {
                            name: t[lang].reproducibility,
                            [t[lang].pctStudyVar]: Number(results.pctStudyReprod.toFixed(2)),
                            ...(results.hasTolerance ? { [t[lang].pctTol]: Number(results.pctTolReprod.toFixed(2)) } : {})
                          },
                          {
                            name: t[lang].partToPart,
                            [t[lang].pctStudyVar]: Number(results.pctStudyPart.toFixed(2)),
                            ...(results.hasTolerance ? { [t[lang].pctTol]: Number(results.pctTolPart.toFixed(2)) } : {})
                          }
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fill: '#475569' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis tick={{ fill: '#475569' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          cursor={{ fill: '#f1f5f9' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" label={{ position: 'top', value: '10%', fill: '#22c55e', fontSize: 12 }} />
                        <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: '30%', fill: '#ef4444', fontSize: 12 }} />
                        <Bar dataKey={t[lang].pctStudyVar} fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        {results.hasTolerance && <Bar dataKey={t[lang].pctTol} fill="#10b981" radius={[4, 4, 0, 0]} />}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                    <div className="h-80 w-full">
                      <h3 className="text-md font-bold text-slate-700 mb-4 text-center">{t[lang].xBarChart}</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={results.xBarData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="part" tick={{ fill: '#475569', fontSize: 12 }} />
                          <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 12 }} />
                          <Tooltip contentStyle={{ borderRadius: '0.5rem' }} />
                          <Legend />
                          <ReferenceLine y={results.UCL_X} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'LSC', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={results.LCL_X} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'LIC', position: 'insideBottomRight', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={results.X_dbl_bar} stroke="#22c55e" label={{ value: 'X̄̄', position: 'insideTopRight', fill: '#22c55e', fontSize: 10 }} />
                          {results.ops.map((op: string, i: number) => (
                            <Line key={op} type="monotone" dataKey={op} stroke={chartColors[i % chartColors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="h-80 w-full">
                      <h3 className="text-md font-bold text-slate-700 mb-4 text-center">{t[lang].rChart}</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={results.rData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="part" tick={{ fill: '#475569', fontSize: 12 }} />
                          <YAxis domain={[0, 'auto']} tick={{ fill: '#475569', fontSize: 12 }} />
                          <Tooltip contentStyle={{ borderRadius: '0.5rem' }} />
                          <Legend />
                          <ReferenceLine y={results.UCL_R} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'LSC', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={results.LCL_R} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'LIC', position: 'insideBottomRight', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={results.R_bar} stroke="#22c55e" label={{ value: 'R̄', position: 'insideTopRight', fill: '#22c55e', fontSize: 10 }} />
                          {results.ops.map((op: string, i: number) => (
                            <Line key={op} type="monotone" dataKey={op} stroke={chartColors[i % chartColors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Nuevas gráficas estilo Minitab */}
                  <div className="mt-16 border-t border-slate-200 pt-10">
                    <h2 className="text-lg font-bold text-slate-800 mb-8 text-center">{t[lang].additionalCharts}</h2>
                    
                    <div className="grid grid-cols-1 gap-12">
                      {/* Medición por Parte */}
                      <div className="h-80 w-full">
                        <h3 className="text-md font-bold text-slate-700 mb-4 text-center">{measCol || t[lang].measurement} {t[lang].measByPartChart}</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={results.partChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="part" tick={{ fill: '#475569', fontSize: 12 }} />
                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 12 }} />
                            <Tooltip content={<PartTooltip measLabel={measCol || t[lang].measurement} />} />
                            {Array.from({ length: results.maxValsPerPart }).map((_, i) => (
                              <Scatter key={i} dataKey={`val_${i}`} fill="#94a3b8" name={`${t[lang].measurement} ${i+1}`} />
                            ))}
                            <Line dataKey="mean" name={t[lang].mean} stroke="#3b82f6" strokeWidth={1.5} dot={<CrossedCircle stroke="#3b82f6" />} activeDot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Medición por Analista */}
                      <div className="h-80 w-full">
                        <h3 className="text-md font-bold text-slate-700 mb-4 text-center">{measCol || t[lang].measurement} {t[lang].measByOpChart}</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={results.opChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="op" tick={{ fill: '#475569', fontSize: 12 }} />
                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 12 }} />
                            <Tooltip content={<OpTooltip />} />
                            <Scatter dataKey="median" name={t[lang].median} fill="transparent" stroke="transparent">
                              <ErrorBar dataKey="whisker" width={8} strokeWidth={1.5} stroke="#475569" direction="y" />
                            </Scatter>
                            <Bar dataKey="box" name={t[lang].box} fill="#8ea8d6" stroke="#475569" strokeWidth={1.5} barSize={60} />
                            <Line dataKey="mean" name={t[lang].mean} stroke="#475569" strokeWidth={1.5} dot={<CrossedCircle stroke="#475569" />} activeDot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Interacción Parte * Analista */}
                      <div className="h-80 w-full">
                        <h3 className="text-md font-bold text-slate-700 mb-4 text-center">{t[lang].interactionChart}</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={results.xBarData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="part" tick={{ fill: '#475569', fontSize: 12 }} />
                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 12 }} />
                            <Tooltip contentStyle={{ borderRadius: '0.5rem' }} />
                            <Legend />
                            {results.ops.map((op: string, i: number) => (
                              <Line 
                                key={op} 
                                type="linear" 
                                dataKey={op} 
                                stroke={chartColors[i % chartColors.length]} 
                                strokeWidth={1.5} 
                                dot={{ r: 5, strokeWidth: 1.5, fill: '#fff' }} 
                                activeDot={{ r: 7 }} 
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </section>

                <section ref={section5Ref} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800 mb-6">{t[lang].step5}</h2>
                  {esPremium ? (
                    <>
                      {problemDesc && (
                        <div className="mb-6 p-4 bg-slate-50 border-l-4 border-indigo-500 rounded-r-xl text-slate-700 italic">
                          "{t[lang].problemContext} {problemDesc}"
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div
                          className={`p-5 rounded-xl border ${
                            (results.hasTolerance ? results.pctTolGage : results.pctStudyGage) < 10
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : (results.hasTolerance ? results.pctTolGage : results.pctStudyGage) <= 30
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-red-50 border-red-200 text-red-900'
                          }`}
                        >
                          <h3 className="font-bold mb-2 flex items-center gap-2">
                            {(results.hasTolerance ? results.pctTolGage : results.pctStudyGage) < 10 ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (results.hasTolerance ? results.pctTolGage : results.pctStudyGage) <= 30 ? (
                              <AlertCircle className="w-5 h-5 text-amber-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                            {t[lang].sysDiag}
                          </h3>
                          <p className="text-sm">
                            {results.hasTolerance
                              ? results.pctTolGage < 10
                                ? `${t[lang].sysExcellentTol} ${results.pctTolGage.toFixed(2)}% ${t[lang].tolSuffixExcellent}`
                                : results.pctTolGage <= 30
                                  ? `${t[lang].sysAcceptableTol} ${results.pctTolGage.toFixed(2)}% ${t[lang].tolSuffixAcceptable}`
                                  : `${t[lang].sysUnacceptableTol} ${results.pctTolGage.toFixed(2)}% ${t[lang].tolSuffixUnacceptable}`
                              : results.pctStudyGage < 10
                                ? `${t[lang].sysExcellentStudy} ${results.pctStudyGage.toFixed(2)}% ${t[lang].studySuffixExcellent}`
                                : results.pctStudyGage <= 30
                                  ? `${t[lang].sysAcceptableStudy} ${results.pctStudyGage.toFixed(2)}% ${t[lang].studySuffixAcceptable}`
                                  : `${t[lang].sysUnacceptableStudy} ${results.pctStudyGage.toFixed(2)}% ${t[lang].studySuffixUnacceptable}`}
                          </p>
                        </div>

                        <div
                          className={`p-5 rounded-xl border ${
                            results.ndc >= 5
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-red-50 border-red-200 text-red-900'
                          }`}
                        >
                          <h3 className="font-bold mb-2 flex items-center gap-2">
                            {results.ndc >= 5 ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                            {t[lang].resDiag}
                          </h3>
                          <p className="text-sm">
                            {results.ndc >= 5
                              ? `${t[lang].resAdequate} ${results.ndc} ${t[lang].resAdequateSuffix}`
                              : `${t[lang].resInadequate} ${results.ndc} ${t[lang].resInadequateSuffix}`}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-6">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <Users className="w-5 h-5 text-indigo-500" />
                          {t[lang].mainErrorSource}
                        </h3>

                        {results.pctStudyRepeat > results.pctStudyReprod ? (
                          <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                              <strong className="text-slate-800">{t[lang].repeatBad}</strong> {t[lang].repeatBadDesc}
                            </p>
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900">
                              <strong>{t[lang].repeatNext}</strong>
                            </div>
                          </div>
                        ) : results.pctStudyReprod > results.pctStudyRepeat ? (
                          <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                              <strong className="text-slate-800">{t[lang].reprodBad}</strong> {t[lang].reprodBadDesc}
                            </p>
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900">
                              <strong>{t[lang].reprodNext}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                              <strong className="text-slate-800">{t[lang].similarBad}</strong>
                            </p>
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900">
                              <strong>{t[lang].similarNext}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <PremiumUnlockCard
                      lang={lang}
                      isCheckoutLoading={isCheckoutLoading}
                      checkoutError={checkoutError}
                      onUnlockPremium={onUnlockPremium}
                    />
                  )}
                </section>
              </div>
            )}
          </div>
        )}
    </SidebarLayout>
  );
}
