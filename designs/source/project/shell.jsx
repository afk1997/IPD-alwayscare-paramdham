// shell.jsx — Theme, tokens, layout primitives, header & bottom nav.

const { useState, useEffect, useMemo, useRef } = React;

// ── Theme tokens ─────────────────────────────────────────────────────────────
const THEMES = {
  clinical: {
    name: 'Clinical',
    bg: '#F5F8FA',
    surface: '#FFFFFF',
    surface2: '#F0F4F7',
    line: '#E2E8EE',
    text: '#0F1B26',
    muted: '#5B6B7A',
    soft: '#90A0B0',
    accent: '#0E7C7B',
    accentSoft: '#D6EEEE',
    accentInk: '#0A5D5C',
    chipBg: '#EAF3F3',
    headerBg: '#FFFFFF',
    navBg: 'rgba(255,255,255,0.92)',
  },
  warm: {
    name: 'Warm',
    bg: '#FAF6F1',
    surface: '#FFFDF9',
    surface2: '#F2EBDF',
    line: '#E6DCCB',
    text: '#2A201A',
    muted: '#7A6A5C',
    soft: '#A89A88',
    accent: '#B5471A',
    accentSoft: '#F6E2D2',
    accentInk: '#8A3712',
    chipBg: '#F2E5D5',
    headerBg: '#FFFDF9',
    navBg: 'rgba(255,253,249,0.93)',
  },
  utility: {
    name: 'Utility',
    bg: '#0E1116',
    surface: '#171B22',
    surface2: '#1F242D',
    line: '#2A313C',
    text: '#E8ECF1',
    muted: '#9AA4B2',
    soft: '#6F7986',
    accent: '#5BE49B',
    accentSoft: '#1E3A2C',
    accentInk: '#A8F0C8',
    chipBg: '#22303A',
    headerBg: '#13171D',
    navBg: 'rgba(15,18,23,0.94)',
  },
};

const STATUS = {
  Critical:    { bg: '#FEE4E2', fg: '#B42318', dot: '#E14B4B', dark: { bg: '#3A1E22', fg: '#FECDCA', dot: '#F87171' } },
  Stable:      { bg: '#DCFAE6', fg: '#067647', dot: '#16A34A', dark: { bg: '#13321F', fg: '#A6F2C0', dot: '#34D399' } },
  Observation: { bg: '#FEF0C7', fg: '#93370D', dot: '#D97706', dark: { bg: '#3A2A0C', fg: '#FCD9A0', dot: '#FBBF24' } },
};

function statusColor(status, dark) {
  const s = STATUS[status] || STATUS.Observation;
  return dark ? s.dark : s;
}

window.THEMES = THEMES;
window.statusColor = statusColor;

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
function fmtDateTime(iso) { return iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '—'; }
function relTime(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}
function hoursSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

window.fmt = { time: fmtTime, date: fmtDate, dt: fmtDateTime, rel: relTime, hoursSince };

// ── Primitives ───────────────────────────────────────────────────────────────
function Pill({ children, bg, fg, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
      background: bg, color: fg, letterSpacing: '0.01em', ...style,
    }}>{children}</span>
  );
}

function StatusPill({ status, dark }) {
  const c = statusColor(status, dark);
  return (
    <Pill bg={c.bg} fg={c.fg}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot }} />
      {status}
    </Pill>
  );
}

function Card({ children, t, style, padded = true, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: t.surface, border: `0.5px solid ${t.line}`,
      borderRadius: 14, padding: padded ? 14 : 0,
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      ...style,
    }}>{children}</div>
  );
}

function Section({ label, children, action, t }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 16px 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted }}>{label}</div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', t, style, icon, type='button', disabled }) {
  const styles = {
    primary: { bg: t.accent, fg: '#fff', border: t.accent },
    soft:    { bg: t.accentSoft, fg: t.accentInk, border: 'transparent' },
    ghost:   { bg: 'transparent', fg: t.text, border: t.line },
    danger:  { bg: '#B42318', fg: '#fff', border: '#B42318' },
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      appearance: 'none', border: `1px solid ${styles.border}`, background: styles.bg, color: styles.fg,
      padding: '11px 16px', borderRadius: 12, fontWeight: 600, fontSize: 15,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      cursor: 'pointer', opacity: disabled ? 0.5 : 1,
      fontFamily: 'inherit',
      ...style,
    }}>{icon}{children}</button>
  );
}

