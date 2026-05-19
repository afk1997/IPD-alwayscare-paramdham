// media.jsx — Photo placeholders, media strips, hero banner, and lightbox.
// Every uploaded "photo" is a deterministic SVG render seeded off its id,
// so the same id always renders the same tile. Variants: photo / video / xray / doc.

const { useState: useMS, useEffect: useEM, useMemo: useMemoMed, useRef: useRefMed } = React;

// ── Seed hashing ─────────────────────────────────────────────────────────────
function hashSeed(s) {
  let h = 2166136261;
  const str = String(s || 'x');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Palette pools tuned to feel like real captured media in a clinic context.
const PHOTO_PALETTES = [
  // warm tones (fur, skin, bedding)
  ['#7A4A2F', '#C99267', '#F1D9BD'],
  ['#A86B3A', '#D9A074', '#F5E6D0'],
  ['#5C3A28', '#A26D4A', '#E7CBA9'],
  // cool / clinical (steel, blankets, floors)
  ['#2E4258', '#6B8AA8', '#C2D3E0'],
  ['#3B4D55', '#7E9BA5', '#D3DDDF'],
  // greens (gowns, mats)
  ['#2B4A3F', '#5F8A77', '#C9DDC9'],
  // muted reds (wound area, towels)
  ['#5C2A29', '#A85A50', '#E7BFB5'],
  // dusty greys (sidewalks, concrete)
  ['#3A3A40', '#7A7A82', '#CFCFD2'],
];

const XRAY_PALETTES = [
  ['#0C1014', '#1F2A36', '#4A6075'],
  ['#0A0D11', '#1A222B', '#3B4E60'],
];

function paletteFor(seed, kind) {
  const h = hashSeed(seed);
  if (kind === 'xray') return XRAY_PALETTES[h % XRAY_PALETTES.length];
  return PHOTO_PALETTES[h % PHOTO_PALETTES.length];
}

// ── Photo placeholder ────────────────────────────────────────────────────────
// Renders a stylised SVG that looks like a real photo thumbnail:
// gradient sky + subject blob + faint scanlines for texture.
function Photo({ seed, kind = 'photo', label, time, durationSec, onClick, style, rounded = 10, showLabel = true }) {
  const h = hashSeed(seed);
  const pal = paletteFor(seed, kind);
  const angle = (h % 90) - 45;          // -45..+45
  const subjectX = 25 + (h % 50);       // 25..74
  const subjectY = 35 + ((h >> 3) % 35); // 35..69
  const subjectR = 30 + ((h >> 5) % 22); // 30..51
  const gid = 'mg' + (h & 0xffff);

  const isVideo = kind === 'video';
  const isXray  = kind === 'xray';
  const isDoc   = kind === 'doc';

  const dur = (() => {
    if (!isVideo) return null;
    const s = durationSec || (8 + (h % 50));
    const mm = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return mm + ':' + ss;
  })();

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: rounded,
        cursor: onClick ? 'pointer' : 'default',
        background: pal[0],
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)',
        ...style,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gid + 'a'} x1="0" y1="0" x2="1" y2="1" gradientTransform={`rotate(${angle} 0.5 0.5)`}>
            <stop offset="0" stopColor={pal[0]}/>
            <stop offset="1" stopColor={pal[1]}/>
          </linearGradient>
          <radialGradient id={gid + 'b'} cx={subjectX + '%'} cy={subjectY + '%'} r={subjectR + '%'}>
            <stop offset="0" stopColor={pal[2]} stopOpacity={isXray ? 0.55 : 0.95}/>
            <stop offset="0.6" stopColor={pal[1]} stopOpacity={isXray ? 0.25 : 0.5}/>
            <stop offset="1" stopColor={pal[1]} stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${gid}a)`}/>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${gid}b)`}/>

        {/* Secondary blob for variety */}
        {!isDoc && (
          <ellipse
            cx={(subjectX + 30) % 100}
            cy={(subjectY + 25) % 100}
            rx={subjectR * 0.55}
            ry={subjectR * 0.4}
            fill={pal[isXray ? 2 : 1]}
            opacity={isXray ? 0.18 : 0.32}
          />
        )}

        {/* Subtle scanlines / film grain */}
        <g opacity="0.07">
          {Array.from({ length: 16 }).map((_, i) => (
            <rect key={i} x="0" y={i * 6.25} width="100" height="0.6" fill="#000"/>
          ))}
        </g>

        {/* X-ray grid */}
        {isXray && (
          <g stroke="rgba(220,235,255,0.18)" strokeWidth="0.3" fill="none">
            <line x1="0" y1="50" x2="100" y2="50"/>
            <line x1="50" y1="0" x2="50" y2="100"/>
            <circle cx={subjectX} cy={subjectY} r={subjectR * 0.45} stroke="rgba(220,235,255,0.35)"/>
            <path d={`M${subjectX - 15} ${subjectY + 2} Q${subjectX} ${subjectY - 10} ${subjectX + 15} ${subjectY + 4}`} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
          </g>
        )}

        {/* Doc: paper bars */}
        {isDoc && (
          <g fill="rgba(20,30,45,0.12)">
            <rect x="14" y="20" width="60" height="3" rx="1"/>
            <rect x="14" y="28" width="72" height="2" rx="1"/>
            <rect x="14" y="34" width="55" height="2" rx="1"/>
            <rect x="14" y="40" width="68" height="2" rx="1"/>
            <rect x="14" y="50" width="40" height="2" rx="1"/>
            <rect x="14" y="56" width="60" height="2" rx="1"/>
            <rect x="14" y="62" width="52" height="2" rx="1"/>
            <rect x="14" y="74" width="30" height="3" rx="1"/>
          </g>
        )}

        {/* Vignette */}
        <radialGradient id={gid + 'v'} cx="0.5" cy="0.5" r="0.7">
          <stop offset="0.6" stopColor="#000" stopOpacity="0"/>
          <stop offset="1" stopColor="#000" stopOpacity="0.35"/>
        </radialGradient>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${gid}v)`}/>
      </svg>

      {/* Video play overlay */}
      {isVideo && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid rgba(255,255,255,0.85)',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16"><polygon points="4,3 13,8 4,13" fill="#fff"/></svg>
          </div>
        </div>
      )}

      {/* Kind chip top-left */}
      {(isXray || isDoc) && showLabel && (
        <div style={{
          position: 'absolute', top: 6, left: 6,
          padding: '2px 6px', borderRadius: 4, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
          background: 'rgba(8,12,18,0.7)', color: '#E8ECF1', textTransform: 'uppercase',
        }}>{isXray ? 'X-Ray' : 'PDF'}</div>
      )}

      {/* Video duration bottom-right */}
      {isVideo && dur && (
        <div style={{
          position: 'absolute', bottom: 5, right: 5,
          padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 600,
          background: 'rgba(0,0,0,0.65)', color: '#fff',
        }}>{dur}</div>
      )}

      {/* Timestamp pill */}
      {time && (
        <div style={{
          position: 'absolute', bottom: 5, left: 5,
          padding: '2px 6px', borderRadius: 4, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.02em',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          maxWidth: 'calc(100% - 12px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{time}</div>
      )}

      {/* Label band */}
      {label && showLabel && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '7px 9px 14px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0))',
          color: '#fff', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</div>
      )}
    </div>
  );
}

// ── Hero banner: large media + thumbnails strip ──────────────────────────────
// Used at the top of animal detail.
function HeroBanner({ photos, t, onOpen, height = 200 }) {
  const [idx, setIdx] = useMS(0);
  const wrap = useRefMed(null);
  if (!photos || photos.length === 0) return null;
  const cur = photos[Math.min(idx, photos.length - 1)];

  return (
    <div style={{ padding: '4px 14px 0' }}>
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
        <Photo
          seed={cur.seed || cur.id}
          kind={cur.kind || 'photo'}
          label={cur.label}
          time={cur.time}
          style={{ width: '100%', height, borderRadius: 14 }}
          rounded={14}
          onClick={() => onOpen && onOpen(photos, idx)}
        />

        {/* Prev / next dots */}
        {photos.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 5, padding: '4px 8px', background: 'rgba(8,12,18,0.55)',
            borderRadius: 999, backdropFilter: 'blur(6px)',
          }}>
            {photos.map((_, i) => (
              <div key={i} style={{
                width: i === idx ? 16 : 6, height: 6, borderRadius: 3,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'width 0.18s ease',
              }}/>
            ))}
          </div>
        )}

        {/* Count chip */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          padding: '4px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
          background: 'rgba(8,12,18,0.65)', color: '#fff', display: 'flex', alignItems: 'center', gap: 5,
          backdropFilter: 'blur(6px)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <circle cx="9" cy="11" r="2"/>
            <path d="M3 17l5-4 4 3 4-5 5 6"/>
          </svg>
          {idx + 1} / {photos.length}
        </div>
      </div>

      {/* Thumb strip */}
      {photos.length > 1 && (
        <div ref={wrap} style={{
          display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 0 2px', scrollSnapType: 'x mandatory',
        }}>
          {photos.map((p, i) => (
            <button key={p.id || i} onClick={() => setIdx(i)} style={{
              appearance: 'none', border: 0, padding: 0, background: 'transparent', cursor: 'pointer',
              scrollSnapAlign: 'start', flexShrink: 0,
            }}>
              <Photo
                seed={p.seed || p.id}
                kind={p.kind || 'photo'}
                style={{
                  width: 56, height: 56, borderRadius: 8,
                  border: i === idx ? `2px solid ${t.accent}` : `0.5px solid ${t.line}`,
                  boxSizing: 'border-box',
                }}
                rounded={8}
                showLabel={false}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline media strip: small thumbs row for activity cards ──────────────────
function MediaStrip({ photos, t, onOpen, size = 58, max = 6 }) {
  if (!photos || photos.length === 0) return null;
  const visible = photos.slice(0, max);
  const overflow = photos.length - visible.length;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {visible.map((p, i) => (
        <Photo
          key={p.id || i}
          seed={p.seed || p.id}
          kind={p.kind || 'photo'}
          style={{ width: size, height: size, borderRadius: 9 }}
          rounded={9}
          showLabel={false}
          onClick={(e) => { e.stopPropagation && e.stopPropagation(); onOpen && onOpen(photos, i); }}
        />
      ))}
      {overflow > 0 && (
        <div style={{
          width: size, height: size, borderRadius: 9, background: t.surface2, color: t.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, border: `0.5px solid ${t.line}`,
        }}>+{overflow}</div>
      )}
    </div>
  );
}

// ── Media grid: bigger tiles for documents / dedicated views ─────────────────
function MediaGrid({ photos, t, onOpen, cols = 3, ratio = 1 }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6,
    }}>
      {photos.map((p, i) => (
        <div key={p.id || i} style={{ position: 'relative', aspectRatio: ratio }}>
          <Photo
            seed={p.seed || p.id}
            kind={p.kind || 'photo'}
            label={p.label}
            style={{ width: '100%', height: '100%', borderRadius: 10 }}
            rounded={10}
            onClick={() => onOpen && onOpen(photos, i)}
          />
        </div>
      ))}
    </div>
  );
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ open, photos, startIndex, t, onClose }) {
  const [idx, setIdx] = useMS(startIndex || 0);
  useEM(() => { setIdx(startIndex || 0); }, [startIndex, open]);
  useEM(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx(i => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, photos]);

  if (!open || !photos || photos.length === 0) return null;
  const cur = photos[Math.min(idx, photos.length - 1)];
  const isVideo = (cur.kind || 'photo') === 'video';

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(8,10,15,0.92)', zIndex: 70,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '14px 16px 8px', display: 'flex', alignItems: 'center', gap: 12,
        color: '#fff',
      }}>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{
          appearance: 'none', border: 0, background: 'rgba(255,255,255,0.12)',
          width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ic.Close size={18} color="#fff"/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cur.label || (isVideo ? 'Video' : 'Photo')}
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {idx + 1} of {photos.length}{cur.time ? ' · ' + cur.time : ''}{cur.by ? ' · ' + cur.by : ''}
          </div>
        </div>
      </div>

      {/* Main media */}
      <div onClick={(e) => e.stopPropagation()} style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        padding: '0 12px',
      }}>
        <div style={{ width: '100%', maxWidth: 480, aspectRatio: '4 / 5', position: 'relative' }}>
          <Photo
            seed={cur.seed || cur.id}
            kind={cur.kind || 'photo'}
            label={cur.label}
            durationSec={cur.durationSec}
            style={{ width: '100%', height: '100%', borderRadius: 14 }}
            rounded={14}
            showLabel={false}
          />
        </div>

        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)} aria-label="Previous" style={lbNav('left')}>
            <Ic.Back size={20} color="#fff"/>
          </button>
        )}
        {idx < photos.length - 1 && (
          <button onClick={() => setIdx(i => i + 1)} aria-label="Next" style={lbNav('right')}>
            <Ic.Chevron size={20} color="#fff"/>
          </button>
        )}
      </div>

      {/* Bottom strip */}
      <div onClick={(e) => e.stopPropagation()} style={{
        padding: '12px 14px 20px', display: 'flex', gap: 6, overflowX: 'auto',
      }}>
        {photos.map((p, i) => (
          <button key={p.id || i} onClick={() => setIdx(i)} style={{
            appearance: 'none', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', flexShrink: 0,
          }}>
            <Photo
              seed={p.seed || p.id}
              kind={p.kind || 'photo'}
              style={{
                width: 48, height: 48, borderRadius: 8,
                border: i === idx ? '2px solid #fff' : '0.5px solid rgba(255,255,255,0.25)',
                boxSizing: 'border-box', opacity: i === idx ? 1 : 0.7,
              }}
              rounded={8}
              showLabel={false}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function lbNav(side) {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 6, width: 36, height: 36, borderRadius: 12,
    background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', appearance: 'none',
  };
}

// ── Hook: light wrapper around lightbox open state ───────────────────────────
function useLightbox() {
  const [state, setState] = useMS({ open: false, photos: [], idx: 0 });
  return {
    state,
    open: (photos, idx = 0) => setState({ open: true, photos: photos || [], idx }),
    close: () => setState(s => ({ ...s, open: false })),
  };
}

// ── Photo-aware avatar: small square portrait tile for the animal ────────────
function AnimalPhoto({ animal, size = 44, t, rounded = 12, onClick }) {
  // Prefer the first admission photo if any; otherwise seed off id.
  const seed = (animal.photos && animal.photos[0] && (animal.photos[0].seed || animal.photos[0].id)) || animal.id;
  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onClick={onClick}>
      <Photo
        seed={seed}
        kind="photo"
        style={{ width: size, height: size, borderRadius: rounded }}
        rounded={rounded}
        showLabel={false}
      />
      {animal.aggressive && (
        <span title="Aggressive" style={{
          position: 'absolute', top: -3, right: -3,
          width: 14, height: 14, borderRadius: '50%',
          background: '#B42318', color: '#fff', fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid ' + (t?.surface || '#fff'),
        }}>!</span>
      )}
    </div>
  );
}

Object.assign(window, {
  Photo, HeroBanner, MediaStrip, MediaGrid, Lightbox, useLightbox, AnimalPhoto, hashSeed,
});
