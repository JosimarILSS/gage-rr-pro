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
  '--app-header-bg',
  '--app-logo-bg',
  '--app-logo-border',
];

const clearBrandCssVariables = () => {
  brandedCssProperties.forEach((property) => {
    document.documentElement.style.removeProperty(property);
  });
};

const applyBrandCssVariables = (brand: CompanyBrand | null) => {
  clearBrandCssVariables();
  if (!brand) return;

  const rootStyle = document.documentElement.style;
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
  rootStyle.setProperty('--app-header-bg', brand.headerColor);
  rootStyle.setProperty('--app-logo-bg', brand.logoBackgroundColor);
  rootStyle.setProperty(
    '--app-logo-border',
    `color-mix(in srgb, ${brand.logoBackgroundColor} 72%, var(--app-border))`
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
