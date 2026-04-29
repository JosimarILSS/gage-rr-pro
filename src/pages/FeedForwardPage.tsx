import { useMemo, useRef, useState } from 'react';
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
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ReactMarkdown from 'react-markdown';
import SidebarLayout from '../layouts/SidebarLayout';
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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

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

  const downloadPDF = async () => {
    if (!feedbackRef.current) return;

    let captureNode: HTMLElement | null = null;

    try {
      captureNode = feedbackRef.current.cloneNode(true) as HTMLElement;
      captureNode.style.position = 'absolute';
      captureNode.style.left = '-9999px';
      captureNode.style.top = '0';
      captureNode.style.width = '800px';
      captureNode.style.backgroundColor = '#ffffff';
      captureNode.style.padding = '40px';
      captureNode.className = '';

      const allElements = captureNode.querySelectorAll('*');
      allElements.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        const tag = node.tagName.toLowerCase();
        node.className = '';
        if (tag === 'h1') {
          node.style.cssText =
            'font-size: 24px; font-weight: bold; margin: 0 0 20px; color: #0f172a; font-family: sans-serif;';
        } else if (tag === 'h2') {
          node.style.cssText =
            'font-size: 20px; font-weight: bold; margin: 24px 0 12px; color: #0f172a; font-family: sans-serif;';
        } else if (tag === 'h3') {
          node.style.cssText =
            'font-size: 18px; font-weight: bold; margin: 20px 0 10px; color: #0f172a; font-family: sans-serif;';
        } else if (tag === 'p') {
          node.style.cssText =
            'font-size: 14px; line-height: 1.6; margin: 0 0 12px; color: #334155; font-family: sans-serif;';
        } else if (tag === 'strong' || tag === 'b') {
          node.style.cssText = 'font-weight: normal; color: #0f172a;';
        } else if (tag === 'ul' || tag === 'ol') {
          node.style.cssText = 'margin: 0 0 12px; padding-left: 24px; font-family: sans-serif;';
        } else if (tag === 'li') {
          node.style.cssText =
            'font-size: 14px; line-height: 1.5; margin-bottom: 6px; color: #334155; font-family: sans-serif;';
        } else if (tag === 'hr') {
          node.style.display = 'none';
        }
      });

      document.body.appendChild(captureNode);

      const canvas = await html2canvas(captureNode, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(captureNode);
      captureNode = null;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`FeedFoward_${personName.trim().replace(/\s+/g, '_') || 'Plan'}.pdf`);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message ? `${copy.pdfError} ${message}` : copy.pdfError);
    } finally {
      if (captureNode?.parentNode) {
        captureNode.parentNode.removeChild(captureNode);
      }
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
                  onClick={downloadPDF}
                  className="app-button app-button-secondary px-4 py-2.5 text-sm"
                >
                  <FileDown className="w-4 h-4" />
                  {copy.download}
                </button>
              </div>

              <div ref={feedbackRef} className="bg-white p-6 md:p-10">
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
    </SidebarLayout>
  );
}
