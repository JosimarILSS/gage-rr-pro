import { type ChangeEvent, useMemo, useState } from 'react';
import { calculateGageRR } from '../utils/anova';
import { parseUploadedFile } from '../services/file-parser';
import type { DataRow, Lang, ValidationResult } from '../types/common';

type UseGageRRWorkspaceResult = {
  problemDesc: string;
  setProblemDesc: (value: string) => void;
  data: DataRow[];
  columns: string[];
  partCol: string;
  setPartCol: (value: string) => void;
  opCol: string;
  setOpCol: (value: string) => void;
  measCol: string;
  setMeasCol: (value: string) => void;
  lie: string;
  setLie: (value: string) => void;
  lse: string;
  setLse: (value: string) => void;
  sigmaMultiplier: number;
  setSigmaMultiplier: (value: number) => void;
  includeInteraction: boolean;
  setIncludeInteraction: (value: boolean) => void;
  showResults: boolean;
  setShowResults: (value: boolean) => void;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  validation: ValidationResult | null;
  results: any | null;
};

export const useGageRRWorkspace = (lang: Lang): UseGageRRWorkspaceResult => {
  const [problemDesc, setProblemDesc] = useState('');
  const [data, setData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [partCol, setPartCol] = useState('');
  const [opCol, setOpCol] = useState('');
  const [measCol, setMeasCol] = useState('');
  const [lie, setLie] = useState('');
  const [lse, setLse] = useState('');
  const [sigmaMultiplier, setSigmaMultiplier] = useState(6);
  const [includeInteraction, setIncludeInteraction] = useState(true);
  const [showResults, setShowResults] = useState(false);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowResults(false);

    try {
      const parsed = await parseUploadedFile(file);
      setData(parsed.data);
      setColumns(parsed.columns);
      setPartCol(parsed.columns[0] || '');
      setOpCol(parsed.columns[1] || '');
      setMeasCol(parsed.columns[2] || '');
    } catch (error) {
      console.error('Error parsing uploaded file:', error);
    }
  };

  const validation = useMemo<ValidationResult | null>(() => {
    if (!data.length || !partCol || !opCol || !measCol) return null;

    if (new Set([partCol, opCol, measCol]).size < 3) {
      return {
        valid: false,
        errors: [
          lang === 'es'
            ? 'Por favor selecciona columnas distintas para Parte, Operador y Medición.'
            : 'Please select distinct columns for Part, Operator, and Measurement.',
        ],
      };
    }

    const errors: string[] = [];
    const isNumeric = data.every((row) => typeof row[measCol] === 'number' || !isNaN(Number(row[measCol])));
    if (!isNumeric) {
      errors.push(
        lang === 'es'
          ? 'La variable de medición debe ser numérica continua.'
          : 'The measurement variable must be continuous numeric.'
      );
    }

    const parts = new Set(data.map((row) => row[partCol]));
    const ops = new Set(data.map((row) => row[opCol]));

    if (ops.size < 2) {
      errors.push(
        lang === 'es'
          ? `Se requieren al menos 2 operadores. Se encontraron ${ops.size}.`
          : `At least 2 operators are required. Found ${ops.size}.`
      );
    }

    if (parts.size < 5) {
      errors.push(
        lang === 'es'
          ? `Se requieren al menos 5 partes. Se encontraron ${parts.size}.`
          : `At least 5 parts are required. Found ${parts.size}.`
      );
    }

    const counts: Record<string, number> = {};
    data.forEach((row) => {
      const key = `${row[partCol]}|${row[opCol]}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    const minReplicates = Math.min(...Object.values(counts));
    if (minReplicates < 2) {
      errors.push(
        lang === 'es'
          ? `Se requieren al menos 2 repeticiones por combinación Parte-Operador. Se encontraron ${minReplicates}.`
          : `At least 2 replicates per Part-Operator combination are required. Found ${minReplicates}.`
      );
    }

    const partMeans: Record<string, { sum: number; count: number }> = {};
    data.forEach((row) => {
      const part = String(row[partCol]);
      const measurement = Number(row[measCol]);
      if (!isNaN(measurement)) {
        if (!partMeans[part]) partMeans[part] = { sum: 0, count: 0 };
        partMeans[part].sum += measurement;
        partMeans[part].count += 1;
      }
    });

    const means = Object.values(partMeans).map((part) => part.sum / part.count);
    const overallMean = means.reduce((acc, value) => acc + value, 0) / means.length;
    const variance = means.reduce((acc, value) => acc + Math.pow(value - overallMean, 2), 0) / (means.length - 1);

    if (isNaN(variance) || variance <= 0) {
      errors.push(
        lang === 'es'
          ? 'La varianza entre las partes debe ser mayor a cero para poder discriminar.'
          : 'The variance between parts must be greater than zero to be able to discriminate.'
      );
    }

    return { valid: errors.length === 0, errors };
  }, [data, lang, measCol, opCol, partCol]);

  const results = useMemo<any | null>(() => {
    if (!showResults || !validation?.valid) return null;
    try {
      const lsl = lie !== '' ? Number(lie) : undefined;
      const usl = lse !== '' ? Number(lse) : undefined;
      return calculateGageRR(
        data as any[],
        partCol,
        opCol,
        measCol,
        lsl,
        usl,
        sigmaMultiplier,
        includeInteraction
      );
    } catch (error) {
      console.error(error);
      return null;
    }
  }, [data, includeInteraction, lie, lse, measCol, opCol, partCol, showResults, sigmaMultiplier, validation]);

  return {
    problemDesc,
    setProblemDesc,
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
    validation,
    results,
  };
};

export type { UseGageRRWorkspaceResult };
