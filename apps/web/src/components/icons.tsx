import type { SVGProps } from 'react';

const paths: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7.5" height="9" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" /><rect x="13.5" y="12" width="7.5" height="9" rx="1.5" /><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M3.5 20c.6-3.6 2.8-5.5 5.5-5.5S13.9 16.4 14.5 20" /><path d="M16 8.6a3 3 0 1 1 1.6 5.6" /><path d="M17.5 14.7c2.2.4 3.6 2 4 5.3" /></>,
  config: <><path d="M4 7h10" /><circle cx="17" cy="7" r="2.6" /><path d="M20 16H10" /><circle cx="7" cy="16" r="2.6" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  subscription: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
  plan: <><path d="M6 3h12a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2-3-2V5a2 2 0 0 1 2-2Z" /><path d="M9 8h6M9 12h6" /></>,
  group: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
  reseller: <><circle cx="12" cy="7" r="3.2" /><path d="M5.5 20c.7-4 3.2-6 6.5-6s5.8 2 6.5 6" /><path d="M12 10.8V14" /></>,
  report: <><path d="M4 20V6" /><path d="M4 20h16" /><path d="M9 16v-5M13 16V8M17 16v-3" /></>,
  activity: <><path d="M3 12h4l2.5-6 4 12L16 12h5" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="M11 11 20 2m-3 3 3 3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5 13.8 5h2.9l1 2.6 2.6 1v2.9l2.2 1.5-2.2 1.5v2.9l-2.6 1-1 2.6h-2.9L12 21.5 10.2 19H7.3l-1-2.6-2.6-1v-2.9L1.5 12l2.2-1.5V7.6l2.6-1 1-2.6h2.9Z" transform="scale(.86) translate(1.9 1.9)" /></>,
  shield: <><path d="M12 3 5 6v5c0 5 3 8.4 7 10 4-1.6 7-5 7-10V6Z" /><path d="m9.3 11.8 2 2 3.6-4" /></>,
  audit: <><path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M9.5 8h5M9.5 12h5M9.5 16h3" /></>,
  health: <><path d="M12 21s-7.5-4.7-9.3-9.6C1.3 7.6 3.6 4.5 7 4.5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3.4 0 5.7 3.1 4.3 6.9C19.5 16.3 12 21 12 21Z" /><path d="M7 12h3l1.5-3 2 5L15 12h2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v4h-4" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" /><path d="M6.5 7 7.4 20h9.2l.9-13" /></>,
  edit: <><path d="M4 20h4l11-11-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" transform="translate(2 2)" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2v2h-2z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.8 2.6 4 5.7 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.7-4-9s1.2-6.4 4-9Z" /></>,
  chevron: <><path d="m6 9 6 6 6-6" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>,
  traffic: <><path d="M7 17 17 7" /><path d="M9 7h8v8" /><path d="M7 21h.01M12 21h.01M17 21h.01" /></>,
  warn: <><path d="M12 3 2.5 20h19Z" /><path d="M12 9.5V14M12 17h.01" /></>,
  check: <><path d="m4.5 12.5 5 5 10-11" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></>,
  send: <><path d="m21 3-9.5 9.5" /><path d="M21 3 14 21l-2.5-8.5L3 10Z" /></>,
  bolt: <><path d="M13 2 4 14h6l-1 8 9-12h-6Z" /></>,
  link: <><path d="M9.5 14.5a4 4 0 0 1 0-5.7l3-3a4 4 0 0 1 5.7 5.7l-1.6 1.6" /><path d="M14.5 9.5a4 4 0 0 1 0 5.7l-3 3a4 4 0 0 1-5.7-5.7l1.6-1.6" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-4 3.5-6 7-6s6.2 2 7 6" /></>,
  docs: <><path d="M7 3h7l5 5v13H7Z" /><path d="M14 3v5h5" /></>,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, ...rest }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name] ?? paths.dashboard}
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.6 20.5 7v10L12 21.4 3.5 17V7L12 2.6Z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 21.4V12M12 12 3.5 7M12 12l8.5-5" stroke="white" strokeWidth="1.4" strokeLinejoin="round" opacity=".85" />
      <circle cx="12" cy="12" r="1.7" fill="white" />
    </svg>
  );
}
