const TEAL = '#0E7C7B';
const WHITE = '#FFFFFF';

// Mirrors src/components/shell/BrandMark.tsx (88×88 viewBox), with literal
// colors so `sharp` can rasterize it. Maskable = full-bleed square (rx=0);
// normal = rounded (rx=20). The paw sits within the maskable safe zone.
export function brandMarkSvg(size: number, maskable: boolean): string {
  const rx = maskable ? 0 : 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 88 88">
<rect width="88" height="88" rx="${rx}" fill="${TEAL}"/>
<circle cx="32" cy="42" r="6" fill="${WHITE}"/>
<circle cx="44" cy="36" r="6" fill="${WHITE}"/>
<circle cx="56" cy="42" r="6" fill="${WHITE}"/>
<circle cx="38" cy="50" r="5" fill="${WHITE}"/>
<circle cx="50" cy="50" r="5" fill="${WHITE}"/>
<path d="M34 60 C34 54 38 50 44 50 C50 50 54 54 54 60 C54 66 50 70 44 70 C38 70 34 66 34 60 Z" fill="${WHITE}"/>
</svg>`;
}
