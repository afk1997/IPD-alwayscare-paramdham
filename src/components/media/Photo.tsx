'use client';
import Image from 'next/image';
import { useMemo, useState } from 'react';

type Kind = 'photo' | 'video' | 'xray' | 'doc';

interface Props {
  // If `src` is provided we render the real image. Otherwise we render a
  // procedural SVG placeholder seeded by `seed` so the same id stays consistent.
  src?: string | undefined;
  seed: string;
  kind?: Kind | undefined;
  label?: string | undefined;
  time?: string | undefined;
  durationSec?: number | undefined;
  rounded?: number | undefined;
  className?: string | undefined;
  showLabel?: boolean | undefined;
  onClick?: (() => void) | undefined;
  alt?: string | undefined;
}

const PHOTO_PALETTES: Array<[string, string, string]> = [
  ['#7A4A2F', '#C99267', '#F1D9BD'],
  ['#A86B3A', '#D9A074', '#F5E6D0'],
  ['#5C3A28', '#A26D4A', '#E7CBA9'],
  ['#2E4258', '#6B8AA8', '#C2D3E0'],
  ['#3B4D55', '#7E9BA5', '#D3DDDF'],
  ['#2B4A3F', '#5F8A77', '#C9DDC9'],
  ['#5C2A29', '#A85A50', '#E7BFB5'],
  ['#3A3A40', '#7A7A82', '#CFCFD2'],
];

const XRAY_PALETTES: Array<[string, string, string]> = [
  ['#0C1014', '#1F2A36', '#4A6075'],
  ['#0A0D11', '#1A222B', '#3B4E60'],
];

function hashSeed(s: string): number {
  let h = 2166136261;
  const str = String(s || 'x');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: many optional decorations on the same SVG placeholder
export function Photo({
  src,
  seed,
  kind = 'photo',
  label,
  time,
  durationSec,
  rounded = 10,
  className = '',
  showLabel = true,
  onClick,
  alt = '',
}: Props) {
  const meta = useMemo(() => {
    const h = hashSeed(seed);
    const palette =
      kind === 'xray' ? XRAY_PALETTES[h % XRAY_PALETTES.length] : PHOTO_PALETTES[h % PHOTO_PALETTES.length];
    const pal = palette ?? PHOTO_PALETTES[0] ?? (['#000', '#444', '#888'] as [string, string, string]);
    return {
      h,
      pal,
      angle: (h % 90) - 45,
      sx: 25 + (h % 50),
      sy: 35 + ((h >> 3) % 35),
      sr: 30 + ((h >> 5) % 22),
      gid: `mg${h & 0xffff}`,
    };
  }, [seed, kind]);

  const isVideo = kind === 'video';
  const isXray = kind === 'xray';
  const isDoc = kind === 'doc';

  const dur = (() => {
    if (!isVideo) return null;
    const s = durationSec ?? 8 + (meta.h % 50);
    const mm = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  })();

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: rounded,
    cursor: onClick ? 'pointer' : undefined,
    background: meta.pal[0],
    boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)',
  };

  const [imageFailed, setImageFailed] = useState(false);
  if (src && !imageFailed) {
    return (
      <div
        className={className}
        style={containerStyle}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="200px"
          className="object-cover"
          unoptimized
          onError={() => setImageFailed(true)}
        />
        {label && showLabel && <LabelBand label={label} />}
        {time && <TimePill time={time} />}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter') onClick();
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`${meta.gid}a`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
            gradientTransform={`rotate(${meta.angle} 0.5 0.5)`}
          >
            <stop offset="0" stopColor={meta.pal[0]} />
            <stop offset="1" stopColor={meta.pal[1]} />
          </linearGradient>
          <radialGradient id={`${meta.gid}b`} cx={`${meta.sx}%`} cy={`${meta.sy}%`} r={`${meta.sr}%`}>
            <stop offset="0" stopColor={meta.pal[2]} stopOpacity={isXray ? 0.55 : 0.95} />
            <stop offset="0.6" stopColor={meta.pal[1]} stopOpacity={isXray ? 0.25 : 0.5} />
            <stop offset="1" stopColor={meta.pal[1]} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${meta.gid}v`} cx="0.5" cy="0.5" r="0.7">
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.35" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${meta.gid}a)`} />
        <rect width="100" height="100" fill={`url(#${meta.gid}b)`} />

        {!isDoc && (
          <ellipse
            cx={(meta.sx + 30) % 100}
            cy={(meta.sy + 25) % 100}
            rx={meta.sr * 0.55}
            ry={meta.sr * 0.4}
            fill={meta.pal[isXray ? 2 : 1]}
            opacity={isXray ? 0.18 : 0.32}
          />
        )}

        <g opacity="0.07">
          {Array.from({ length: 16 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: deterministic scanlines, length-stable
            <rect key={i} x="0" y={i * 6.25} width="100" height="0.6" fill="#000" />
          ))}
        </g>

        {isXray && (
          <g stroke="rgba(220,235,255,0.18)" strokeWidth="0.3" fill="none">
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="50" y1="0" x2="50" y2="100" />
            <circle cx={meta.sx} cy={meta.sy} r={meta.sr * 0.45} stroke="rgba(220,235,255,0.35)" />
          </g>
        )}

        {isDoc && (
          <g fill="rgba(20,30,45,0.12)">
            <rect x="14" y="20" width="60" height="3" rx="1" />
            <rect x="14" y="28" width="72" height="2" rx="1" />
            <rect x="14" y="34" width="55" height="2" rx="1" />
            <rect x="14" y="40" width="68" height="2" rx="1" />
            <rect x="14" y="50" width="40" height="2" rx="1" />
            <rect x="14" y="56" width="60" height="2" rx="1" />
            <rect x="14" y="62" width="52" height="2" rx="1" />
            <rect x="14" y="74" width="30" height="3" rx="1" />
          </g>
        )}

        <rect width="100" height="100" fill={`url(#${meta.gid}v)`} />
      </svg>

      {isVideo && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid rgba(255,255,255,0.85)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <polygon points="4,3 13,8 4,13" fill="#fff" />
            </svg>
          </div>
        </div>
      )}

      {(isXray || isDoc) && showLabel && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            background: 'rgba(8,12,18,0.7)',
            color: '#E8ECF1',
            textTransform: 'uppercase',
          }}
        >
          {isXray ? 'X-Ray' : 'PDF'}
        </div>
      )}

      {isVideo && dur && <TimePill time={dur} bottomRight />}
      {time && <TimePill time={time} />}
      {label && showLabel && <LabelBand label={label} />}
    </div>
  );
}

function LabelBand({ label }: { label: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '7px 9px 14px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0))',
        color: '#fff',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.02em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
}

function TimePill({ time, bottomRight }: { time: string; bottomRight?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 5,
        ...(bottomRight ? { right: 5 } : { left: 5 }),
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 9.5,
        fontWeight: 600,
        background: 'rgba(0,0,0,0.65)',
        color: '#fff',
        maxWidth: 'calc(100% - 12px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {time}
    </div>
  );
}
