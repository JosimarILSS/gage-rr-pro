export type Lang = 'es' | 'en';

export type AppTheme = 'night' | 'day';

export type DataRow = Record<string, unknown>;

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};
