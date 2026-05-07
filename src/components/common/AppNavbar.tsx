import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import ilssWhiteLogo from '../../assets/ilss-group-logo-blanco.png';
import ilssLogo from '../../assets/ilss-group-logo.png';
import { useCompanyBrand } from '../../contexts/CompanyBrandContext';
import type { AppTheme, Lang } from '../../types/common';

type AppNavbarProps = {
  appTheme: AppTheme;
  lang?: Lang;
  onToggleTheme: () => void;
  left?: ReactNode;
  right?: ReactNode;
};

export default function AppNavbar({
  appTheme,
  lang = 'es',
  onToggleTheme,
  left,
  right,
}: AppNavbarProps) {
  const companyBrand = useCompanyBrand();
  const isNight = appTheme === 'night';
  const defaultLogoSrc = isNight ? ilssWhiteLogo : ilssLogo;
  const brandName = companyBrand?.name || 'International Lean Six Sigma Group';
  const logoSrc = companyBrand?.logoUrl || defaultLogoSrc;
  const logoAlt = companyBrand?.logoAlt || brandName;
  const hasCustomLogo = !!companyBrand?.logoUrl;
  const brandClassName =
    `app-navbar-brand${hasCustomLogo ? ' app-navbar-brand-custom' : ''}${
      !hasCustomLogo && isNight ? ' app-navbar-brand-night' : ''
    }`;
  const logoClassName = `app-navbar-logo${hasCustomLogo ? ' app-navbar-logo-custom' : ''}`;
  const toggleLabel =
    lang === 'es'
      ? `Cambiar a modo ${isNight ? 'día' : 'noche'}`
      : `Switch to ${isNight ? 'day' : 'night'} mode`;

  return (
    <header className="app-header app-navbar">
      <div className="app-container app-navbar-inner">
        <div className="app-navbar-left">{left}</div>

        <div className={brandClassName} aria-label={brandName}>
          <img src={logoSrc} alt={logoAlt} className={logoClassName} />
        </div>

        <div className="app-navbar-right">
          {right}
          <button
            type="button"
            onClick={onToggleTheme}
            className="app-theme-switch"
            aria-label={toggleLabel}
          >
            <span className={`app-theme-switch-option ${isNight ? 'is-active' : ''}`}>
              <Moon className="w-3.5 h-3.5" />
              {lang === 'es' ? 'Noche' : 'Night'}
            </span>
            <span className={`app-theme-switch-option ${!isNight ? 'is-active' : ''}`}>
              <Sun className="w-3.5 h-3.5" />
              {lang === 'es' ? 'Día' : 'Day'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
