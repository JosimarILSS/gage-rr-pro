import Papa, { ParseResult } from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';
import type { DataRow } from '../types/common';

export type ParsedFileResult = {
  data: DataRow[];
  columns: string[];
};

const parseCsvFile = (file: File): Promise<ParsedFileResult> =>
  new Promise((resolve, reject) => {
    Papa.parse<DataRow>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<DataRow>) => {
        const parsedData = results.data || [];
        const columns = results.meta.fields ?? (parsedData[0] ? Object.keys(parsedData[0]) : []);
        resolve({ data: parsedData, columns });
      },
      error: (error: Error) => reject(error),
    });
  });

const parseXlsxFile = async (file: File): Promise<ParsedFileResult> => {
  const workbook = await readXlsxFile(file);
  const rows = workbook[0]?.data ?? [];

  if (!rows.length) return { data: [], columns: [] };

  const [headerRow, ...dataRows] = rows;
  const columns = headerRow.map((header, idx) => {
    const normalized = String(header ?? '').trim();
    return normalized !== '' ? normalized : `col_${idx + 1}`;
  });

  const data = dataRows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ''))
    .map((row) => {
      const rowObj: DataRow = {};
      columns.forEach((col, idx) => {
        rowObj[col] = row[idx];
      });
      return rowObj;
    });

  return { data, columns };
};

export const parseUploadedFile = async (file: File): Promise<ParsedFileResult> => {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.csv')) return parseCsvFile(file);
  if (fileName.endsWith('.xlsx')) return parseXlsxFile(file);

  throw new Error('Unsupported file format.');
};
