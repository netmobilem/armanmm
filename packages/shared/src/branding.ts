/**
 * Central branding registry.
 * Changing the product name / logo accent only requires editing this file
 * (plus the logo SVG in apps/web/src/components/Brand.tsx).
 */
export const BRAND = {
  name: 'ViraPanel',
  shortName: 'Vira',
  taglineEn: 'Subscription & Configuration Control Plane',
  taglineFa: 'سامانه مدیریت اشتراک و پیکربندی',
  version: '1.0.0',
  accent: {
    primary: '#6d5cff',
    secondary: '#38b6ff',
    success: '#22c993',
    warning: '#f5b83d',
    danger: '#ff4d6b',
  },
} as const;

export type Brand = typeof BRAND;
