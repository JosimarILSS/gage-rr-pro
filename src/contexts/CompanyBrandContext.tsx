import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { CompanyBrand } from '../types/company';

type CompanyBrandProviderProps = {
  brand: CompanyBrand | null;
  children: ReactNode;
};

const CompanyBrandContext = createContext<CompanyBrand | null>(null);

const brandedCssProperties = [
  '--app-primary',
  '--app-primary-hover',
  '--app-primary-soft',
  '--app-primary-border',
  '--app-primary-text',
  '--app-primary-contrast',
  '--app-header-bg',
  '--app-header-text',
  '--app-logo-bg',
  '--app-logo-border',
];

const clearBrandCssVariables = () => {
  brandedCssProperties.forEach((property) => {
    document.documentElement.style.removeProperty(property);
  });
};

const getReadableTextColor = (hexColor: string) => {
  const normalized = hexColor.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '#ffffff';

  const [red, green, blue] = [0, 2, 4].map((start) => {
    const channel = parseInt(normalized.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithBlack >= contrastWithWhite ? '#0f172a' : '#ffffff';
};

const applyBrandCssVariables = (brand: CompanyBrand | null) => {
  clearBrandCssVariables();
  if (!brand) return;

  const rootStyle = document.documentElement.style;
  const primaryContrast = getReadableTextColor(brand.primaryColor);
  const headerText = getReadableTextColor(brand.headerColor);
  const logoBackground = brand.logoBackgroundColor === 'transparent'
    ? 'transparent'
    : brand.logoBackgroundColor;

  rootStyle.setProperty('--app-primary', brand.primaryColor);
  rootStyle.setProperty(
    '--app-primary-hover',
    `color-mix(in srgb, ${brand.primaryColor} 82%, black)`
  );
  rootStyle.setProperty(
    '--app-primary-soft',
    `color-mix(in srgb, ${brand.primaryColor} 16%, var(--app-surface))`
  );
  rootStyle.setProperty(
    '--app-primary-border',
    `color-mix(in srgb, ${brand.primaryColor} 45%, var(--app-border))`
  );
  rootStyle.setProperty('--app-primary-text', brand.primaryColor);
  rootStyle.setProperty('--app-primary-contrast', primaryContrast);
  rootStyle.setProperty('--app-header-bg', brand.headerColor);
  rootStyle.setProperty('--app-header-text', headerText);
  rootStyle.setProperty('--app-logo-bg', logoBackground);
  rootStyle.setProperty(
    '--app-logo-border',
    logoBackground === 'transparent'
      ? 'transparent'
      : `color-mix(in srgb, ${logoBackground} 72%, var(--app-border))`
  );
};

export function CompanyBrandProvider({ brand, children }: CompanyBrandProviderProps) {
  useEffect(() => {
    applyBrandCssVariables(brand);
    return () => clearBrandCssVariables();
  }, [brand]);

  return (
    <CompanyBrandContext.Provider value={brand}>
      {children}
    </CompanyBrandContext.Provider>
  );
}

export const useCompanyBrand = () => useContext(CompanyBrandContext);
