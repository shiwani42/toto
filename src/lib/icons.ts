// Monochrome line icons. Each returns an inline SVG string sized to the
// given pixel value, inheriting color from CSS (stroke="currentColor").
// Paths borrowed from Lucide (MIT licensed) and trimmed for our use.

export type IconName =
  | "home"
  | "list"
  | "camera"
  | "users"
  | "user"
  | "compass"
  | "eye"
  | "scale"
  | "wrench"
  | "ruler"
  | "settings"
  | "store"
  | "shield"
  | "sparkles";

const PATHS: Record<IconName, string> = {
  home: `<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>`,
  list: `<line x1="8" y1="6" x2="20" y2="6"/>
         <line x1="8" y1="12" x2="20" y2="12"/>
         <line x1="8" y1="18" x2="20" y2="18"/>
         <circle cx="4" cy="6" r="1.2"/>
         <circle cx="4" cy="12" r="1.2"/>
         <circle cx="4" cy="18" r="1.2"/>`,
  camera: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
           <circle cx="12" cy="13" r="4"/>`,
  users: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
         <circle cx="12" cy="7" r="4"/>`,
  compass: `<circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" stroke-linejoin="round"/>`,
  eye: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>`,
  scale: `<path d="M5 16l-3-8 3-8a4 4 0 0 1 0 8z" transform="translate(0 4)"/>
          <path d="M19 16l-3-8 3-8a4 4 0 0 1 0 8z" transform="translate(0 4)"/>
          <path d="M7 21h10"/>
          <path d="M12 3v18"/>
          <path d="M3 7q2 0 4-1l5-1 5 1q2 1 4 1"/>`,
  wrench: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
  ruler: `<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/>
          <path d="M14.5 12.5l2-2"/>
          <path d="M11.5 9.5l2-2"/>
          <path d="M8.5 6.5l2-2"/>
          <path d="M17.5 15.5l2-2"/>`,
  settings: `<circle cx="12" cy="12" r="3"/>
             <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  store: `<path d="M3 9l1-6h16l1 6"/>
          <path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/>
          <path d="M3 9h18"/>
          <rect x="9" y="14" width="6" height="7"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  sparkles: `<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
             <path d="M19 14l1 2.5L22 18l-2 .5L19 21l-1-2.5L16 18l2-.5z"/>`,
};

export function icon(name: IconName, size = 22): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">${PATHS[name]}</svg>`;
}
