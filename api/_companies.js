'use strict';

const COMPANIES_COLLECTION = 'empresas';
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 120;
const MAX_LOGO_URL_LENGTH = 500;

const DEFAULT_COMPANY_COLORS = {
  primaryColor: '#2476ff',
  headerColor: '#0e1628',
  logoBackgroundColor: '#ffffff',
};

const normalizeText = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const normalizeOptionalText = (value, maxLength) => {
  const text = normalizeText(value);
  if (!text) return null;
  return text.slice(0, maxLength);
};

const normalizeHexColor = (value, fallback) => {
  const text = normalizeText(value);
  return HEX_COLOR_PATTERN.test(text) ? text : fallback;
};

const normalizeCompanyIdInput = (value) => {
  if (value === null || value === undefined) return null;
  const text = normalizeText(value);
  if (!text || text === 'default') return null;
  return text;
};

const isValidLogoUrl = (value) => {
  if (!value) return true;
  if (value.length > MAX_LOGO_URL_LENGTH) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const buildCompanyPayload = (body) => {
  const name = normalizeText(body?.name);
  const logoUrl = normalizeOptionalText(body?.logoUrl, MAX_LOGO_URL_LENGTH);
  const logoAlt = normalizeOptionalText(body?.logoAlt, MAX_NAME_LENGTH) || name || null;

  if (!name || name.length > MAX_NAME_LENGTH) {
    return { error: `name is required and must be ${MAX_NAME_LENGTH} characters or less.` };
  }

  if (!isValidLogoUrl(logoUrl)) {
    return { error: 'logoUrl must be an http(s) URL.' };
  }

  return {
    payload: {
      name,
      nameLower: name.toLowerCase(),
      logoUrl,
      logoAlt,
      primaryColor: normalizeHexColor(body?.primaryColor, DEFAULT_COMPANY_COLORS.primaryColor),
      headerColor: normalizeHexColor(body?.headerColor, DEFAULT_COMPANY_COLORS.headerColor),
      logoBackgroundColor: normalizeHexColor(
        body?.logoBackgroundColor,
        DEFAULT_COMPANY_COLORS.logoBackgroundColor
      ),
      isActive: body?.isActive === false ? false : true,
    },
  };
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const mapCompanyDoc = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    name: data.name || '',
    logoUrl: data.logoUrl || null,
    logoAlt: data.logoAlt || null,
    primaryColor: data.primaryColor || DEFAULT_COMPANY_COLORS.primaryColor,
    headerColor: data.headerColor || DEFAULT_COMPANY_COLORS.headerColor,
    logoBackgroundColor: data.logoBackgroundColor || DEFAULT_COMPANY_COLORS.logoBackgroundColor,
    isActive: data.isActive !== false,
    createdAt: toIsoOrNull(data.createdAt),
    updatedAt: toIsoOrNull(data.updatedAt),
  };
};

module.exports = {
  COMPANIES_COLLECTION,
  DEFAULT_COMPANY_COLORS,
  buildCompanyPayload,
  mapCompanyDoc,
  normalizeCompanyIdInput,
};
