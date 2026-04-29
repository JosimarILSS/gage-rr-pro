'use strict';

const { verifyFirebaseToken } = require('../_firebase.js');

const MAX_NAME_LENGTH = 120;
const MAX_DIRECTIVES_LENGTH = 4000;
const MAX_FIELD_LENGTH = 2500;

const METHODOLOGY_FIELDS = {
  FODA: [
    { id: 'fortalezas', label: 'Fortalezas' },
    { id: 'oportunidades', label: 'Oportunidades' },
    { id: 'debilidades', label: 'Debilidades' },
    { id: 'amenazas', label: 'Amenazas' },
  ],
  SBI: [
    { id: 'situacion', label: 'Situación' },
    { id: 'comportamiento', label: 'Comportamiento' },
    { id: 'impacto', label: 'Impacto' },
  ],
  STAR: [
    { id: 'situacion', label: 'Situación' },
    { id: 'tarea', label: 'Tarea' },
    { id: 'accion', label: 'Acción' },
    { id: 'resultado', label: 'Resultado' },
  ],
};

const PERSONALITIES = new Set([
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
]);

const GENERATION_INFO = {
  boomers:
    'Baby Boomers (Inmigrantes Digitales). Valores clave: Estabilidad laboral, lealtad a la empresa y respeto absoluto a la autoridad. Comunicación: Prefieren interacción presencial, uso de teléfono o medios físicos. El feedback debe ser formal y estructurado, reconociendo su trayectoria y compromiso de largo plazo.',
  genx:
    'Generación X (Inmigrantes Digitales / Adaptables). Valores clave: Independientes y adaptables. Valoran enormemente el equilibrio entre el trabajo y la vida personal. Comunicación: Mantienen preferencia por lo presencial y la interacción directa. El feedback debe ser directo y eficiente, respetando su autonomía y enfocándose en cómo los resultados permiten mantener su equilibrio de vida.',
  millennials:
    'Millennials (Nativos Digitales). Valores clave: Son tecnológicamente competentes, valoran la diversidad y buscan propósito en lo que hacen, priorizando el equilibrio vida-trabajo. Comunicación: Totalmente cómodos con herramientas digitales y mensajería en línea. La retroalimentación debe estar vinculada al "por qué" (propósito) y puede entregarse a través de canales digitales ágiles.',
  centennials:
    'Centennials / Generación Z (Nativos Digitales Puros). Valores clave: Buscan la autenticidad por encima de todo. Profundamente preocupados por problemas sociales y medioambientales. Comunicación: Prefieren el uso de aplicaciones interactivas, motores de búsqueda y respuestas instantáneas; confían en la transparencia. El feedback debe ser muy auténtico, transparente y preferiblemente visual o gamificado, alineado con sus valores de impacto social.',
};

const normalizeString = (value, maxLength) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });

const getBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);

  const raw = await readRawBody(req);
  return raw ? JSON.parse(raw) : {};
};

const getErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error.message === 'string') return error.message;
  if (typeof error.toString === 'function') return error.toString();
  return '';
};

const getGeminiClientError = (error) => {
  const message = getErrorMessage(error).toLowerCase();
  const status = Number(error?.status || error?.code || error?.response?.status);

  if (status === 400 || message.includes('api key not valid')) {
    return 'La API key de Gemini no es válida o no corresponde al proyecto configurado.';
  }

  if (
    status === 403 ||
    status === 404 ||
    message.includes('not found') ||
    message.includes('not supported') ||
    message.includes('permission') ||
    message.includes('access')
  ) {
    return 'El modelo de Gemini configurado no está disponible para esta API key. Revisa GEMINI_MODEL o habilita billing en Google AI Studio.';
  }

  if (status === 429 || message.includes('quota') || message.includes('resource_exhausted')) {
    return 'Se alcanzó el límite de cuota de Gemini para este modelo o proyecto.';
  }

  return 'No se pudo generar la sesión con Gemini. Revisa los logs de Vercel para ver el detalle.';
};

