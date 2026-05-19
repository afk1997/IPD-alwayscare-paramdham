// web-shell.jsx — Responsive desktop web shell: SideNav + TopBar + content.
// At narrow viewports the sidebar collapses into a slide-out drawer with a
// hamburger trigger in the top bar.

const { useState: useStateWS, useEffect: useEffectWS } = React;

const MOBILE_BREAKPOINT = 760;

// ── Brand mark (used in the sidebar and the narrow-mode top bar) ────────────
function BrandMark({ size = 28, color = '#fff', accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" style={{ display: 'block' }}>
      <rect width="88" height="88" rx="20" fill={accent}/>
      <circle cx="32" cy="42" r="6" fill={color}/>
      <circle cx="44" cy="36" r="6" fill={color}/>
      <circle cx="56" cy="42" r="6" fill={color}/>
      <circle cx="38" cy="50" r="5" fill={color}/>
      <circle cx="50" cy="50" r="5" fill={color}/>
      <path d="M34 60 C34 54 38 50 44 50 C50 50 54 54 54 60 C54 66 50 70 44 70 C38 70 34 66 34 60 Z" fill={color}/>
    </svg>
  );
}

function useViewport() {
  const [w, setW] = useStateWS(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffectWS(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return { w, narrow: w < MOBILE_BREAKPOINT };
}

// ── Side nav body — used both as fixed rail and as drawer content ───────────
function SideNavBody({ active, go, t, onAdd, onOpenRole, onItemClick }) {
  const items = [
    { id: 'home',    label: 'Today',     icon: Ic.Home,  badge: null },
    { id: 'animals', label: 'Patients',  icon: Ic.Paw,   badge: IPD.state.animals.length },
    { id: 'reports', label: 'Reports',   icon: Ic.Chart, badge: null },
    { id: 'docs',    label: 'Documents', icon: Ic.Doc,   badge: null },
  ];
  const role = IPD.state.role;
  const name = IPD.state.me[role];
  const roleLabel = { staff: 'Floor staff', doctor: 'Doctor', admin: 'Reception' }[role];
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('');

  const handle = (id) => { onItemClick && onItemClick(); go(id); };

  return (
    <>
      <div style={{ padding: '20px 18px 24px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <BrandMark size={30} accent={t.accent}/>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontWeight: 800, fontSize: 15, color: t.text, letterSpacing: '-0.01em',
          }}>Arham</span>
          <span style={{ fontSize: 11, color: t.muted, fontWeight: 500, marginTop: 2 }}>
            Always Care · IPD
          </span>
        </div>
      </div>

      <div style={{ padding: '0 14px 16px' }}>
        <button onClick={() => { onItemClick && onItemClick(); onAdd(); }} style={{
          appearance: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit',
          width: '100%', padding: '9px 12px', borderRadius: 10,
          background: t.accent, color: '#fff', fontWeight: 600, fontSize: 13.5,
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
          boxShadow: `0 1px 2px ${t.accent}33`,
        }}>
          <Ic.Plus size={16} stroke={2.4}/>
          New entry
        </button>
      </div>

      <nav style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: t.soft, padding: '4px 12px 8px',
        }}>Workspace</div>
        {items.map(it => {
          const I = it.icon;
          const isActive = it.id === active;
          return (
            <button key={it.id} onClick={() => handle(it.id)} style={{
              appearance: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit',
              padding: '9px 12px', borderRadius: 9,
              display: 'flex', alignItems: 'center', gap: 11,
              background: isActive ? t.accentSoft : 'transparent',
              color: isActive ? t.accentInk : t.text,
              fontWeight: isActive ? 600 : 500, fontSize: 13.5,
              textAlign: 'left',
            }}>
              <I size={17} stroke={isActive ? 2.2 : 1.8} color={isActive ? t.accentInk : t.muted}/>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge != null && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: isActive ? t.accentInk : t.muted,
                  background: isActive ? 'rgba(255,255,255,0.5)' : t.surface2,
                  padding: '1px 7px', borderRadius: 999,
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <button onClick={() => { onItemClick && onItemClick(); onOpenRole(); }} style={{
        appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
        margin: 12, padding: '10px 12px', borderRadius: 10,
        background: t.surface2, border: `1px solid ${t.line}`,
        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: t.accentSoft, color: t.accentInk,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 12,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name.split('(')[0].trim()}
          </div>
          <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>{roleLabel}</div>
        </div>
        <Ic.Chevron size={13} color={t.soft} style={{ transform: 'rotate(-90deg)' }}/>
      </button>
    </>
  );
}

// ── Side nav rail ───────────────────────────────────────────────────────────
function SideNav(props) {
  return (
    <aside style={{
      width: 232, flexShrink: 0,
      borderRight: `1px solid ${props.t.line}`,
      background: props.t.surface,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      <SideNavBody {...props}/>
    </aside>
  );
}

// ── Side nav drawer (mobile overlay) ────────────────────────────────────────
function SideNavDrawer({ open, onClose, ...rest }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(8,10,15,0.45)', zIndex: 90,
      animation: 'fadeIn 0.15s ease-out',
    }}>
      <aside onClick={e => e.stopPropagation()} style={{
        width: 260, maxWidth: '85vw', height: '100%',
        background: rest.t.surface, borderRight: `1px solid ${rest.t.line}`,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInLeft 0.22s cubic-bezier(.2,.7,.3,1)',
        boxShadow: '12px 0 40px rgba(8,10,15,0.18)',
      }}>
        <SideNavBody {...rest} onItemClick={onClose}/>
      </aside>
    </div>
  );
}

// ── Top bar ─────────────────────────────────────────────────────────────────
function TopBar({ t, breadcrumb, back, onSearch, search, onMenu, narrow, onAdd }) {
  return (
    <header style={{
      height: narrow ? 52 : 56, flexShrink: 0,
      borderBottom: `1px solid ${t.line}`,
      background: t.headerBg,
      display: 'flex', alignItems: 'center', gap: narrow ? 8 : 14,
      padding: narrow ? '0 14px' : '0 22px',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      {/* Hamburger / brand on narrow */}
      {narrow && (
        <button onClick={onMenu} aria-label="Menu" style={{
          appearance: 'none', border: 0, background: 'transparent',
          width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.text, flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M4 12h16M4 17h16"/>
          </svg>
        </button>
      )}

      {narrow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <BrandMark size={22} accent={t.accent}/>
          <span style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontWeight: 700, fontSize: 14, color: t.text, letterSpacing: '-0.01em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {(breadcrumb && breadcrumb[breadcrumb.length - 1]?.label) || 'Arham'}
          </span>
        </div>
      )}

      {!narrow && back && (
        <button onClick={back} style={{
          appearance: 'none', border: `1px solid ${t.line}`, background: t.surface,
          color: t.text, padding: '6px 10px 6px 8px', borderRadius: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
          fontSize: 13, fontWeight: 500,
        }}>
          <Ic.Back size={15}/> Back
        </button>
      )}

      {!narrow && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, minWidth: 0,
        }}>
          {(breadcrumb || []).map((c, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: t.soft }}>/</span>}
                {!isLast && c.onClick ? (
                  <button onClick={c.onClick} style={{
                    appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, color: t.muted,
                    padding: 0,
                  }}>{c.label}</button>
                ) : (
                  <span style={{
                    color: isLast ? t.text : t.muted,
                    fontWeight: isLast ? 600 : 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{c.label}</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {!narrow && <div style={{ flex: 1 }}/>}

      {/* Search — full input on desktop, icon on narrow */}
      {!narrow ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px 6px 12px', borderRadius: 9,
          background: t.surface2, border: `1px solid ${t.line}`,
          width: 320, maxWidth: '40vw',
        }}>
          <Ic.Search size={14} color={t.soft}/>
          <input
            value={search || ''}
            onChange={e => onSearch && onSearch(e.target.value)}
            placeholder="Search patients, activities…"
            style={{
              appearance: 'none', border: 0, background: 'transparent', outline: 'none',
              flex: 1, fontFamily: 'inherit', fontSize: 13, color: t.text,
              minWidth: 0,
            }}/>
          <kbd style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10, fontWeight: 500, color: t.soft,
            background: t.surface, padding: '1px 5px', borderRadius: 4,
            border: `1px solid ${t.line}`,
          }}>⌘K</kbd>
        </div>
      ) : (
        <button aria-label="Search" style={{
          appearance: 'none', border: 0, background: 'transparent',
          width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted,
        }}>
          <Ic.Search size={16}/>
        </button>
      )}

      {/* Add (narrow only — primary action moves into the top bar) */}
      {narrow && (
        <button onClick={onAdd} aria-label="New entry" style={{
          appearance: 'none', border: 0, background: t.accent, color: '#fff',
          width: 36, height: 36, borderRadius: 9, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 1px 2px ${t.accent}33`,
        }}>
          <Ic.Plus size={17} stroke={2.4}/>
        </button>
      )}

      {/* Bell */}
      <button title="Notifications" style={{
        appearance: 'none', border: `1px solid ${t.line}`, background: t.surface,
        width: narrow ? 36 : 34, height: narrow ? 36 : 34, borderRadius: 9, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted,
        position: 'relative',
      }}>
        <Ic.Bell size={16}/>
        <span style={{
          position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%',
          background: '#E14B4B', border: `1.5px solid ${t.surface}`,
        }}/>
      </button>
    </header>
  );
}

// ── Outer shell — orchestrates SideNav + TopBar + content ──────────────────
function WebShell({ t, sideNavActive, go, onAdd, onOpenRole, breadcrumb, back, search, onSearch, children }) {
  const { narrow } = useViewport();
  const [drawerOpen, setDrawerOpen] = useStateWS(false);

  // Close drawer when we cross the breakpoint
  useEffectWS(() => { if (!narrow) setDrawerOpen(false); }, [narrow]);

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', width: '100%',
      background: t.bg, color: t.text,
      fontFamily: 'inherit',
      position: 'relative',
    }}>
      {!narrow && (
        <SideNav active={sideNavActive} go={go} t={t} onAdd={onAdd} onOpenRole={onOpenRole}/>
      )}
      <SideNavDrawer
        open={narrow && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        active={sideNavActive} go={go} t={t} onAdd={onAdd} onOpenRole={onOpenRole}/>
      <main style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden',
      }}>
        <TopBar
          t={t}
          breadcrumb={breadcrumb} back={back}
          search={search} onSearch={onSearch}
          narrow={narrow}
          onMenu={() => setDrawerOpen(true)}
          onAdd={onAdd}/>
        <div style={{
          flex: 1, overflow: 'auto',
          background: t.bg,
        }}>
          <div style={{
            maxWidth: 1040, margin: '0 auto',
            padding: narrow ? '0 0 60px' : '0 28px 60px',
          }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { SideNav, TopBar, WebShell, BrandMark });
