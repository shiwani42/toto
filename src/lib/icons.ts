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
  | "sparkles"
  | "zap"
  // Wizard glyphs (line icons, brand monochrome). Sourced from Lucide.
  | "boot"
  | "mountain"
  | "tent"
  | "climbing"
  | "running"
  | "snowflake"
  | "backpack"
  | "gift"
  | "man"
  | "woman"
  | "leaf"
  | "sprout"
  | "tree"
  | "mountain-snow"
  | "target"
  | "baby"
  | "banknote"
  | "flame"
  | "sun"
  | "feather"
  | "rain"
  | "star"
  | "plus";

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
  zap: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,

  // Wizard glyphs ──
  boot: `<path d="M4 16V5h7v5h7v6"/>
         <line x1="4" y1="20" x2="20" y2="20"/>
         <line x1="11" y1="10" x2="14" y2="10"/>`,
  mountain: `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>`,
  tent: `<path d="M3.5 21 14 3l6.5 18-9-7-8 7z"/>
         <path d="M14 3v18"/>`,
  climbing: `<polyline points="3 20 7 11 12 14 17 6 21 9"/>
             <circle cx="3" cy="20" r="1.4"/>
             <circle cx="21" cy="9" r="1.4"/>`,
  running: `<circle cx="14" cy="4" r="2"/>
            <path d="M5 21l5-6 3 2 2-4 5 3"/>
            <path d="M10 9h4l3 5"/>`,
  snowflake: `<line x1="12" y1="2" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <line x1="5" y1="5" x2="19" y2="19"/>
              <line x1="5" y1="19" x2="19" y2="5"/>`,
  backpack: `<path d="M4 21V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v11"/>
             <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6"/>
             <line x1="8" y1="12" x2="16" y2="12"/>
             <line x1="8" y1="16" x2="16" y2="16"/>`,
  gift: `<polyline points="20 12 20 22 4 22 4 12"/>
         <rect x="2" y="7" width="20" height="5"/>
         <line x1="12" y1="22" x2="12" y2="7"/>
         <path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z"/>
         <path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>`,
  man: `<circle cx="12" cy="5" r="3"/>
        <path d="M12 8v10"/>
        <path d="M8 22h8"/>`,
  woman: `<circle cx="12" cy="5" r="3"/>
          <path d="M12 8v6"/>
          <path d="M8 14h8l-2 6h-4z"/>`,
  leaf: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4 19 2c1 2 2 5 2 8a7 7 0 0 1-7 7"/>
         <path d="M2 21c0-3 1.85-5.36 5.08-6"/>`,
  sprout: `<path d="M7 20h10"/>
           <path d="M10 20c5.5-2.5.42-6.5 5-10"/>
           <path d="M9.5 9.4C8.95 7.55 9 6 5.5 6c0 3.5 1.5 5 4 6"/>
           <path d="M14.1 6c.6 1.5.5 3-1.6 4-2-3 0-6 1.6-4z"/>`,
  tree: `<path d="M8 19a7 7 0 1 1 0-14 4 4 0 1 1 0 8 4 4 0 1 1 0 6"/>
         <path d="M12 19v3"/>`,
  "mountain-snow": `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
                    <path d="m9 8 1.7 1.7L12 8.5"/>`,
  target: `<circle cx="12" cy="12" r="10"/>
           <circle cx="12" cy="12" r="6"/>
           <circle cx="12" cy="12" r="2"/>`,
  baby: `<path d="M9 12h.01"/>
         <path d="M15 12h.01"/>
         <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/>
         <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>`,
  banknote: `<rect x="2" y="6" width="20" height="12" rx="2"/>
             <circle cx="12" cy="12" r="2"/>
             <path d="M6 12h.01M18 12h.01"/>`,
  flame: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  sun: `<circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2"/><path d="M12 20v2"/>
        <path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/>
        <path d="M2 12h2"/><path d="M20 12h2"/>
        <path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/>`,
  feather: `<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
            <line x1="16" y1="8" x2="2" y2="22"/>
            <line x1="17.5" y1="15" x2="9" y2="15"/>`,
  rain: `<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>
         <path d="M8 19v2"/><path d="M12 17v4"/><path d="M16 19v2"/>`,
  star: `<polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9 12 2"/>`,
  plus: `<line x1="12" y1="5" x2="12" y2="19"/>
         <line x1="5" y1="12" x2="19" y2="12"/>`,
};

export function icon(name: IconName, size = 22): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">${PATHS[name]}</svg>`;
}
