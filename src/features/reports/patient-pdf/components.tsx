import { Image, Text, View } from '@react-pdf/renderer';
import { type ReportImage, fitWithin } from './fit';
import { pickFont } from './fonts';
import { BRAND, s } from './styles';

export type PdfStyle = NonNullable<React.ComponentProps<typeof View>['style']>;

// Text that switches to a Devanagari/Gujarati-capable font when needed.
export function T({
  children,
  style,
  dyn,
}: { children: React.ReactNode; style?: PdfStyle; dyn?: string | null }) {
  const family = dyn ? pickFont(dyn) : undefined;
  return (
    <Text
      style={[...(Array.isArray(style) ? style : style ? [style] : []), family ? { fontFamily: family } : {}]}
    >
      {children}
    </Text>
  );
}

// Renders the COMPLETE image (no crop) at its own aspect ratio inside a
// gold-matted frame no larger than maxW×maxH; placeholder when missing.
export function FitImage({
  id,
  images,
  maxW,
  maxH,
}: { id: string; images: Map<string, ReportImage>; maxW: number; maxH: number }) {
  const img = images.get(id);
  if (!img) {
    return (
      <View style={[s.imgPh, { width: maxW, height: Math.min(maxH, 80) }]}>
        <Text style={{ fontSize: 7, color: BRAND.soft }}>image unavailable</Text>
      </View>
    );
  }
  const { w, h } = fitWithin(img.width, img.height, maxW, maxH);
  return (
    <View style={s.imgMat}>
      <Image src={{ data: img.data, format: 'jpg' }} style={{ width: w, height: h, borderRadius: 3 }} />
    </View>
  );
}

// Key-value row for the hero facts grid; hidden when the value is empty.
export function KV({ label, val }: { label: string; val: string | null }) {
  if (!val) return null;
  return (
    <View style={s.kvItem}>
      <Text style={s.k}>{label}</Text>
      <T style={s.v} dyn={val}>
        {val}
      </T>
    </View>
  );
}
