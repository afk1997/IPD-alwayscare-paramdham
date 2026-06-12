// Pure geometry for aspect-ratio-preserving image layout (no deps, no I/O).

export interface ReportImage {
  data: Buffer;
  width: number;
  height: number;
}

// Largest w×h that fits inside maxW×maxH while preserving aspect ratio.
// Never upscales beyond the source dimensions; degenerate input → the box.
export function fitWithin(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: maxW, h: maxH };
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { w: Math.round(w * scale * 100) / 100, h: Math.round(h * scale * 100) / 100 };
}
