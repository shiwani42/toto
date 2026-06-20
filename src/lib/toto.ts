// Toto, the mascot. A sitting golden-retriever-style puppy.
// Inline SVG, named groups so each part can animate independently.
// This rev: cleaner forelegs that flow out of the body, paws with toe pads
// at the bottom (not stuck on top), a longer tapered curl tail with fur
// shading lines, and a smaller anatomical tongue.

export function totoMascot(size = 200): string {
  return `
    <svg viewBox="0 0 240 250" width="${size}" height="${(size * 250) / 240}"
         xmlns="http://www.w3.org/2000/svg"
         class="toto-svg toto-svg--full"
         role="img" aria-label="Toto">
      <defs>
        <linearGradient id="totoBodyG" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"  stop-color="#F4DAA2"/>
          <stop offset="50%" stop-color="#E6C383"/>
          <stop offset="100%" stop-color="#B98E55"/>
        </linearGradient>
        <linearGradient id="totoBodyShade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"  stop-color="#000" stop-opacity="0.1"/>
          <stop offset="50%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.12"/>
        </linearGradient>
        <radialGradient id="totoHeadG" cx="44%" cy="32%" r="68%">
          <stop offset="0%"  stop-color="#F8E2B0"/>
          <stop offset="65%" stop-color="#E5C684"/>
          <stop offset="100%" stop-color="#B88B4F"/>
        </radialGradient>
        <radialGradient id="totoEarG" cx="50%" cy="20%" r="80%">
          <stop offset="0%"  stop-color="#B07A45"/>
          <stop offset="100%" stop-color="#724723"/>
        </radialGradient>
        <radialGradient id="totoMuzzleG" cx="50%" cy="40%" r="70%">
          <stop offset="0%"  stop-color="#FFFDF3"/>
          <stop offset="100%" stop-color="#F0E1BB"/>
        </radialGradient>
        <radialGradient id="totoChestG" cx="50%" cy="40%" r="65%">
          <stop offset="0%"  stop-color="#FFFDF3"/>
          <stop offset="100%" stop-color="#F4E7C6" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="totoPawG" cx="50%" cy="40%" r="70%">
          <stop offset="0%"  stop-color="#F5DEAA"/>
          <stop offset="100%" stop-color="#CDA56C"/>
        </radialGradient>
        <radialGradient id="totoEyeG" cx="35%" cy="30%" r="80%">
          <stop offset="0%"  stop-color="#4A3624"/>
          <stop offset="100%" stop-color="#15100A"/>
        </radialGradient>
        <radialGradient id="totoTongueG" cx="50%" cy="20%" r="80%">
          <stop offset="0%"  stop-color="#F2B0BD"/>
          <stop offset="100%" stop-color="#D67A8E"/>
        </radialGradient>
      </defs>

      <!-- Ground shadow -->
      <ellipse class="toto-shadow" cx="120" cy="240" rx="74" ry="6" fill="#000" opacity="0.1"/>

      <!-- Tail behind body, longer with curl and fur shading -->
      <g class="toto-tail">
        <path d="M180,164
                 C196,156 218,150 224,132
                 C226,122 220,114 212,116
                 C198,122 188,140 180,158
                 Z"
              fill="url(#totoBodyG)" stroke="#8E6A3E" stroke-width="1"/>
        <!-- Fur direction lines -->
        <path d="M184,158 C196,148 210,138 218,128"
              stroke="#A07A48" stroke-width="0.9" fill="none" opacity="0.7" stroke-linecap="round"/>
        <path d="M188,154 C198,146 206,138 213,130"
              stroke="#A07A48" stroke-width="0.7" fill="none" opacity="0.5" stroke-linecap="round"/>
      </g>

      <g class="toto-body">
        <!-- Rounded torso (sitting on haunches), no leg indents -->
        <path d="M120,132
                 C72,132 52,166 58,202
                 C62,224 84,234 120,234
                 C156,234 178,224 182,202
                 C188,166 168,132 120,132 Z"
              fill="url(#totoBodyG)" stroke="#8E6A3E" stroke-width="1"/>

        <!-- Side body shading for 3D feel -->
        <path d="M120,132
                 C72,132 52,166 58,202
                 C62,224 84,234 120,234
                 C156,234 178,224 182,202
                 C188,166 168,132 120,132 Z"
              fill="url(#totoBodyShade)"/>

        <!-- Chest + belly white blaze -->
        <path d="M120,150
                 C108,156 102,172 100,190
                 C99,206 106,224 120,230
                 C134,224 141,206 140,190
                 C138,172 132,156 120,150 Z"
              fill="url(#totoChestG)"/>

        <!-- LEFT foreleg: tapered, with a clear silhouette in front of body -->
        <g class="toto-leg toto-leg--left">
          <path d="M94,168
                   C88,176 84,194 84,212
                   L84,222
                   C84,228 108,228 108,222
                   L108,212
                   C108,194 106,176 102,168
                   C100,162 96,162 94,168 Z"
                fill="url(#totoBodyG)" stroke="#8E6A3E" stroke-width="1"/>
          <!-- Leg shading on outer edge (3D) -->
          <path d="M86,180 C84,195 84,210 86,222"
                stroke="#000" stroke-width="0.8" fill="none" opacity="0.12" stroke-linecap="round"/>
          <!-- Wrist crease where leg meets paw -->
          <path d="M84,220 C90,222 102,222 108,220"
                stroke="#8E6A3E" stroke-width="0.8" fill="none" opacity="0.7" stroke-linecap="round"/>
        </g>

        <!-- RIGHT foreleg: mirror -->
        <g class="toto-leg toto-leg--right">
          <path d="M146,168
                   C152,176 156,194 156,212
                   L156,222
                   C156,228 132,228 132,222
                   L132,212
                   C132,194 134,176 138,168
                   C140,162 144,162 146,168 Z"
                fill="url(#totoBodyG)" stroke="#8E6A3E" stroke-width="1"/>
          <path d="M154,180 C156,195 156,210 154,222"
                stroke="#000" stroke-width="0.8" fill="none" opacity="0.12" stroke-linecap="round"/>
          <path d="M132,220 C138,222 150,222 156,220"
                stroke="#8E6A3E" stroke-width="0.8" fill="none" opacity="0.7" stroke-linecap="round"/>
        </g>

        <!-- LEFT paw: rests on ground, wider than leg, with toe pads -->
        <g class="toto-paw toto-paw--left">
          <path d="M80,222
                   C72,224 70,232 78,236
                   C90,239 102,239 112,236
                   C118,234 118,226 110,222
                   C100,220 88,220 80,222 Z"
                fill="url(#totoPawG)" stroke="#8E6A3E" stroke-width="0.9"/>
          <!-- 3 toe pads at front of paw -->
          <ellipse cx="84"  cy="234" rx="3.2" ry="2.2" fill="#6E4D24"/>
          <ellipse cx="94"  cy="235" rx="3.4" ry="2.4" fill="#6E4D24"/>
          <ellipse cx="105" cy="234" rx="3.2" ry="2.2" fill="#6E4D24"/>
          <!-- Toe separation lines -->
          <path d="M88,231 L88,237 M99,232 L99,238 M110,231 L110,237"
                stroke="#8E6A3E" stroke-width="0.6" stroke-linecap="round" opacity="0.5"/>
        </g>

        <!-- RIGHT paw -->
        <g class="toto-paw toto-paw--right">
          <path d="M160,222
                   C168,224 170,232 162,236
                   C150,239 138,239 128,236
                   C122,234 122,226 130,222
                   C140,220 152,220 160,222 Z"
                fill="url(#totoPawG)" stroke="#8E6A3E" stroke-width="0.9"/>
          <ellipse cx="135" cy="234" rx="3.2" ry="2.2" fill="#6E4D24"/>
          <ellipse cx="146" cy="235" rx="3.4" ry="2.4" fill="#6E4D24"/>
          <ellipse cx="156" cy="234" rx="3.2" ry="2.2" fill="#6E4D24"/>
          <path d="M130,231 L130,237 M141,232 L141,238 M152,231 L152,237"
                stroke="#8E6A3E" stroke-width="0.6" stroke-linecap="round" opacity="0.5"/>
        </g>
      </g>

      <!-- HEAD -->
      <g class="toto-head">
        <!-- Floppy ears with inner pink + fur shading -->
        <g class="toto-ear toto-ear--left">
          <path d="M70,72
                   C58,58 56,86 60,108
                   C62,126 74,132 84,128
                   C88,116 86,98 82,82 Z"
                fill="url(#totoEarG)" stroke="#5E3E1F" stroke-width="0.9"/>
          <path d="M74,86 C70,98 73,116 80,118 C82,108 82,96 80,90 Z"
                fill="#E5A899" opacity="0.65"/>
          <!-- Fur strand on outer edge -->
          <path d="M64,84 C62,94 64,108 70,118"
                stroke="#5E3E1F" stroke-width="0.7" fill="none" opacity="0.5" stroke-linecap="round"/>
        </g>
        <g class="toto-ear toto-ear--right">
          <path d="M170,72
                   C182,58 184,86 180,108
                   C178,126 166,132 156,128
                   C152,116 154,98 158,82 Z"
                fill="url(#totoEarG)" stroke="#5E3E1F" stroke-width="0.9"/>
          <path d="M166,86 C170,98 167,116 160,118 C158,108 158,96 160,90 Z"
                fill="#E5A899" opacity="0.65"/>
          <path d="M176,84 C178,94 176,108 170,118"
                stroke="#5E3E1F" stroke-width="0.7" fill="none" opacity="0.5" stroke-linecap="round"/>
        </g>

        <!-- Head shape -->
        <ellipse cx="120" cy="90" rx="56" ry="52" fill="url(#totoHeadG)" stroke="#8E6A3E" stroke-width="1"/>

        <!-- Eye mask shading -->
        <ellipse cx="100" cy="82" rx="16" ry="13" fill="#9B6A36" opacity="0.42"/>
        <ellipse cx="140" cy="82" rx="16" ry="13" fill="#9B6A36" opacity="0.42"/>

        <!-- White muzzle -->
        <ellipse cx="120" cy="118" rx="32" ry="22" fill="url(#totoMuzzleG)" stroke="#D6B788" stroke-width="0.6"/>

        <!-- Cheek tufts -->
        <ellipse cx="92"  cy="124" rx="9" ry="6" fill="#F5DEAA" opacity="0.7"/>
        <ellipse cx="148" cy="124" rx="9" ry="6" fill="#F5DEAA" opacity="0.7"/>

        <!-- Eyes -->
        <g class="toto-eyes">
          <ellipse cx="100" cy="88" rx="8" ry="8.5" fill="url(#totoEyeG)"/>
          <ellipse cx="140" cy="88" rx="8" ry="8.5" fill="url(#totoEyeG)"/>
          <circle class="toto-catchlight" cx="103" cy="85" r="2.6" fill="#FFFFFF"/>
          <circle class="toto-catchlight" cx="143" cy="85" r="2.6" fill="#FFFFFF"/>
          <circle cx="97"  cy="92" r="1.2" fill="#FFFFFF" opacity="0.7"/>
          <circle cx="137" cy="92" r="1.2" fill="#FFFFFF" opacity="0.7"/>
        </g>
        <ellipse class="toto-eyelid toto-eyelid--left"  cx="100" cy="88" rx="8.5" ry="9" fill="#E5C684"/>
        <ellipse class="toto-eyelid toto-eyelid--right" cx="140" cy="88" rx="8.5" ry="9" fill="#E5C684"/>

        <!-- Heart-shaped nose -->
        <path d="M120,104
                 C113,104 110,108 110,112
                 C110,116 116,120 120,122
                 C124,120 130,116 130,112
                 C130,108 127,104 120,104 Z"
              fill="#1A1410"/>
        <ellipse cx="117" cy="108" rx="2.2" ry="1.4" fill="#5F4A36" opacity="0.85"/>

        <!-- Mouth: refined smile with anatomical tongue -->
        <g class="toto-mouth">
          <!-- Bridge from nose to mouth -->
          <path d="M120,123 L120,130" stroke="#2A2218" stroke-width="2" stroke-linecap="round"/>
          <!-- Smile curves -->
          <path d="M120,130 Q108,144 96,136"
                stroke="#2A2218" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <path d="M120,130 Q132,144 144,136"
                stroke="#2A2218" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <!-- Inside mouth shadow (depth) -->
          <path d="M120,131
                   Q108,143 100,135
                   L120,135 L140,135
                   Q132,143 120,131 Z"
                fill="#2C1A10" opacity="0.85"/>
          <!-- Tongue: smaller, with a clear centerline -->
          <path class="toto-tongue"
                d="M114,133
                   Q120,145 126,133
                   Q124,141 120,142
                   Q116,141 114,133 Z"
                fill="url(#totoTongueG)" stroke="#A85368" stroke-width="0.5"/>
          <path d="M120,135 L120,141"
                stroke="#A85368" stroke-width="0.6" stroke-linecap="round" opacity="0.7"/>
        </g>
      </g>
    </svg>
  `;
}

