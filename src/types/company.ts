export type CompanyBrand = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoAlt: string | null;
  primaryColor: string;
  headerColor: string;
  logoBackgroundColor: string;
};

export const DEFAULT_COMPANY_COLORS = {
  primaryColor: '#2476ff',
  headerColor: '#0e1628',
  logoBackgroundColor: 'transparent',
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeColor = (value: unknown, fallback: string) =>
  fallback === 'transparent' && typeof value === 'string' && value.trim().toLowerCase() === 'transparent'
    ? 'transparent'
    : isHexColor(value)
      ? value.trim()
      : fallback;

export const normalizeCompanyBrand = (
  id: string,
  data: Record<string, unknown> | null | undefined
): CompanyBrand | null => {
  const name = normalizeText(data?.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    logoUrl: normalizeText(data?.logoUrl),
    logoAlt: normalizeText(data?.logoAlt),
    primaryColor: normalizeColor(data?.primaryColor, DEFAULT_COMPANY_COLORS.primaryColor),
    headerColor: normalizeColor(data?.headerColor, DEFAULT_COMPANY_COLORS.headerColor),
    logoBackgroundColor: normalizeColor(
      data?.logoBackgroundColor,
      DEFAULT_COMPANY_COLORS.logoBackgroundColor
    ),
  };
};