function Field({ label, children, required, hint, t }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: t.muted, letterSpacing: '0.01em' }}>
        {label}{required && <span style={{ color: '#B42318' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: t.soft }}>{hint}</span>}
    </label>
  );
}

function Input({ value, onChange, placeholder, t, type='text', style, ...rest }) {
  return (
    <input value={value || ''} onChange={e => onChange(e.target.value)} type={type}
      placeholder={placeholder}
      style={{
        appearance: 'none', width: '100%', boxSizing: 'border-box',
        padding: '11px 13px', borderRadius: 11,
        border: `1px solid ${t.line}`, background: t.surface, color: t.text,
        fontSize: 15, fontFamily: 'inherit', outline: 'none',
        ...style,
      }} {...rest} />
  );
}

function Textarea({ value, onChange, placeholder, t, rows=3 }) {
  return (
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{
        appearance: 'none', width: '100%', boxSizing: 'border-box',
        padding: '11px 13px', borderRadius: 11,
        border: `1px solid ${t.line}`, background: t.surface, color: t.text,
        fontSize: 15, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
      }} />
  );
}

function Select({ value, onChange, options, t, placeholder }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={{
        appearance: 'none', width: '100%', boxSizing: 'border-box',
        padding: '11px 32px 11px 13px', borderRadius: 11,
        border: `1px solid ${t.line}`, background: t.surface, color: value ? t.text : t.soft,
        fontSize: 15, fontFamily: 'inherit', outline: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M0 0h12L6 8z' fill='%2390A0B0'/></svg>")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
      }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ value, onChange, t }) {
  return (
    <button onClick={() => onChange(!value)} type="button" style={{
      appearance:'none', border:0, padding:0,
      width: 44, height: 26, borderRadius: 999,
      background: value ? t.accent : t.line, position: 'relative', cursor: 'pointer',
      transition: 'background .15s',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: value ? 20 : 2,
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s',
      }} />
    </button>
  );
}

function Segmented({ value, onChange, options, t }) {
  return (
    <div style={{
      display: 'flex', background: t.surface2, borderRadius: 10, padding: 3, position: 'relative',
      border: `0.5px solid ${t.line}`,
    }}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const active = value === v;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} style={{
            appearance:'none', border:0, flex: 1, padding: '7px 10px', borderRadius: 7,
            background: active ? t.surface : 'transparent', color: active ? t.text : t.muted,
            fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
          }}>{l}</button>
        );
      })}
    </div>
  );
}

function Chip({ children, active, onClick, t, icon }) {
  return (
    <button onClick={onClick} type="button" style={{
      appearance:'none', cursor:'pointer', fontFamily:'inherit',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600,
      background: active ? t.accent : t.chipBg, color: active ? '#fff' : t.text,
      border: `1px solid ${active ? t.accent : 'transparent'}`,
      whiteSpace: 'nowrap',
    }}>{icon}{children}</button>
  );
}

function Avatar({ animal, size = 44, t }) {
  // Prefer admission/proof photo if any; fall back to seed off animal id.
  const seed = (animal.photos && animal.photos[0] && (animal.photos[0].seed || animal.photos[0].id)) || animal.id || animal.name;
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.max(8, size * 0.27), flexShrink: 0,
      position: 'relative', overflow: 'hidden', border: `0.5px solid ${t.line}`,
      background: t.surface2,
    }}>
      {typeof Photo !== 'undefined' ? (
        <Photo seed={seed} kind="photo"
          style={{ width: '100%', height: '100%', borderRadius: Math.max(8, size * 0.27) }}
          rounded={Math.max(8, size * 0.27)} showLabel={false}/>
      ) : (
        <div style={{ width:'100%', height:'100%', background: animal.photo || t.surface2 }}/>
      )}
      {animal.aggressive && (
        <span title="Aggressive" style={{
          position: 'absolute', top: -3, right: -3,
          width: 14, height: 14, borderRadius: '50%',
          background: '#B42318', color: '#fff', fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid ' + t.surface,
        }}>!</span>
      )}
    </div>
  );
}

