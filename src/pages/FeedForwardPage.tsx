import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Globe,
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import jsPDF from 'jspdf';
import ReactMarkdown from 'react-markdown';
import SidebarLayout from '../layouts/SidebarLayout';
import Modal from '../components/common/Modal';
import { generateFeedForwardSession } from '../services/feed-forward';
import type { Lang } from '../types/common';

type FeedForwardPageProps = {
  lang: Lang;
  onToggleLang: () => void;
  onBackToTools: () => void;
  getIdToken: () => Promise<string>;
};

type MethodologyId = 'FODA' | 'SBI' | 'STAR';

type FieldConfig = {
  id: string;
  label: string;
  placeholder: string;
};

const METHODOLOGIES: { id: MethodologyId; name: string }[] = [
  { id: 'FODA', name: 'FODA (Fortalezas, Oportunidades, Debilidades, Amenazas)' },
  { id: 'SBI', name: 'SBI (Situación, Comportamiento, Impacto)' },
  { id: 'STAR', name: 'STAR (Situación, Tarea, Acción, Resultado)' },
];

const METHODOLOGY_FIELDS: Record<MethodologyId, FieldConfig[]> = {
  FODA: [
    { id: 'fortalezas', label: 'Fortalezas', placeholder: '¿Cuáles son los puntos fuertes?' },
    { id: 'oportunidades', label: 'Oportunidades', placeholder: '¿Qué áreas de mejora o crecimiento existen?' },
    { id: 'debilidades', label: 'Debilidades', placeholder: '¿Cuáles son los puntos débiles a trabajar?' },
    {
      id: 'amenazas',
      label: 'Amenazas',
      placeholder: '¿Qué factores externos o internos ponen en riesgo el desempeño?',
    },
  ],
  SBI: [
    { id: 'situacion', label: 'Situación', placeholder: 'Describe el contexto o situación específica...' },
    { id: 'comportamiento', label: 'Comportamiento', placeholder: 'Describe el comportamiento observable...' },
    { id: 'impacto', label: 'Impacto', placeholder: 'Describe el impacto de ese comportamiento...' },
  ],
  STAR: [
    { id: 'situacion', label: 'Situación', placeholder: 'Describe la situación o contexto...' },
    { id: 'tarea', label: 'Tarea', placeholder: '¿Cuál era la tarea o desafío?' },
    { id: 'accion', label: 'Acción', placeholder: '¿Qué acciones se tomaron?' },
    { id: 'resultado', label: 'Resultado', placeholder: '¿Cuáles fueron los resultados obtenidos?' },
  ],
};

const PERSONALITIES = [
  { id: 'INTJ', name: 'INTJ - Arquitecto', group: 'Analistas' },
  { id: 'INTP', name: 'INTP - Lógico', group: 'Analistas' },
  { id: 'ENTJ', name: 'ENTJ - Comandante', group: 'Analistas' },
  { id: 'ENTP', name: 'ENTP - Innovador', group: 'Analistas' },
  { id: 'INFJ', name: 'INFJ - Abogado', group: 'Diplomáticos' },
  { id: 'INFP', name: 'INFP - Mediador', group: 'Diplomáticos' },
  { id: 'ENFJ', name: 'ENFJ - Protagonista', group: 'Diplomáticos' },
  { id: 'ENFP', name: 'ENFP - Activista', group: 'Diplomáticos' },
  { id: 'ISTJ', name: 'ISTJ - Logista', group: 'Centinelas' },
  { id: 'ISFJ', name: 'ISFJ - Defensor', group: 'Centinelas' },
  { id: 'ESTJ', name: 'ESTJ - Ejecutivo', group: 'Centinelas' },
  { id: 'ESFJ', name: 'ESFJ - Cónsul', group: 'Centinelas' },
  { id: 'ISTP', name: 'ISTP - Virtuoso', group: 'Exploradores' },
  { id: 'ISFP', name: 'ISFP - Aventurero', group: 'Exploradores' },
  { id: 'ESTP', name: 'ESTP - Emprendedor', group: 'Exploradores' },
  { id: 'ESFP', name: 'ESFP - Animador', group: 'Exploradores' },
];