export function totoAvatar(size = 40): string {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}"
         xmlns="http://www.w3.org/2000/svg"
         class="toto-svg toto-svg--avatar"
         role="img" aria-label="Toto">
      <defs>
        <radialGradient id="totoAvHead" cx="44%" cy="32%" r="70%">
          <stop offset="0%"  stop-color="#F8E2B0"/>
          <stop offset="65%" stop-color="#E5C684"/>
          <stop offset="100%" stop-color="#B88B4F"/>
        </radialGradient>
        <radialGradient id="totoAvEar" cx="50%" cy="20%" r="80%">
          <stop offset="0%"  stop-color="#B07A45"/>
          <stop offset="100%" stop-color="#7A4F2A"/>
        </radialGradient>
        <radialGradient id="totoAvMuz" cx="50%" cy="40%" r="65%">
          <stop offset="0%"  stop-color="#FFFDF3"/>
          <stop offset="100%" stop-color="#F4E7C6"/>
        </radialGradient>
        <radialGradient id="totoAvEye" cx="35%" cy="30%" r="80%">
          <stop offset="0%"  stop-color="#4A3624"/>
          <stop offset="100%" stop-color="#15100A"/>
        </radialGradient>
      </defs>

      <g class="toto-av-head" transform="translate(0 2)">
        <g class="toto-av-ear toto-av-ear--left">
          <path d="M18,38 C12,30 14,52 16,64 C18,74 26,76 32,74 C34,66 32,52 30,42 Z"
                fill="url(#totoAvEar)" stroke="#5E3E1F" stroke-width="0.6"/>
        </g>
        <g class="toto-av-ear toto-av-ear--right">
          <path d="M82,38 C88,30 86,52 84,64 C82,74 74,76 68,74 C66,66 68,52 70,42 Z"
                fill="url(#totoAvEar)" stroke="#5E3E1F" stroke-width="0.6"/>
        </g>

        <ellipse cx="50" cy="52" rx="38" ry="36" fill="url(#totoAvHead)" stroke="#8E6A3E" stroke-width="0.7"/>
        <ellipse cx="36" cy="48" rx="11" ry="9" fill="#9B6A36" opacity="0.4"/>
        <ellipse cx="64" cy="48" rx="11" ry="9" fill="#9B6A36" opacity="0.4"/>
        <ellipse cx="50" cy="68" rx="22" ry="15" fill="url(#totoAvMuz)" stroke="#D6B788" stroke-width="0.4"/>

        <g class="toto-av-eyes">
          <ellipse cx="36" cy="52" rx="5.5" ry="6" fill="url(#totoAvEye)"/>
          <ellipse cx="64" cy="52" rx="5.5" ry="6" fill="url(#totoAvEye)"/>
          <circle cx="38" cy="49.5" r="1.8" fill="#FFFFFF"/>
          <circle cx="66" cy="49.5" r="1.8" fill="#FFFFFF"/>
        </g>
        <ellipse class="toto-av-lid toto-av-lid--left"  cx="36" cy="52" rx="6" ry="6.5" fill="#E5C684"/>
        <ellipse class="toto-av-lid toto-av-lid--right" cx="64" cy="52" rx="6" ry="6.5" fill="#E5C684"/>

        <path d="M50,62 C45,62 43,65 43,68 C43,71 47,74 50,76 C53,74 57,71 57,68 C57,65 55,62 50,62 Z"
              fill="#1A1410"/>
        <ellipse cx="48.5" cy="64.5" rx="1.4" ry="0.9" fill="#5F4A36" opacity="0.85"/>

        <g class="toto-av-mouth">
          <path d="M50,77 L50,82" stroke="#2A2218" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M50,82 Q43,90 38,85" stroke="#2A2218" stroke-width="1.9" stroke-linecap="round" fill="none"/>
          <path d="M50,82 Q57,90 62,85" stroke="#2A2218" stroke-width="1.9" stroke-linecap="round" fill="none"/>
          <path d="M50,82 Q43,87 40,84 L50,85 L60,84 Q57,87 50,82 Z" fill="#2C1A10" opacity="0.85"/>
          <path d="M46,85 Q50,92 54,85 Q52,89 50,89 Q48,89 46,85 Z" fill="#E5A1B0" stroke="#B36479" stroke-width="0.4"/>
        </g>
      </g>
    </svg>
  `;
}