// ── Top Header ───────────────────────────────────────────────────────────────
function Header({ title, t, back, right, subtitle, big }) {
  const mobile = window.UI_MODE === 'mobile';
  if (mobile) {
    // Mobile: sticky sub-header inside the iOS frame
    return (
      <div style={{
        background: t.headerBg, borderBottom: `0.5px solid ${t.line}`,
        padding: '8px 14px 12px',
        position: 'sticky', top: 0, zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 36 }}>
          {back ? (
            <button onClick={back} style={{
              appearance:'none', border:0, background:'transparent', padding: '6px 8px 6px 0',
              color: t.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
              fontSize: 16, fontFamily: 'inherit', fontWeight: 500,
            }}>
              <Ic.Back size={20} stroke={2} />
              <span style={{ marginLeft: 0 }}>Back</span>
            </button>
          ) : <div style={{ width: 8 }} />}
          <div style={{ flex: 1 }} />
          {right}
        </div>
        {big && (
          <div style={{ fontSize: 28, fontWeight: 700, color: t.text, letterSpacing: '-0.01em', marginTop: 6 }}>
            {title}
            {subtitle && <div style={{ fontSize: 13, fontWeight: 500, color: t.muted, marginTop: 2, letterSpacing: 0 }}>{subtitle}</div>}
          </div>
        )}
        {!big && title && (
          <div style={{
            position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center',
            fontSize: 16, fontWeight: 600, color: t.text, pointerEvents: 'none',
          }}>{title}</div>
        )}
      </div>
    );
  }
  // Web: generous page header, not sticky (TopBar handles that). Ignores `right` —
  // role badge etc. live in the sidebar in web mode.
  return (
    <div style={{
      padding: '28px 28px 16px',
      display: 'flex', alignItems: 'flex-end', gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {big ? (
          <>
            <div style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: 30, fontWeight: 700, color: t.text,
              letterSpacing: '-0.02em', lineHeight: 1.1,
            }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 13.5, fontWeight: 500, color: t.muted, marginTop: 6, letterSpacing: 0 }}>
                {subtitle}
              </div>
            )}
          </>
        ) : title && (
          <div style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: '-0.01em',
          }}>{title}</div>
        )}
      </div>
    </div>
  );
}

// ── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ screen, go, t, onAdd }) {
  const tabs = [
    { id: 'home',    label: 'Today',   icon: Ic.Home },
    { id: 'animals', label: 'Patients', icon: Ic.Paw },
    { id: 'add',     label: '',        icon: Ic.Plus, fab: true },
    { id: 'reports', label: 'Reports', icon: Ic.Chart },
    { id: 'docs',    label: 'Docs',    icon: Ic.Doc },
  ];
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0,
      background: t.navBg,
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderTop: `0.5px solid ${t.line}`,
      paddingBottom: 22, paddingTop: 6,
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
      zIndex: 30,
      paddingBottom: 'max(22px, env(safe-area-inset-bottom))',
    }}>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const active = screen === tab.id;
        if (tab.fab) {
          return (
            <button key={tab.id} onClick={onAdd} style={{
              appearance:'none', border:0, cursor:'pointer',
              width: 52, height: 52, borderRadius: '50%', background: t.accent,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 6px 18px ${t.accent}66, 0 0 0 4px ${t.surface}`,
              marginTop: -22, fontFamily: 'inherit',
            }}>
              <Icon size={26} stroke={2.4} />
            </button>
          );
        }
        return (
          <button key={tab.id} onClick={() => go(tab.id)} style={{
            appearance:'none', border:0, background:'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: active ? t.accent : t.soft, padding: '6px 10px', flex: 1, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            <Icon size={22} stroke={active ? 2.2 : 1.8} />
            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.01em' }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Add menu (sheet that pops on FAB) ────────────────────────────────────────
function AddSheet({ open, onClose, t, go }) {
  if (!open) return null;
  const items = [
    { label: 'New admission',  sub: 'Register an animal into IPD', icon: Ic.Plus,   to: 'admission' },
    { label: 'Log activity',   sub: 'Treatment, round, food, surgery…', icon: Ic.Pill, to: 'pickAnimalForActivity' },
    { label: 'Upload document',sub: 'Reports, consent, ownership',  icon: Ic.Upload, to: 'pickAnimalForDoc' },
    { label: 'Mark discharge / death', sub: 'End-of-stay flow',     icon: Ic.Discharge, to: 'pickAnimalForExit' },
  ];
  const mobile = window.UI_MODE === 'mobile';

  if (mobile) {
    // Mobile bottom sheet
    return (
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(8,10,15,0.45)', zIndex: 40,
        display:'flex', alignItems:'flex-end',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width:'100%', background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: '8px 12px 30px',
          animation: 'slideUp 0.25s cubic-bezier(.2,.7,.3,1)',
        }}>
          <div style={{ width: 38, height: 4, background: t.line, borderRadius: 2, margin: '8px auto 14px' }} />
          <div style={{ padding: '0 6px 6px', fontSize: 18, fontWeight: 700, color: t.text }}>Quick add</div>
          {items.map(it => {
            const Icon = it.icon;
            return (
              <button key={it.to} onClick={() => { onClose(); go(it.to); }} style={{
                appearance:'none', border:0, background:'transparent', width:'100%',
                padding: '14px 10px', display:'flex', alignItems:'center', gap: 14,
                borderBottom: `0.5px solid ${t.line}`, cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: t.accentSoft, color: t.accentInk,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0,
                }}>
                  <Icon size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{it.label}</div>
                  <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>{it.sub}</div>
                </div>
                <Ic.Chevron size={16} color={t.soft} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Web centered modal
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(8,10,15,0.42)', zIndex: 100,
      display:'flex', alignItems:'center', justifyContent:'center',
      animation: 'fadeIn 0.15s ease-out', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', maxWidth: 460, background: t.surface,
        borderRadius: 16, border: `1px solid ${t.line}`,
        padding: '6px 8px 14px',
        animation: 'modalIn 0.18s cubic-bezier(.2,.7,.3,1)',
        boxShadow: '0 12px 40px rgba(8,10,15,0.18), 0 4px 12px rgba(8,10,15,0.08)',
      }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding: '14px 14px 10px',
        }}>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 17, fontWeight: 700, color: t.text,
          }}>New entry</div>
          <button onClick={onClose} style={{
            appearance:'none', border:0, background:'transparent', cursor:'pointer',
            width: 30, height: 30, borderRadius: 7,
            display:'flex', alignItems:'center', justifyContent:'center', color: t.muted,
          }}><Ic.Close size={16}/></button>
        </div>
        {items.map(it => {
          const Icon = it.icon;
          return (
            <button key={it.to} onClick={() => { onClose(); go(it.to); }} style={{
              appearance:'none', border:0, background:'transparent', width:'100%',
              padding: '12px 12px', display:'flex', alignItems:'center', gap: 13,
              borderRadius: 10,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}
              onMouseOver={e => e.currentTarget.style.background = t.surface2}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: t.accentSoft, color: t.accentInk,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0,
              }}>
                <Icon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text }}>{it.label}</div>
                <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>{it.sub}</div>
              </div>
              <Ic.Chevron size={14} color={t.soft} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Role switcher (top-right of header on home) ──────────────────────────────
function RoleBadge({ t, onClick }) {
  const role = IPD.state.role;
  const name = IPD.state.me[role];
  const label = { staff: 'Staff', doctor: 'Doctor', admin: 'Admin' }[role];
  return (
    <button onClick={onClick} style={{
      appearance:'none', border:`0.5px solid ${t.line}`, background:t.surface,
      padding:'6px 10px 6px 6px', borderRadius:999, display:'flex', alignItems:'center', gap:8,
      cursor:'pointer', fontFamily:'inherit',
    }}>
      <div style={{
        width:26, height:26, borderRadius:'50%', background:t.accentSoft, color:t.accentInk,
        display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12,
      }}>{name.split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
      <div style={{ textAlign:'left' }}>
        <div style={{ fontSize:11, color:t.muted, lineHeight:1 }}>{label}</div>
        <div style={{ fontSize:12.5, color:t.text, fontWeight:600, lineHeight:1.2 }}>{name.split('(')[0].trim()}</div>
      </div>
      <Ic.Chevron size={12} color={t.soft} style={{ transform:'rotate(90deg)' }} />
    </button>
  );
}

function RoleSheet({ open, onClose, t }) {
  if (!open) return null;
  const roles = [
    { id: 'staff',  label: 'Floor staff', sub: 'Logs activities, food, baths',     icon: Ic.User },
    { id: 'doctor', label: 'Doctor',      sub: 'Rounds, diagnoses, surgery',       icon: Ic.Steth },
    { id: 'admin',  label: 'Reception / admin', sub: 'Admissions, discharge, docs',icon: Ic.Doc },
  ];
  const cur = IPD.state.role;
  const mobile = window.UI_MODE === 'mobile';

  if (mobile) {
    return (
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(8,10,15,0.45)', zIndex: 40,
        display:'flex', alignItems:'flex-end',
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          width:'100%', background:t.surface, borderTopLeftRadius:22, borderTopRightRadius:22,
          padding:'8px 12px 30px',
        }}>
          <div style={{ width:38, height:4, background:t.line, borderRadius:2, margin:'8px auto 14px' }}/>
          <div style={{ padding:'0 6px 6px', fontSize:18, fontWeight:700, color:t.text }}>Switch role</div>
          <div style={{ padding:'0 6px 12px', fontSize:12.5, color:t.muted }}>Demo only — surfaces different actions and shortcuts.</div>
          {roles.map(r => {
            const I = r.icon; const active = cur === r.id;
            return (
              <button key={r.id} onClick={() => { IPD.setRole(r.id); onClose(); }} style={{
                appearance:'none', border:0, background:'transparent', width:'100%',
                padding:'12px 10px', display:'flex', alignItems:'center', gap:14,
                borderBottom:`0.5px solid ${t.line}`, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
              }}>
                <div style={{
                  width:38, height:38, borderRadius:10,
                  background: active ? t.accent : t.surface2,
                  color: active ? '#fff' : t.muted,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}><I size={20}/></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:600, color:t.text }}>{r.label}</div>
                  <div style={{ fontSize:12.5, color:t.muted }}>{r.sub}</div>
                </div>
                {active && <Ic.Check size={18} color={t.accent} stroke={2.2} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(8,10,15,0.42)', zIndex: 100,
      display:'flex', alignItems:'center', justifyContent:'center',
      animation: 'fadeIn 0.15s ease-out', padding: 20,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:'100%', maxWidth: 460, background:t.surface,
        borderRadius:16, border:`1px solid ${t.line}`,
        padding:'6px 8px 14px',
        animation:'modalIn 0.18s cubic-bezier(.2,.7,.3,1)',
        boxShadow: '0 12px 40px rgba(8,10,15,0.18), 0 4px 12px rgba(8,10,15,0.08)',
      }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 14px 4px',
        }}>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontSize:17, fontWeight:700, color:t.text,
          }}>Switch role</div>
          <button onClick={onClose} style={{
            appearance:'none', border:0, background:'transparent', cursor:'pointer',
            width: 30, height: 30, borderRadius: 7,
            display:'flex', alignItems:'center', justifyContent:'center', color: t.muted,
          }}><Ic.Close size={16}/></button>
        </div>
        <div style={{ padding:'0 14px 10px', fontSize:12.5, color:t.muted }}>Demo only — surfaces different actions and shortcuts.</div>
        {roles.map(r => {
          const I = r.icon; const active = cur === r.id;
          return (
            <button key={r.id} onClick={() => { IPD.setRole(r.id); onClose(); }} style={{
              appearance:'none', border:0, background:'transparent', width:'100%',
              padding:'10px 12px', display:'flex', alignItems:'center', gap:13,
              cursor:'pointer', fontFamily:'inherit', textAlign:'left', borderRadius: 10,
            }}
              onMouseOver={e => e.currentTarget.style.background = t.surface2}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{
                width:36, height:36, borderRadius:10,
                background: active ? t.accent : t.surface2,
                color: active ? '#fff' : t.muted,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}><I size={18}/></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:t.text }}>{r.label}</div>
                <div style={{ fontSize:12.5, color:t.muted }}>{r.sub}</div>
              </div>
              {active && <Ic.Check size={18} color={t.accent} stroke={2.2} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Expose
Object.assign(window, {
  Pill, StatusPill, Card, Section, Btn, Field, Input, Textarea, Select, Toggle,
  Segmented, Chip, Avatar, Header, BottomNav, AddSheet, RoleBadge, RoleSheet,
});