const GENERATIONS = [
  { id: 'boomers', name: 'Baby Boomers (1946 - 1964)' },
  { id: 'genx', name: 'Generación X (1965 - 1980)' },
  { id: 'millennials', name: 'Millennials (1981 - 1996)' },
  { id: 'centennials', name: 'Centennials / Gen Z (1997 - 2012)' },
];

const GENERATION_SUMMARY: Record<string, string> = {
  boomers: 'Formal, estructurado y con reconocimiento a la trayectoria.',
  genx: 'Directo, eficiente y respetuoso de la autonomía.',
  millennials: 'Ágil, digital y conectado con propósito.',
  centennials: 'Transparente, auténtico y orientado a impacto.',
};

const groupedPersonalities = PERSONALITIES.reduce<Record<string, typeof PERSONALITIES>>((acc, personality) => {
  acc[personality.group] = [...(acc[personality.group] || []), personality];
  return acc;
}, {});

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : '');

type PdfMarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

type PdfRenderState = {
  pdf: jsPDF;
  marginX: number;
  marginY: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  bottomY: number;
  y: number;
};

const stripMarkdown = (value: string) =>
  value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .trim();

const parseMarkdownBlocks = (markdown: string): PdfMarkdownBlock[] => {
  const blocks: PdfMarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ kind: 'paragraph', text: stripMarkdown(paragraphLines.join(' ')) });
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ kind: 'list', ordered: listOrdered, items: listItems.map(stripMarkdown).filter(Boolean) });
    listItems = [];
  };

  markdown.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length,
        text: stripMarkdown(headingMatch[2]),
      });
      return;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listItems.length && listOrdered) flushList();
      listOrdered = false;
      listItems.push(bulletMatch[1]);
      return;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listItems.length && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(orderedMatch[1]);
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();
  return blocks.filter((block) => block.kind !== 'paragraph' || block.text);
};

const createPdfRenderState = (pdf: jsPDF): PdfRenderState => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 18;
  const marginY = 18;

  return {
    pdf,
    marginX,
    marginY,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - marginX * 2,
    bottomY: pageHeight - marginY,
    y: marginY,
  };
};

const addPdfPage = (state: PdfRenderState) => {
  state.pdf.addPage();
  state.y = state.marginY;
};

const ensurePdfSpace = (state: PdfRenderState, requiredHeight: number) => {
  if (state.y + requiredHeight <= state.bottomY) return;
  addPdfPage(state);
};

const splitPdfText = (state: PdfRenderState, value: string, width: number) =>
  state.pdf.splitTextToSize(stripMarkdown(value), width) as string[];

const drawPdfWrappedText = (
  state: PdfRenderState,
  text: string,
  options: {
    fontSize: number;
    fontStyle?: 'normal' | 'bold';
    lineHeight: number;
    color?: [number, number, number];
    x?: number;
    width?: number;
    after?: number;
  }
) => {
  const cleanText = stripMarkdown(text);
  if (!cleanText) return;

  const x = options.x ?? state.marginX;
  const width = options.width ?? state.contentWidth;
  const after = options.after ?? 0;
  const lines = splitPdfText(state, cleanText, width);
  const blockHeight = lines.length * options.lineHeight + after;
  const pageBodyHeight = state.bottomY - state.marginY;

  state.pdf.setFont('helvetica', options.fontStyle || 'normal');
  state.pdf.setFontSize(options.fontSize);
  state.pdf.setTextColor(...(options.color || [51, 65, 85]));

  if (blockHeight <= pageBodyHeight) {
    ensurePdfSpace(state, blockHeight);
  } else {
    ensurePdfSpace(state, options.lineHeight);
  }

  lines.forEach((line) => {
    ensurePdfSpace(state, options.lineHeight);
    state.pdf.text(line, x, state.y);
    state.y += options.lineHeight;
  });

  state.y += after;
};

