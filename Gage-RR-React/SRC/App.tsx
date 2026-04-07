import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { calculateGageRR } from './utils/anova';
import { Upload, AlertCircle, CheckCircle2, BarChart3, Settings, Users, Info, FileSpreadsheet, Globe, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LineChart, Line, ComposedChart, Scatter, ErrorBar } from 'recharts';
import { t } from './translations';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

const CrossedCircle = (props: any) => {
  const { cx, cy, stroke, fill } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} stroke={stroke || "#3b82f6"} fill={fill || "#fff"} strokeWidth={1.5} />
      <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke={stroke || "#3b82f6"} strokeWidth={1.5} />
      <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke={stroke || "#3b82f6"} strokeWidth={1.5} />
    </g>
  );
};

export default function App() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error logging in:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const [problemDesc, setProblemDesc] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  
  const [partCol, setPartCol] = useState<string>('');
  const [opCol, setOpCol] = useState<string>('');
  const [measCol, setMeasCol] = useState<string>('');
  
  const [lie, setLie] = useState<string>('');
  const [lse, setLse] = useState<string>('');
  const [sigmaMultiplier, setSigmaMultiplier] = useState<number>(6);
  const [includeInteraction, setIncludeInteraction] = useState<boolean>(true);
  
  const [showResults, setShowResults] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowResults(false);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          setData(results.data);
          if (results.meta.fields) {
            setColumns(results.meta.fields);
            setPartCol(results.meta.fields[0] || '');
            setOpCol(results.meta.fields[1] || '');
            setMeasCol(results.meta.fields[2] || '');
          }
        }
      });
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const parsedData = XLSX.utils.sheet_to_json(ws);
        setData(parsedData);
        if (parsedData.length > 0) {
          const cols = Object.keys(parsedData[0] as object);
          setColumns(cols);
          setPartCol(cols[0] || '');
          setOpCol(cols[1] || '');
          setMeasCol(cols[2] || '');
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const validation = useMemo(() => {
    if (!data.length || !partCol || !opCol || !measCol) return null;
    
    // Check if columns are distinct
    if (new Set([partCol, opCol, measCol]).size < 3) {
      return { valid: false, errors: [lang === 'es' ? "Por favor selecciona columnas distintas para Parte, Operador y Medición." : "Please select distinct columns for Part, Operator, and Measurement."] };
    }

    const errors: string[] = [];
    
    // a) Variable numérica continua
    const isNumeric = data.every(d => typeof d[measCol] === 'number' || !isNaN(Number(d[measCol])));
    if (!isNumeric) errors.push(lang === 'es' ? "La variable de medición debe ser numérica continua." : "The measurement variable must be continuous numeric.");

    // b) Conteos mínimos
    const parts = new Set(data.map(d => d[partCol]));
    const ops = new Set(data.map(d => d[opCol]));
    
    if (ops.size < 2) errors.push(lang === 'es' ? `Se requieren al menos 2 operadores. Se encontraron ${ops.size}.` : `At least 2 operators are required. Found ${ops.size}.`);
    if (parts.size < 5) errors.push(lang === 'es' ? `Se requieren al menos 5 partes. Se encontraron ${parts.size}.` : `At least 5 parts are required. Found ${parts.size}.`);
    
    // Replicates
    const counts: Record<string, number> = {};
    data.forEach(d => {
      const key = `${d[partCol]}|${d[opCol]}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const minReplicates = Math.min(...Object.values(counts));
    if (minReplicates < 2) errors.push(lang === 'es' ? `Se requieren al menos 2 repeticiones por combinación Parte-Operador. Se encontraron ${minReplicates}.` : `At least 2 replicates per Part-Operator combination are required. Found ${minReplicates}.`);

    // c) Varianza entre partes
    const partMeans: Record<string, {sum: number, count: number}> = {};
    data.forEach(d => {
      const p = String(d[partCol]);
      const m = Number(d[measCol]);
      if (!isNaN(m)) {
        if (!partMeans[p]) partMeans[p] = {sum: 0, count: 0};
        partMeans[p].sum += m;
        partMeans[p].count += 1;
      }
    });
    
    const means = Object.values(partMeans).map(p => p.sum / p.count);
    const overallMean = means.reduce((a, b) => a + b, 0) / means.length;
    const variance = means.reduce((a, b) => a + Math.pow(b - overallMean, 2), 0) / (means.length - 1);
    
    if (isNaN(variance) || variance <= 0) {
      errors.push(lang === 'es' ? "La varianza entre las partes debe ser mayor a cero para poder discriminar." : "The variance between parts must be greater than zero to be able to discriminate.");
    }

    return { valid: errors.length === 0, errors };
  }, [data, partCol, opCol, measCol]);

  const results = useMemo(() => {
    if (!showResults || !validation?.valid) return null;
    try {
      const lsl = lie !== '' ? Number(lie) : undefined;
      const usl = lse !== '' ? Number(lse) : undefined;
      return calculateGageRR(data, partCol, opCol, measCol, lsl, usl, sigmaMultiplier, includeInteraction);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [showResults, validation, data, partCol, opCol, measCol, lie, lse]);

  const chartColors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">{t[lang].landingTitle}</h1>
          <p className="text-slate-600">{t[lang].landingDesc}</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t[lang].loginGoogle}
          </button>
          <div className="pt-4">
            <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="text-sm text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-1 mx-auto">
              <Globe className="w-4 h-4" /> {lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 shadow-sm z-10 h-screen overflow-y-auto">
        <div>
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" />
              {t[lang].title}
            </h1>
            <button 
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors bg-slate-100 px-2 py-1 rounded-md"
            >
              <Globe className="w-3 h-3" />
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

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{t[lang].loadData}</h2>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-600"><span className="font-semibold">{t[lang].uploadPrompt}</span></p>
              <p className="text-xs text-slate-500">{t[lang].dragDrop}</p>
            </div>
            <input type="file" className="hidden" accept=".csv, .xlsx" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 truncate pr-2" title={user.email || ''}>
              {user.email}
            </div>
            <button onClick={handleLogout} className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 shrink-0 transition-colors">
              <LogOut className="w-4 h-4" />
              {t[lang].logout}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 overflow-auto">
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
                        {columns.map(col => <td key={col} className="px-4 py-2">{row[col]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].partCol}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={partCol} onChange={e => {setPartCol(e.target.value); setShowResults(false);}}>
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].opCol}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={opCol} onChange={e => {setOpCol(e.target.value); setShowResults(false);}}>
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].measCol}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={measCol} onChange={e => {setMeasCol(e.target.value); setShowResults(false);}}>
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
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={sigmaMultiplier} onChange={e => {setSigmaMultiplier(Number(e.target.value)); setShowResults(false);}}>
                    <option value={6}>{t[lang].mult6}</option>
                    <option value={5.15}>{t[lang].mult515}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t[lang].interaction}</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={includeInteraction ? 'true' : 'false'} onChange={e => {setIncludeInteraction(e.target.value === 'true'); setShowResults(false);}}>
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
                      onClick={() => setShowResults(true)}
                      className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
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
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
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
                            <Tooltip contentStyle={{ borderRadius: '0.5rem' }} />
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
                            <Tooltip contentStyle={{ borderRadius: '0.5rem' }} />
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

                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800 mb-6">{t[lang].step5}</h2>
                  {problemDesc && (
                    <div className="mb-6 p-4 bg-slate-50 border-l-4 border-indigo-500 rounded-r-xl text-slate-700 italic">
                      "{t[lang].problemContext} {problemDesc}"
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Diagnóstico % Variación */}
                    <div className={`p-5 rounded-xl border ${
                      (results.hasTolerance ? results.pctTolGage : results.pctStudyGage) < 10 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                      (results.hasTolerance ? results.pctTolGage : results.pctStudyGage) <= 30 ? 'bg-amber-50 border-amber-200 text-amber-900' :
                      'bg-red-50 border-red-200 text-red-900'
                    }`}>
                      <h3 className="font-bold mb-2 flex items-center gap-2">
                        {(results.hasTolerance ? results.pctTolGage : results.pctStudyGage) < 10 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                         (results.hasTolerance ? results.pctTolGage : results.pctStudyGage) <= 30 ? <AlertCircle className="w-5 h-5 text-amber-600" /> :
                         <AlertCircle className="w-5 h-5 text-red-600" />}
                        {t[lang].sysDiag}
                      </h3>
                      <p className="text-sm">
                        {results.hasTolerance ? (
                          results.pctTolGage < 10 ? `${t[lang].sysExcellentTol} ${results.pctTolGage.toFixed(2)}% ${t[lang].tolSuffixExcellent}` :
                          results.pctTolGage <= 30 ? `${t[lang].sysAcceptableTol} ${results.pctTolGage.toFixed(2)}% ${t[lang].tolSuffixAcceptable}` :
                          `${t[lang].sysUnacceptableTol} ${results.pctTolGage.toFixed(2)}% ${t[lang].tolSuffixUnacceptable}`
                        ) : (
                          results.pctStudyGage < 10 ? `${t[lang].sysExcellentStudy} ${results.pctStudyGage.toFixed(2)}% ${t[lang].studySuffixExcellent}` :
                          results.pctStudyGage <= 30 ? `${t[lang].sysAcceptableStudy} ${results.pctStudyGage.toFixed(2)}% ${t[lang].studySuffixAcceptable}` :
                          `${t[lang].sysUnacceptableStudy} ${results.pctStudyGage.toFixed(2)}% ${t[lang].studySuffixUnacceptable}`
                        )}
                      </p>
                    </div>

                    {/* Diagnóstico ndc */}
                    <div className={`p-5 rounded-xl border ${
                      results.ndc >= 5 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                      'bg-red-50 border-red-200 text-red-900'
                    }`}>
                      <h3 className="font-bold mb-2 flex items-center gap-2">
                        {results.ndc >= 5 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                         <AlertCircle className="w-5 h-5 text-red-600" />}
                        {t[lang].resDiag}
                      </h3>
                      <p className="text-sm">
                        {results.ndc >= 5 ? `${t[lang].resAdequate} ${results.ndc} ${t[lang].resAdequateSuffix}` :
                         `${t[lang].resInadequate} ${results.ndc} ${t[lang].resInadequateSuffix}`}
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
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