const buildPrompt = ({
  lang,
  personName,
  methodology,
  personality,
  generationContext,
  companyDirectives,
  textFeedbackContent,
}) => {
  const outputLanguage = lang === 'en' ? 'English' : 'español';
  const companyInstruction = companyDirectives
    ? `5. Conecta de forma clara el feedback con los valores, misión o directrices de la empresa: ${companyDirectives}.`
    : '5. Si no hay directrices de empresa, no inventes valores corporativos; mantén el feedback centrado en desempeño, claridad y seguimiento.';

  return `
Eres un experto en liderazgo, recursos humanos y psicología organizacional.
Tu tarea es tomar el feedback estructurado proporcionado y transformarlo en una sesión de retroalimentación altamente efectiva, constructiva y estructurada para una persona llamada ${personName}.

Idioma de salida: ${outputLanguage}.
Metodología a utilizar: ${methodology}
Tipo de personalidad del receptor (MBTI): ${personality}
Generación y características: ${generationContext}

${companyDirectives ? `Directrices, misión y valores de la empresa de la que forman parte:\n${companyDirectives}\n` : ''}

Feedback estructurado a transmitir:
${textFeedbackContent}

Instrucciones:
1. Analiza el feedback proporcionado y extrae los puntos clave a tratar con ${personName}.
2. Estructura el feedback utilizando estrictamente la metodología ${methodology}.
3. Adapta el tono, el lenguaje y el enfoque para el tipo de personalidad ${personality}; considera sus fortalezas, debilidades comunicativas y si requiere un enfoque más lógico, emocional o directo.
4. Haz ajustes específicos para comunicar el mensaje considerando la generación seleccionada: si es nativo digital o inmigrante digital, el canal recomendado para la entrega y su motivación clave.
${companyInstruction}
6. Proporciona consejos específicos y prácticos para el líder sobre cómo tener esta conversación de forma exitosa.
7. Construye un "Plan de Trabajo de Seguimiento" claro y accionable con siguientes pasos para ${personName}.
8. Importante de formato: no uses negritas ni cursivas en el texto general. Reserva las negritas estrictamente para títulos y subtítulos que usan encabezados Markdown. No incluyas separadores horizontales o líneas. Escribe con tono fluido y profesional.

Formato de salida esperado:
# Preparación para la Sesión con ${personName}
[Consejos para el líder basados en la generación y personalidad de la persona]

# FeedFoward Estructurado (${methodology})
[El mensaje u hoja de ruta organizada según la metodología, lista para compartirse]

# Plan de Trabajo y Seguimiento
[Puntos de acción claros, medibles y con plazos sugeridos]
`;
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Gemini is not configured.' });
    return;
  }

  try {
    const body = await getBody(req);
    const lang = body.lang === 'en' ? 'en' : 'es';
    const personName = normalizeString(body.personName, MAX_NAME_LENGTH);
    const methodology = normalizeString(body.methodology, 20);
    const personality = normalizeString(body.personality, 10);
    const generation = normalizeString(body.generation, 30);
    const companyDirectives = normalizeString(body.companyDirectives, MAX_DIRECTIVES_LENGTH);
    const textInputs = body.textInputs && typeof body.textInputs === 'object' ? body.textInputs : {};

    const fields = METHODOLOGY_FIELDS[methodology];
    if (!personName) {
      res.status(400).json({ error: 'Person name is required.' });
      return;
    }

    if (!fields) {
      res.status(400).json({ error: 'Invalid methodology.' });
      return;
    }

    if (!PERSONALITIES.has(personality)) {
      res.status(400).json({ error: 'Invalid personality.' });
      return;
    }

    const generationContext = GENERATION_INFO[generation];
    if (!generationContext) {
      res.status(400).json({ error: 'Invalid generation.' });
      return;
    }

    const normalizedInputs = fields.map((field) => ({
      ...field,
      value: normalizeString(textInputs[field.id], MAX_FIELD_LENGTH),
    }));
    const hasText = normalizedInputs.some((field) => field.value.length > 0);
    if (!hasText) {
      res.status(400).json({ error: 'At least one feedback field is required.' });
      return;
    }

    const textFeedbackContent = normalizedInputs
      .map((field) => `${field.label}: ${field.value || 'No especificado'}`)
      .join('\n');

    const prompt = buildPrompt({
      lang,
      personName,
      methodology,
      personality,
      generationContext,
      companyDirectives,
      textFeedbackContent,
    });

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    const feedback = typeof response.text === 'function' ? response.text() : response.text;

    if (!feedback) {
      res.status(502).json({ error: 'Gemini returned an empty response.' });
      return;
    }

    res.status(200).json({ feedback });
  } catch (error) {
    console.error('[feed-forward] Generation failed:', error);
    res.status(500).json({ error: getGeminiClientError(error) });
  }
};