const drawPdfHeading = (state: PdfRenderState, text: string, level = 1) => {
  const fontSize = level === 1 ? 18 : level === 2 ? 14 : 12;
  const lineHeight = level === 1 ? 8 : 6.5;
  const before = level === 1 ? 4 : 2;
  const after = level === 1 ? 6 : 4;

  if (state.y > state.marginY + 2) state.y += before;
  ensurePdfSpace(state, level === 1 ? 26 : 20);

  drawPdfWrappedText(state, text, {
    fontSize,
    fontStyle: 'bold',
    lineHeight,
    color: [15, 23, 42],
    after,
  });
};

const drawPdfLabelValue = (state: PdfRenderState, label: string, value: string) => {
  const cleanValue = value.trim() || 'No especificado';
  const valueLines = splitPdfText(state, cleanValue, state.contentWidth);
  const blockHeight = 4 + valueLines.length * 5.2 + 5;
  const pageBodyHeight = state.bottomY - state.marginY;

  ensurePdfSpace(state, blockHeight <= pageBodyHeight ? blockHeight : 12);

  state.pdf.setFont('helvetica', 'bold');
  state.pdf.setFontSize(8);
  state.pdf.setTextColor(100, 116, 139);
  state.pdf.text(label.toUpperCase(), state.marginX, state.y);
  state.y += 5;

  state.pdf.setFont('helvetica', 'normal');
  state.pdf.setFontSize(10.5);
  state.pdf.setTextColor(15, 23, 42);

  valueLines.forEach((line) => {
    ensurePdfSpace(state, 5.2);
    state.pdf.text(line, state.marginX, state.y);
    state.y += 5.2;
  });

  state.y += 5;
};

const drawPdfList = (state: PdfRenderState, items: string[], ordered: boolean) => {
  const markerWidth = 8;
  const textX = state.marginX + markerWidth;
  const textWidth = state.contentWidth - markerWidth;
  const lineHeight = 5.8;
  const pageBodyHeight = state.bottomY - state.marginY;

  state.pdf.setFont('helvetica', 'normal');
  state.pdf.setFontSize(11.5);
  state.pdf.setTextColor(51, 65, 85);

  items.forEach((item, index) => {
    const lines = splitPdfText(state, item, textWidth);
    const itemHeight = lines.length * lineHeight + 2;

    ensurePdfSpace(state, itemHeight <= pageBodyHeight ? itemHeight : lineHeight);

    lines.forEach((line, lineIndex) => {
      ensurePdfSpace(state, lineHeight);
      if (lineIndex === 0) {
        state.pdf.text(ordered ? `${index + 1}.` : '-', state.marginX, state.y);
      }
      state.pdf.text(line, textX, state.y);
      state.y += lineHeight;
    });

    state.y += 2;
  });

  state.y += 2;
};

const renderPdfMarkdown = (state: PdfRenderState, markdown: string) => {
  parseMarkdownBlocks(markdown).forEach((block) => {
    if (block.kind === 'heading') {
      drawPdfHeading(state, block.text, block.level);
      return;
    }

    if (block.kind === 'list') {
      drawPdfList(state, block.items, block.ordered);
      return;
    }

    drawPdfWrappedText(state, block.text, {
      fontSize: 11.5,
      lineHeight: 6,
      color: [51, 65, 85],
      after: 4,
    });
  });
};

const drawPdfDivider = (state: PdfRenderState) => {
  ensurePdfSpace(state, 12);
  state.pdf.setDrawColor(226, 232, 240);
  state.pdf.line(state.marginX, state.y, state.pageWidth - state.marginX, state.y);
  state.y += 10;
};

const addPdfPageNumbers = (state: PdfRenderState) => {
  const pageCount = state.pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    state.pdf.setPage(pageNumber);
    state.pdf.setFont('helvetica', 'normal');
    state.pdf.setFontSize(8);
    state.pdf.setTextColor(100, 116, 139);
    state.pdf.text(`${pageNumber}/${pageCount}`, state.pageWidth - state.marginX, state.pageHeight - 8, {
      align: 'right',
    });
  }
};

export default function FeedForwardPage({
  lang,
  onToggleLang,
  onBackToTools,
  getIdToken,
}: FeedForwardPageProps) {
  const [methodology, setMethodology] = useState<MethodologyId>('FODA');
  const [personality, setPersonality] = useState(PERSONALITIES[0].id);
  const [generation, setGeneration] = useState(GENERATIONS[2].id);
  const [personName, setPersonName] = useState('');
  const [companyDirectives, setCompanyDirectives] = useState('');
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:4242' : ''),
    []
  );

  const copy = {
    es: {
      title: 'ILSS FeedFoward',
      subtitle: 'Comunicación efectiva con tu equipo para diseñar el futuro',
      back: 'Volver a herramientas',
      language: 'EN',
      config: 'Configuración de la sesión',
      personName: 'Nombre del miembro',
      personPlaceholder: 'Ej. María Pérez',
      generation: 'Generación',
      personality: 'Personalidad (MBTI)',
      directives: 'Directrices de la empresa',
      directivesOptional: 'Opcional',
      directivesPlaceholder: 'Misión, visión, valores u objetivos estratégicos...',
      methodology: 'Metodología',
      details: 'Detalles de la situación',
      guidance: 'Guía de comunicación',
      generate: 'Generar sesión estructurada',
      generating: 'Generando FeedFoward...',
      result: 'Resultado de la sesión',
      download: 'Descargar PDF',
      downloadTitle: 'Descargar PDF',
      downloadIntro: 'Selecciona qué información quieres incluir en el documento.',
      downloadComplete: 'Datos ingresados y resultado generado',
      downloadCompleteDescription:
        'Incluye primero todos los datos capturados en vertical y después la sesión generada.',
      downloadGeneratedOnly: 'Solo resultado generado',
      downloadGeneratedOnlyDescription: 'Genera el PDF como hasta ahora, únicamente con la respuesta de la IA.',
      downloading: 'Generando PDF...',
      emptyTitle: 'Sin sesión generada',
      emptyBody: 'Completa el formulario y genera una hoja de ruta lista para conversar con el miembro del equipo.',
      nameError: 'Por favor, ingresa el nombre de la persona.',
      textError: 'Por favor, completa al menos un campo de feedback de la metodología.',
      generateError: 'Hubo un error al generar la sesión.',
      pdfError: 'Hubo un error al generar el PDF.',
    },
    en: {
      title: 'ILSS FeedFoward',
      subtitle: 'Effective team communication to design the future',
      back: 'Back to tools',
      language: 'ES',
      config: 'Session setup',
      personName: 'Team member name',
      personPlaceholder: 'E.g. Maria Perez',
      generation: 'Generation',
      personality: 'Personality (MBTI)',
      directives: 'Company directives',
      directivesOptional: 'Optional',
      directivesPlaceholder: 'Mission, vision, values, or strategic objectives...',
      methodology: 'Methodology',
      details: 'Situation details',
      guidance: 'Communication guide',
      generate: 'Generate structured session',
      generating: 'Generating FeedFoward...',
      result: 'Session result',
      download: 'Download PDF',
      downloadTitle: 'Download PDF',
      downloadIntro: 'Choose what information to include in the document.',
      downloadComplete: 'Entered data and generated result',
      downloadCompleteDescription: 'Includes all captured data vertically first, followed by the generated session.',
      downloadGeneratedOnly: 'Generated result only',
      downloadGeneratedOnlyDescription: 'Generates the PDF as before, only with the AI response.',
      downloading: 'Generating PDF...',
      emptyTitle: 'No session generated',
      emptyBody: 'Complete the form and generate a conversation-ready roadmap for the team member.',
      nameError: 'Please enter the person name.',
      textError: 'Please complete at least one methodology feedback field.',
      generateError: 'There was an error generating the session.',
      pdfError: 'There was an error generating the PDF.',
    },
  }[lang];

  const currentFields = METHODOLOGY_FIELDS[methodology];
  const hasFeedbackText = currentFields.some((field) => (textInputs[field.id] || '').trim().length > 0);
  const canGenerate = personName.trim().length > 0 && hasFeedbackText && !isGenerating;
  const selectedMethodology = METHODOLOGIES.find((item) => item.id === methodology)?.name || methodology;
  const selectedGeneration = GENERATIONS.find((item) => item.id === generation)?.name || generation;
  const selectedPersonality = PERSONALITIES.find((item) => item.id === personality)?.name || personality;

  const generateFeedback = async () => {
    if (!personName.trim()) {
      setError(copy.nameError);
      return;
    }

    if (!hasFeedbackText) {
      setError(copy.textError);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setFeedback(null);

    try {
      const idToken = await getIdToken();
      const response = await generateFeedForwardSession(apiBaseUrl, idToken, {
        lang,
        personName,
        methodology,
        personality,
        generation,
        companyDirectives,
        textInputs,
      });
      setFeedback(response.feedback);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message ? `${copy.generateError} ${message}` : copy.generateError);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async (includeInputData = false) => {
    if (!feedback) return;

    try {
      setIsDownloadingPdf(true);
      setIsPdfModalOpen(false);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pdfState = createPdfRenderState(pdf);

      if (includeInputData) {
        drawPdfHeading(pdfState, copy.config, 1);
        drawPdfLabelValue(pdfState, copy.personName, personName);
        drawPdfLabelValue(pdfState, copy.generation, selectedGeneration);
        drawPdfLabelValue(pdfState, copy.personality, selectedPersonality);
        drawPdfLabelValue(pdfState, `${copy.directives} (${copy.directivesOptional})`, companyDirectives);
        drawPdfLabelValue(pdfState, copy.methodology, selectedMethodology);
        drawPdfHeading(pdfState, copy.details, 2);
        currentFields.forEach((field) => {
          drawPdfLabelValue(pdfState, field.label, textInputs[field.id] || '');
        });
        drawPdfDivider(pdfState);
        drawPdfHeading(pdfState, copy.result, 1);
      }

      renderPdfMarkdown(pdfState, feedback);
      addPdfPageNumbers(pdfState);

      const fileSuffix = includeInputData ? 'Completo' : 'Resultado';
      pdf.save(`FeedFoward_${fileSuffix}_${personName.trim().replace(/\s+/g, '_') || 'Plan'}.pdf`);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message ? `${copy.pdfError} ${message}` : copy.pdfError);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const sidebar = (
    <>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onBackToTools}
          className="app-button app-button-secondary px-3 py-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {copy.back}
        </button>
        <button
          type="button"
          onClick={onToggleLang}
          className="app-button app-button-secondary px-3 py-2 text-sm"
        >
          <Globe className="w-4 h-4" />
          {copy.language}
        </button>
      </div>

      <div>
        <div className="app-icon-tile app-icon-tile-lg app-icon-tile-warning">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-2xl app-title">{copy.title}</h1>
        <p className="mt-2 text-sm app-muted leading-6">{copy.subtitle}</p>
      </div>

      <div className="space-y-5">
        <h2 className="text-sm app-title">{copy.config}</h2>

        <div>
          <label htmlFor="personName" className="app-label">
            {copy.personName}
          </label>
          <input
            type="text"
            id="personName"
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            placeholder={copy.personPlaceholder}
            className="app-input px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="generation" className="app-label">
            {copy.generation}
          </label>
          <select
            id="generation"
            value={generation}
            onChange={(event) => setGeneration(event.target.value)}
            className="app-input px-3 py-2.5 text-sm"
          >
            {GENERATIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="app-callout app-callout-warning text-sm leading-6">
          <p className="font-bold">{copy.guidance}</p>
          <p className="mt-1">{GENERATION_SUMMARY[generation]}</p>
        </div>

        <div>
          <label htmlFor="personality" className="app-label">
            {copy.personality}
          </label>
          <select
            id="personality"
            value={personality}
            onChange={(event) => setPersonality(event.target.value)}
            className="app-input px-3 py-2.5 text-sm"
          >
            {Object.entries(groupedPersonalities).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="companyDirectives" className="app-label">
            {copy.directives} ({copy.directivesOptional})
          </label>
          <textarea
            id="companyDirectives"
            rows={3}
            value={companyDirectives}
            onChange={(event) => setCompanyDirectives(event.target.value)}
            placeholder={copy.directivesPlaceholder}
            className="app-input px-3 py-2.5 text-sm resize-none"
          />
        </div>

        <div className="border-t app-divider pt-5 space-y-5">
          <div>
            <label htmlFor="methodology" className="app-label">
              {copy.methodology}
            </label>
            <select
              id="methodology"
              value={methodology}
              onChange={(event) => setMethodology(event.target.value as MethodologyId)}
              className="app-input px-3 py-2.5 text-sm"
            >
              {METHODOLOGIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="text-sm app-title">{copy.details}</h3>
            <div className="mt-4 space-y-4">
              {currentFields.map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="app-label">
                    {field.label}
                  </label>
                  <textarea
                    id={field.id}
                    rows={3}
                    value={textInputs[field.id] || ''}
                    onChange={(event) => setTextInputs((current) => ({ ...current, [field.id]: event.target.value }))}
                    placeholder={field.placeholder}
                    className="app-input px-3 py-2.5 text-sm resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="app-alert app-alert-danger flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={generateFeedback}
            disabled={!canGenerate}
            className="app-button app-button-primary w-full px-5 py-3 text-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {copy.generating}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {copy.generate}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <SidebarLayout
      sidebar={sidebar}
      sidebarClassName="md:w-[460px] lg:w-[520px]"
      mainClassName="bg-slate-50"
    >
      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="popLayout">
          {feedback ? (
            <motion.section
              key="feedback"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="app-panel overflow-hidden"
            >
              <div className="p-5 md:p-6 border-b app-divider flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg app-title flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 app-text-success" />
                  {copy.result}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(true)}
                  disabled={isDownloadingPdf}
                  className="app-button app-button-secondary px-4 py-2.5 text-sm"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {copy.downloading}
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      {copy.download}
                    </>
                  )}
                </button>
              </div>

              <div className="bg-white p-6 md:p-10">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-2xl app-title mt-8 first:mt-0 mb-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl app-title mt-7 mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg app-title mt-6 mb-2">{children}</h3>,
                    p: ({ children }) => <p className="text-sm md:text-base leading-7 app-muted mb-4">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2 app-muted">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2 app-muted">{children}</ol>,
                    li: ({ children }) => <li className="text-sm md:text-base leading-7">{children}</li>,
                    strong: ({ children }) => <strong className="font-normal app-title">{children}</strong>,
                    hr: () => null,
                  }}
                >
                  {feedback}
                </ReactMarkdown>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="app-status-bar min-h-[280px] flex items-center justify-center text-center"
            >
              <div className="max-w-md">
                <div className="app-icon-tile mx-auto">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h2 className="text-lg app-title mt-4">{copy.emptyTitle}</h2>
                <p className="text-sm app-muted mt-2 leading-6">{copy.emptyBody}</p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <Modal isOpen={isPdfModalOpen} title={copy.downloadTitle} onClose={() => setIsPdfModalOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm app-muted leading-6">{copy.downloadIntro}</p>

          <button
            type="button"
            onClick={() => downloadPDF(true)}
            disabled={isDownloadingPdf}
            className="w-full text-left app-card app-card-hover p-4 cursor-pointer"
          >
            <span className="flex items-start gap-3">
              <FileDown className="w-5 h-5 app-text-primary shrink-0 mt-0.5" />
              <span>
                <span className="block app-title text-sm">{copy.downloadComplete}</span>
                <span className="block text-sm app-muted mt-1 leading-6">{copy.downloadCompleteDescription}</span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => downloadPDF(false)}
            disabled={isDownloadingPdf}
            className="w-full text-left app-card app-card-hover p-4 cursor-pointer"
          >
            <span className="flex items-start gap-3">
              <FileDown className="w-5 h-5 app-text-primary shrink-0 mt-0.5" />
              <span>
                <span className="block app-title text-sm">{copy.downloadGeneratedOnly}</span>
                <span className="block text-sm app-muted mt-1 leading-6">
                  {copy.downloadGeneratedOnlyDescription}
                </span>
              </span>
            </span>
          </button>
        </div>
      </Modal>
    </SidebarLayout>
  );
}
