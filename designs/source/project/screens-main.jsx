// screens-main.jsx — Dashboard, Animal list, Animal detail (+ activity feed)

const { useState: useStateM, useMemo: useMemoM, useEffect: useEffectM } = React;

// ── Activity rendering helpers ───────────────────────────────────────────────
const ACT_META = {
  admission:  { label: 'Admitted',     color: '#0E7C7B', icon: Ic.Plus },
  treatment:  { label: 'Treatment',    color: '#2563EB', icon: Ic.Pill },
  round:      { label: 'Doctor round', color: '#7C3AED', icon: Ic.Steth },
  diagnostic: { label: 'Diagnostic',   color: '#0891B2', icon: Ic.Microscope },
  surgery:    { label: 'Surgery',      color: '#B5471A', icon: Ic.Surgery },
  food:       { label: 'Food & water', color: '#15803D', icon: Ic.Bowl },
  bath:       { label: 'Bath / grooming', color: '#0EA5E9', icon: Ic.Soap },
  walk:       { label: 'Walk',         color: '#A16207', icon: Ic.Walk },
};
window.ACT_META = ACT_META;

function activitySummary(a) {
  switch (a.type) {
    case 'admission':
      return a.summary || 'Admitted';
    case 'treatment':
      if (!a.meds || a.meds.length === 0) return a.remarks || 'Treatment given';
      return a.meds.map(m => `${m.name} ${m.dose} ${m.route}`).join(', ');
    case 'round':
      return `Temp ${a.temp}°F · Pain ${a.pain} · ${a.progress || 'noted'}`;
    case 'diagnostic':
      return (a.tests || []).join(', ') + (a.findings ? ' — ' + a.findings : '');
    case 'surgery':
      return `${a.surgeryName} (${a.duration}) — ${a.surgeon}`;
    case 'food':
      return `${a.foodType} · ${a.qty} · ${a.intake}${a.vomiting ? ' · vomited' : ''}`;
    case 'bath':
      return `${a.bathType}${a.remarks ? ' — ' + a.remarks : ''}`;
    case 'walk':
      return `${a.duration}${a.urination ? ' · urination ✓' : ''}${a.stool ? ' · stool ✓' : ''} · ${a.mobility}`;
    default:
      return a.summary || 'Activity';
  }
}
window.activitySummary = activitySummary;

// ── Dashboard / Today Summary ────────────────────────────────────────────────
function DashboardScreen({ t, density, dashLayout, onOpenRole, go }) {
  const animals = IPD.state.animals;
  const acts = IPD.state.activities;
  const today = useMemoM(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }, []);

  const admissionsToday = animals.filter(a => new Date(a.admittedAt) >= today);
  const surgeriesToday  = acts.filter(a => a.type === 'surgery' && new Date(a.at) >= today);
  const critical        = animals.filter(a => a.status === 'Critical');
  const noUpdate6h      = animals.filter(a => fmt.hoursSince(IPD.lastActivityAt(a.id)) >= 6);
  const dischargesToday = IPD.state.historic.dischargesToday;
  const deathsToday     = IPD.state.historic.deathsToday;

  const compact = density === 'compact';

  // STATS row
  const stats = [
    { label: 'Admissions',     value: admissionsToday.length, icon: Ic.Plus,       color: t.accent, tint: t.accentSoft },
    { label: 'Surgeries',      value: surgeriesToday.length,  icon: Ic.Surgery,    color: '#B5471A', tint: '#F6E2D2' },
    { label: 'Discharges',     value: dischargesToday,        icon: Ic.Discharge,  color: '#15803D', tint: '#DCFAE6' },
    { label: 'Deaths',         value: deathsToday,            icon: Ic.Death,      color: '#5B6B7A', tint: '#E2E8EE' },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      <Header t={t} big title="Today" subtitle={new Date().toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long' })}
        right={<RoleBadge t={t} onClick={onOpenRole} />} />

      {/* 1. Stats grid */}
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {stats.map(s => {
            const I = s.icon;
            return (
              <Card key={s.label} t={t} padded={false} style={{ padding: compact ? 11 : 14 }}>
                <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, background: s.tint, color: s.color,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0,
                  }}><I size={18} stroke={2}/></div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: t.text, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 3 }}>{s.label}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 2. Critical & 6h-no-update — combined attention list */}
      <Section t={t} label={`Needs attention · ${critical.length + noUpdate6h.length}`}
        action={<button onClick={() => go('animals', { filter: 'attention' })} style={{
          appearance:'none', border:0, background:'transparent', color:t.accent, fontSize:13, fontWeight:600,
          padding:'0 16px 0 0', cursor:'pointer', fontFamily:'inherit',
        }}>See all ›</button>}>
        <div style={{ display:'flex', flexDirection:'column', gap: 8, padding: '0 14px' }}>
          {critical.map(a => <AttentionRow key={a.id} animal={a} reason="critical" t={t} dark={t.bg.startsWith('#0')} onClick={() => go('animal', { id: a.id })}/>)}
          {noUpdate6h.filter(a => a.status !== 'Critical').slice(0, 3).map(a =>
            <AttentionRow key={a.id} animal={a} reason="stale" t={t} dark={t.bg.startsWith('#0')} onClick={() => go('animal', { id: a.id })}/>
          )}
          {critical.length === 0 && noUpdate6h.length === 0 && (
            <div style={{ padding:'18px 14px', textAlign:'center', color: t.muted, fontSize:13.5 }}>
              All animals updated within last 6h. Nothing critical.
            </div>
          )}
        </div>
      </Section>

      {/* 3. Today's admissions */}
      {admissionsToday.length > 0 && (
        <Section t={t} label={`Admitted today · ${admissionsToday.length}`}>
          <div style={{ padding:'0 14px', display:'flex', flexDirection:'column', gap: 8 }}>
            {admissionsToday.map(a => (
              <Card key={a.id} t={t} onClick={() => go('animal', { id: a.id })} style={{ display:'flex', alignItems:'center', gap: 12, cursor:'pointer' }}>
                <Avatar animal={a} t={t} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:t.text }}>{a.name}</div>
                    <StatusPill status={a.status} dark={t.bg.startsWith('#0')}/>
                  </div>
                  <div style={{ fontSize:12.5, color:t.muted, marginTop: 2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.complaint}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink: 0 }}>
                  <div style={{ fontSize:12, color:t.soft }}>{fmt.time(a.admittedAt)}</div>
                  <div style={{ fontSize:11, color:t.muted, marginTop:2 }}>{a.ward}</div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* 4. Quick actions for role */}
      <Section t={t} label="Quick actions">
        <div style={{ padding:'0 14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
          <QuickAction t={t} icon={Ic.Plus} label="New admission" onClick={() => go('admission')} />
          <QuickAction t={t} icon={Ic.Pill} label="Log treatment" onClick={() => go('pickAnimalForActivity', { preselect: 'treatment' })} />
          <QuickAction t={t} icon={Ic.Steth} label="Doctor round" onClick={() => go('pickAnimalForActivity', { preselect: 'round' })} />
          <QuickAction t={t} icon={Ic.Bowl} label="Food & water" onClick={() => go('pickAnimalForActivity', { preselect: 'food' })} />
        </div>
      </Section>
    </div>
  );
}

function QuickAction({ t, icon: I, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      appearance:'none', border:`0.5px solid ${t.line}`, background:t.surface,
      padding:'12px', borderRadius:14, display:'flex', alignItems:'center', gap:10,
      cursor:'pointer', fontFamily:'inherit', textAlign:'left',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, background: t.accentSoft, color: t.accentInk,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}><I size={17}/></div>
      <div style={{ fontSize:13.5, fontWeight:600, color:t.text }}>{label}</div>
    </button>
  );
}

function AttentionRow({ animal, reason, t, dark, onClick }) {
  const lastAt = IPD.lastActivityAt(animal.id);
  const hrs = fmt.hoursSince(lastAt);
  const isCritical = reason === 'critical';
  const accent = isCritical ? '#B42318' : '#D97706';
  const tint   = isCritical ? '#FEE4E2' : '#FEF0C7';
  return (
    <Card t={t} onClick={onClick} style={{
      cursor:'pointer', display:'flex', alignItems:'center', gap:12,
      borderLeft: `3px solid ${accent}`, paddingLeft: 11,
    }}>
      <Avatar animal={animal} t={t}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ fontSize:15, fontWeight:600, color:t.text }}>{animal.name}</div>
          <span style={{ fontSize:12, color:t.muted }}>{animal.ward}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
          <Pill bg={tint} fg={accent}>
            {isCritical ? '● Critical' : `${Math.floor(hrs)}h no update`}
          </Pill>
          {animal.contagious && <Pill bg="#FEE4E2" fg="#B42318">Contagious</Pill>}
        </div>
      </div>
      <Ic.Chevron size={16} color={t.soft} />
    </Card>
  );
}

// ── Animal list ──────────────────────────────────────────────────────────────
function AnimalListScreen({ t, go, filter }) {
  const [q, setQ] = useStateM('');
  const [statusF, setStatusF] = useStateM(filter === 'attention' ? 'all' : 'all');
  const [species, setSpecies] = useStateM('All');
  const animals = IPD.state.animals;
  const filtered = animals.filter(a => {
    if (statusF !== 'all' && a.status !== statusF) return false;
    if (species !== 'All' && a.species !== species) return false;
    if (q) {
      const Q = q.toLowerCase();
      if (!a.name.toLowerCase().includes(Q) && !a.breed.toLowerCase().includes(Q) && !(a.ward||'').toLowerCase().includes(Q)) return false;
    }
    if (filter === 'attention') {
      if (a.status !== 'Critical' && fmt.hoursSince(IPD.lastActivityAt(a.id)) < 6) return false;
    }
    return true;
  });

  return (
    <div style={{ paddingBottom: 100 }}>
      <Header t={t} big title="Patients" subtitle={`${animals.length} animals in IPD`}
        right={<button onClick={() => go('admission')} style={{
          appearance:'none', border:0, background:t.accent, color:'#fff',
          padding:'8px 12px', borderRadius:999, fontFamily:'inherit',
          fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:5, cursor:'pointer',
        }}><Ic.Plus size={14} stroke={2.6}/> Admit</button>}/>

      <div style={{ padding: '10px 14px 0' }}>
        <div style={{ position:'relative' }}>
          <Ic.Search size={17} color={t.soft} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}/>
          <Input t={t} value={q} onChange={setQ} placeholder="Search name, breed, ward" style={{ paddingLeft: 38 }}/>
        </div>
      </div>

      <div style={{ padding: '10px 14px', display:'flex', gap:8, overflowX:'auto' }}>
        {['all','Critical','Stable','Observation'].map(s => (
          <Chip key={s} active={statusF===s} onClick={() => setStatusF(s)} t={t}>
            {s === 'all' ? 'All' : s}
          </Chip>
        ))}
        <div style={{ width:1, background:t.line, alignSelf:'stretch', margin:'2px 2px' }}/>
        {['All','Dog','Cat','Cow','Bird'].map(s => (
          <Chip key={s} active={species===s} onClick={() => setSpecies(s)} t={t}>{s}</Chip>
        ))}
      </div>

      <div style={{ padding:'0 14px', display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.map(a => <AnimalRow key={a.id} animal={a} t={t} onClick={() => go('animal',{id:a.id})}/>)}
        {filtered.length === 0 && (
          <div style={{ padding:'40px 14px', textAlign:'center', color:t.muted, fontSize:14 }}>
            No animals match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

function AnimalRow({ animal, t, onClick }) {
  const lastAt = IPD.lastActivityAt(animal.id);
  const hrs = fmt.hoursSince(lastAt);
  const stale = hrs >= 6;
  return (
    <Card t={t} onClick={onClick} style={{ cursor:'pointer', display:'flex', gap:12, alignItems:'center' }}>
      <Avatar animal={animal} t={t} size={48}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:16, fontWeight:600, color:t.text }}>{animal.name}</div>
          <StatusPill status={animal.status} dark={t.bg.startsWith('#0')}/>
        </div>
        <div style={{ fontSize:12.5, color:t.muted, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {animal.species} · {animal.breed} · {animal.weight} · {animal.ward}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, fontSize:11.5, color: stale ? '#B45309' : t.soft }}>
          <Ic.Clock size={12} stroke={2}/> Last update {fmt.rel(lastAt)}
          {animal.contagious && <span style={{ color:'#B42318', fontWeight:600 }}>· Contagious</span>}
        </div>
      </div>
      <Ic.Chevron size={16} color={t.soft}/>
    </Card>
  );
}

// ── Animal detail ────────────────────────────────────────────────────────────
function AnimalDetailScreen({ t, id, go, feedStyle, onOpenAct, onToast, onOpenPhotos }) {
  const animal = IPD.state.animals.find(a => a.id === id);
  const [tab, setTab] = useStateM('feed');
  if (!animal) return <div style={{ padding: 24 }}>Animal not found.</div>;

  return (
    <div style={{ paddingBottom: 100 }}>
      <Header t={t} back={() => go('animals')}
        right={
          <button onClick={() => go('addActivity', { animalId: animal.id })} style={{
            appearance:'none', border:0, background:t.accent, color:'#fff',
            padding:'7px 12px', borderRadius:999, fontFamily:'inherit',
            fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:5, cursor:'pointer',
          }}><Ic.Plus size={14} stroke={2.6}/> Log activity</button>
        }/>

      {/* Hero card */}
      <div style={{ padding: '8px 14px 0' }}>
        <Card t={t} padded={false} style={{ padding: 16 }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
            <Avatar animal={animal} t={t} size={62}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{animal.name}</div>
                <StatusPill status={animal.status} dark={t.bg.startsWith('#0')}/>
              </div>
              <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>
                {animal.species} · {animal.breed} · {animal.gender} · {animal.age}
              </div>
              <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                {animal.weight} · {animal.color}
              </div>
              <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                <Pill bg={t.chipBg} fg={t.text}>{animal.ward}</Pill>
                {animal.contagious && <Pill bg="#FEE4E2" fg="#B42318">Contagious</Pill>}
                {animal.aggressive && <Pill bg="#FEF0C7" fg="#93370D">Aggressive</Pill>}
                <Pill bg={t.chipBg} fg={t.text}>Vacc: {animal.vaccination}</Pill>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 14, padding: '10px 12px', background: t.surface2, borderRadius: 10,
            fontSize: 13, color: t.text, display:'flex', flexDirection:'column', gap: 4,
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: t.muted, letterSpacing:'0.06em', textTransform:'uppercase' }}>Chief complaint</div>
            <div>{animal.complaint}</div>
          </div>

          <div style={{ marginTop: 12, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
            <Stat t={t} label="Admitted" value={fmt.dt(animal.admittedAt)} />
            <Stat t={t} label="Last update" value={fmt.rel(IPD.lastActivityAt(animal.id))} />
            <Stat t={t} label="Rescuer" value={animal.rescuer} />
            <Stat t={t} label="Contact" value={animal.rescuerPhone} />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ padding: '14px 14px 0' }}>
        <Segmented t={t} value={tab} onChange={setTab}
          options={[
            { value:'feed', label:'Activity' },
            { value:'info', label:'Details' },
            { value:'docs', label:'Documents' },
          ]}/>
      </div>

      {tab === 'feed' && <ActivityFeed t={t} animal={animal} feedStyle={feedStyle} go={go} onOpenAct={onOpenAct} onOpenPhotos={onOpenPhotos}/>}
      {tab === 'info' && <AnimalInfo t={t} animal={animal} go={go} onToast={onToast}/>}
      {tab === 'docs' && <AnimalDocs t={t} animal={animal} go={go} onToast={onToast} onOpenPhotos={onOpenPhotos}/>}
    </div>
  );
}

function Stat({ t, label, value }) {
  return (
    <div>
      <div style={{ fontSize:11, color:t.muted, fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontSize:13.5, color:t.text, marginTop:2 }}>{value}</div>
    </div>
  );
}

// ── Activity feed (3 styles) ─────────────────────────────────────────────────
function ActivityFeed({ t, animal, feedStyle, go, onOpenAct, onOpenPhotos }) {
  const all = IPD.activitiesFor(animal.id);
  const [filterType, setFilterType] = useStateM('all');
  const dark = t.bg.startsWith('#0');

  const types = ['all', ...Object.keys(ACT_META)];
  const visible = filterType === 'all' ? all : all.filter(a => a.type === filterType);

  if (feedStyle === 'tabs') {
    return (
      <div style={{ padding: '14px 0 0' }}>
        <div style={{ padding: '0 14px 12px', display:'flex', gap:6, overflowX:'auto' }}>
          {types.map(ty => (
            <Chip key={ty} active={filterType===ty} onClick={() => setFilterType(ty)} t={t}>
              {ty === 'all' ? 'All' : ACT_META[ty]?.label || ty}
              {ty !== 'all' && <span style={{ opacity:0.7, marginLeft:4 }}>{all.filter(a => a.type === ty).length}</span>}
            </Chip>
          ))}
        </div>
        <div style={{ padding: '0 14px', display:'flex', flexDirection:'column', gap:8 }}>
          {visible.map(a => <ActivityCard key={a.id} act={a} t={t} onClick={() => onOpenAct && onOpenAct(a.id)} onOpenPhotos={onOpenPhotos}/>)}
          {visible.length === 0 && <div style={{ padding:30, textAlign:'center', color:t.muted, fontSize:13.5 }}>No entries yet.</div>}
        </div>
      </div>
    );
  }

  if (feedStyle === 'grouped') {
    // Group by day
    const groups = {};
    visible.forEach(a => {
      const d = new Date(a.at); d.setHours(0,0,0,0);
      const k = d.toISOString();
      groups[k] = groups[k] || []; groups[k].push(a);
    });
    const days = Object.keys(groups).sort((a,b) => new Date(b) - new Date(a));
    return (
      <div style={{ padding: '14px 0 0' }}>
        {days.map(day => {
          const d = new Date(day);
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={day} style={{ marginBottom: 14 }}>
              <div style={{ padding:'0 16px 6px', display:'flex', alignItems:'baseline', gap:8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{isToday ? 'Today' : d.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' })}</div>
                <div style={{ fontSize: 11.5, color: t.muted }}>{groups[day].length} entries</div>
              </div>
              <div style={{ padding: '0 14px', display:'flex', flexDirection:'column', gap: 8 }}>
                {groups[day].map(a => <ActivityCard key={a.id} act={a} t={t} onClick={() => onOpenAct && onOpenAct(a.id)} onOpenPhotos={onOpenPhotos}/>)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // timeline (default)
  return (
    <div style={{ padding: '14px 14px 0', position:'relative' }}>
      <div style={{
        position:'absolute', left: 31, top: 22, bottom: 14, width: 2,
        background: t.line,
      }}/>
      {visible.map((a, i) => {
        const m = ACT_META[a.type] || ACT_META.admission;
        const I = m.icon;
        const photos = Array.isArray(a.photos) ? a.photos : [];
        const hasMedia = photos.length > 0;
        return (
          <div key={a.id} style={{ display:'flex', gap: 12, marginBottom: 14, position:'relative' }}>
            {hasMedia ? (
              <div style={{ position:'relative', flexShrink: 0, zIndex: 1 }}
                onClick={(e) => { e.stopPropagation(); onOpenPhotos && onOpenPhotos(photos, 0); }}>
                <Photo seed={photos[0].seed || photos[0].id} kind={photos[0].kind || 'photo'}
                  style={{
                    width: 44, height: 44, borderRadius: 11,
                    border: `2px solid ${m.color}`, boxSizing: 'border-box', cursor: 'pointer',
                    background: t.surface,
                  }}
                  rounded={11} showLabel={false}/>
                <div style={{
                  position:'absolute', bottom:-4, right:-4, width: 18, height: 18, borderRadius: '50%',
                  background: m.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                  border:`1.5px solid ${t.surface}`,
                }}><I size={10} stroke={2.4} color="#fff"/></div>
                {photos.length > 1 && (
                  <div style={{
                    position:'absolute', top:-5, left:-5, minWidth: 18, height: 18, padding:'0 4px',
                    borderRadius: 9, background: '#0F1B26', color:'#fff', fontSize: 10, fontWeight: 700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border:`1.5px solid ${t.surface}`,
                  }}>+{photos.length - 1}</div>
                )}
              </div>
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: t.surface, border: `2px solid ${m.color}`, color: m.color,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0, zIndex: 1,
              }}><I size={17} stroke={2}/></div>
            )}
            <Card t={t} style={{ flex:1, cursor:'pointer' }} onClick={() => onOpenAct && onOpenAct(a.id)}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{m.label}</div>
                <div style={{ fontSize: 11.5, color: t.muted, flexShrink: 0 }}>{fmt.time(a.at)} · {fmt.date(a.at)}</div>
              </div>
              <div style={{ fontSize: 13.5, color: t.text, marginTop: 4, lineHeight: 1.4 }}>{activitySummary(a)}</div>
              {a.notes && <div style={{ fontSize: 12.5, color: t.muted, marginTop: 4 }}>📋 {a.notes}</div>}
              {a.remarks && a.type !== 'treatment' && <div style={{ fontSize: 12.5, color: t.muted, marginTop: 4 }}>{a.remarks}</div>}
              <div style={{ fontSize: 11.5, color: t.soft, marginTop: 6, display:'flex', alignItems:'center', gap:6 }}>
                <span>by {a.by}</span>
                {a.editedBy && <span style={{ fontStyle:'italic' }}>· edited {fmt.rel(a.editedAt)}</span>}
                <Ic.Chevron size={11} color={t.soft} style={{ marginLeft:'auto' }}/>
              </div>
            </Card>
          </div>
        );
      })}
      {visible.length === 0 && <div style={{ padding:30, textAlign:'center', color:t.muted, fontSize:13.5 }}>No activity yet — tap “Log activity”.</div>}
    </div>
  );
}

function ActivityCard({ act, t, onClick, onOpenPhotos }) {
  const m = ACT_META[act.type] || ACT_META.admission;
  const I = m.icon;
  const photos = Array.isArray(act.photos) ? act.photos : [];
  const hasMedia = photos.length > 0;
  return (
    <Card t={t} onClick={onClick} style={onClick ? { cursor:'pointer' } : undefined}>
      <div style={{ display:'flex', gap: 11, alignItems:'flex-start' }}>
        {hasMedia ? (
          <div style={{ position:'relative', flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); onOpenPhotos && onOpenPhotos(photos, 0); }}>
            <Photo seed={photos[0].seed || photos[0].id} kind={photos[0].kind || 'photo'}
              style={{ width: 56, height: 56, borderRadius: 10, cursor: 'pointer' }}
              rounded={10} showLabel={false}/>
            {/* Activity type badge tucked on the photo */}
            <div style={{
              position:'absolute', bottom:-3, right:-3, width: 20, height: 20, borderRadius: '50%',
              background: m.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              border:`1.5px solid ${t.surface}`,
            }}><I size={11} stroke={2.4} color="#fff"/></div>
            {photos.length > 1 && (
              <div style={{
                position:'absolute', top:-4, left:-4, minWidth: 18, height: 18, padding:'0 4px',
                borderRadius: 9, background: '#0F1B26', color:'#fff', fontSize: 10, fontWeight: 700,
                display:'flex', alignItems:'center', justifyContent:'center',
                border:`1.5px solid ${t.surface}`,
              }}>+{photos.length - 1}</div>
            )}
          </div>
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: m.color + '22', color: m.color,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0,
          }}><I size={17} stroke={2}/></div>
        )}
        <div style={{ flex: 1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{m.label}</div>
            <div style={{ fontSize: 11.5, color: t.muted }}>{fmt.time(act.at)}</div>
          </div>
          <div style={{ fontSize: 13, color: t.text, marginTop: 3, lineHeight: 1.4 }}>{activitySummary(act)}</div>
          <div style={{ fontSize: 11.5, color: t.soft, marginTop: 4, display:'flex', alignItems:'center', gap:6 }}>
            <span>by {act.by}</span>
            {act.editedBy && <span style={{ fontStyle:'italic' }}>· edited</span>}
            {onClick && <Ic.Chevron size={11} color={t.soft} style={{ marginLeft:'auto' }}/>}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Animal info tab ──────────────────────────────────────────────────────────
function AnimalInfo({ t, animal, go, onToast }) {
  const [editing, setEditing] = useStateM(false);
  const [draft, setDraft] = useStateM(null);

  const start = () => { setDraft({ ...animal }); setEditing(true); };
  const cancel = () => { setDraft(null); setEditing(false); };
  const save = () => {
    IPD.updateAnimal(animal.id, draft);
    onToast && onToast({ msg: 'Patient details saved' });
    setDraft(null);
    setEditing(false);
  };
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const d = editing ? draft : animal;

  return (
    <div style={{ padding: '14px 14px 0', display:'flex', flexDirection:'column', gap: 10 }}>
      {/* Edit toolbar */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding: '2px 2px 4px',
      }}>
        <div style={{ fontSize: 12.5, color: t.muted }}>
          {editing ? 'Tap any field to edit · changes save when you tap Save' : 'View-only · tap Edit to modify any field'}
        </div>
        {!editing ? (
          <button onClick={start} style={smallActionBtn(t)}>
            <Ic.Edit size={13} stroke={2}/> Edit
          </button>
        ) : (
          <div style={{ display:'flex', gap: 6 }}>
            <button onClick={cancel} style={smallActionBtn(t, 'ghost')}>Cancel</button>
            <button onClick={save} style={smallActionBtn(t, 'primary')}>
              <Ic.Check size={13} stroke={2.5}/> Save
            </button>
          </div>
        )}
      </div>

      <Card t={t}>
        <div style={{ fontSize:12, fontWeight:700, color:t.muted, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 10 }}>Medical</div>
        <EKV t={t} k="Chief complaint" v={d.complaint}      editing={editing} multi onChange={v => set('complaint', v)}/>
        <EKV t={t} k="Injury type"     v={d.injuryType}     editing={editing}
          select={['Trauma / RTA','Medical','Post-op','Infectious','Burn','Bite','Other']}
          onChange={v => set('injuryType', v)}/>
        <EKV t={t} k="History"         v={d.history}        editing={editing} multi onChange={v => set('history', v)}/>
        <EKV t={t} k="Tentative dx"    v={d.diagnosis}      editing={editing} multi onChange={v => set('diagnosis', v)}/>
        <EKV t={t} k="Tests advised"   v={(d.tests||[]).join(', ')} editing={editing}
          onChange={v => set('tests', v.split(',').map(x=>x.trim()).filter(Boolean))}/>
        <EKV t={t} k="Surgery req."    v={d.surgeryReq}     editing={editing}
          select={['No','Maybe','Yes — urgent','Yes — scheduled','Yes — pending stabilization']}
          onChange={v => set('surgeryReq', v)} last/>
      </Card>

      <Card t={t}>
        <div style={{ fontSize:12, fontWeight:700, color:t.muted, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 10 }}>Status & ward</div>
        <EKV t={t} k="Status" v={d.status} editing={editing}
          select={['Critical','Stable','Observation']} onChange={v => set('status', v)}/>
        <EKV t={t} k="Ward / Cage" v={d.ward} editing={editing} onChange={v => set('ward', v)}/>
        <EKV t={t} k="Contagious" v={d.contagious ? 'Yes' : 'No'} editing={editing}
          select={['Yes','No']} onChange={v => set('contagious', v === 'Yes')}/>
        <EKV t={t} k="Aggressive" v={d.aggressive ? 'Yes' : 'No'} editing={editing}
          select={['Yes','No']} onChange={v => set('aggressive', v === 'Yes')} last/>
      </Card>

      <Card t={t}>
        <div style={{ fontSize:12, fontWeight:700, color:t.muted, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 10 }}>Rescue / Owner</div>
        <EKV t={t} k="Rescuer"         v={d.rescuer}        editing={editing} onChange={v => set('rescuer', v)}/>
        <EKV t={t} k="Contact"         v={d.rescuerPhone}   editing={editing} onChange={v => set('rescuerPhone', v)}/>
        <EKV t={t} k="NGO / Ambulance" v={d.ngo}            editing={editing} onChange={v => set('ngo', v)}/>
        <EKV t={t} k="Brought by"      v={d.broughtBy}      editing={editing} onChange={v => set('broughtBy', v)} last/>
      </Card>

      <Card t={t}>
        <div style={{ fontSize:12, fontWeight:700, color:t.muted, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 10 }}>Basics</div>
        <EKV t={t} k="Species" v={d.species} editing={editing} select={['Dog','Cat','Cow','Bird','Goat','Rabbit']} onChange={v => set('species', v)}/>
        <EKV t={t} k="Breed"   v={d.breed}   editing={editing} onChange={v => set('breed', v)}/>
        <EKV t={t} k="Gender"  v={d.gender}  editing={editing} select={['Male','Female','Unknown']} onChange={v => set('gender', v)}/>
        <EKV t={t} k="Age"     v={d.age}     editing={editing} onChange={v => set('age', v)}/>
        <EKV t={t} k="Color / ID" v={d.color} editing={editing} multi onChange={v => set('color', v)}/>
        <EKV t={t} k="Weight"  v={d.weight}  editing={editing} onChange={v => set('weight', v)}/>
        <EKV t={t} k="Vaccination" v={d.vaccination} editing={editing} select={['Done','Partial','None','Unknown','N/A']} onChange={v => set('vaccination', v)}/>
        <EKV t={t} k="Sterilized"  v={d.sterilized}  editing={editing} select={['Yes','No','Unknown']} onChange={v => set('sterilized', v)} last/>
      </Card>

      {animal.editedBy && !editing && (
        <div style={{ fontSize: 11.5, color: t.soft, padding: '0 4px', fontStyle:'italic' }}>
          Last edited by {animal.editedBy} · {fmt.rel(animal.editedAt)}
        </div>
      )}

      {!editing && (
        <Btn t={t} variant="danger" icon={<Ic.Discharge size={16}/>} onClick={() => go('discharge', { id: animal.id })} style={{ width:'100%', marginTop: 4 }}>
          End stay (discharge / death)
        </Btn>
      )}
    </div>
  );
}

function smallActionBtn(t, variant) {
  const base = {
    appearance:'none', cursor:'pointer', fontFamily:'inherit',
    fontSize: 12.5, fontWeight: 600, padding: '6px 10px', borderRadius: 9,
    display:'inline-flex', alignItems:'center', gap: 5,
    border: `1px solid ${t.line}`,
  };
  if (variant === 'primary') return { ...base, background: t.accent, color: '#fff', border: `1px solid ${t.accent}` };
  if (variant === 'ghost') return { ...base, background: 'transparent', color: t.text };
  return { ...base, background: t.surface, color: t.accent };
}

// Editable KV row. Read-only when editing=false; turns into input/textarea/select when true.
function EKV({ t, k, v, last, editing, multi, select, onChange }) {
  return (
    <div style={{
      display:'flex', gap: 12, padding: editing ? '6px 0' : '8px 0', alignItems: editing ? 'flex-start' : 'baseline',
      borderBottom: last ? '0' : `0.5px solid ${t.line}`,
    }}>
      <div style={{ flex:'0 0 38%', fontSize:12.5, color:t.muted, paddingTop: editing ? 8 : 0 }}>{k}</div>
      <div style={{ flex:1, fontSize:13.5, color:t.text, minWidth: 0 }}>
        {!editing ? (v || '—') : (
          select ? (
            <Select t={t} value={v} onChange={onChange} options={select}/>
          ) : multi ? (
            <Textarea t={t} value={v} onChange={onChange} rows={2}/>
          ) : (
            <Input t={t} value={v} onChange={onChange}/>
          )
        )}
      </div>
    </div>
  );
}

function KV({ t, k, v, last }) {
  return (
    <div style={{
      display:'flex', gap: 12, padding: '8px 0',
      borderBottom: last ? '0' : `0.5px solid ${t.line}`,
    }}>
      <div style={{ flex:'0 0 38%', fontSize:12.5, color:t.muted }}>{k}</div>
      <div style={{ flex:1, fontSize:13.5, color:t.text }}>{v || '—'}</div>
    </div>
  );
}

// ── Animal docs tab ──────────────────────────────────────────────────────────
function AnimalDocs({ t, animal, go, onToast, onOpenPhotos }) {
  const docs = IPD.state.documents.filter(d => d.animalId === animal.id);
  const [editingId, setEditingId] = useStateM(null);
  const [draftName, setDraftName] = useStateM('');

  const startEdit = (d) => { setEditingId(d.id); setDraftName(d.name); };
  const saveEdit = (d) => {
    IPD.updateDocument(d.id, { name: draftName });
    setEditingId(null);
    onToast && onToast({ msg: 'Document renamed' });
  };
  const onDelete = (d) => {
    const r = IPD.deleteDocument(d.id);
    if (r && onToast) {
      onToast({
        msg: 'Document deleted',
        actionLabel: 'Undo',
        action: () => IPD.restoreDocument(r.removed, r.idx),
      });
    }
  };

  const isVisual = (d) => d.media === 'photo' || d.media === 'xray' || /\.(jpe?g|png|heic|gif|webp)$/i.test(d.name || '');

  // Visual docs as a single grid up top — media first.
  const visualDocs = docs.filter(isVisual).map(d => ({
    id: d.id,
    seed: d.seed || d.id,
    kind: d.media || (/\.(pdf)$/i.test(d.name) ? 'doc' : 'photo'),
    label: d.kind + ' · ' + (d.name || ''),
    at: d.at, by: d.by,
  }));

  const cats = ['Medical','Diagnostics','Consent','Ownership','Death'];
  const fileDocs = docs.filter(d => !isVisual(d));
  const byCat = {};
  cats.forEach(c => byCat[c] = fileDocs.filter(d => d.category === c));
  return (
    <div style={{ padding: '14px 14px 0', display:'flex', flexDirection:'column', gap: 14 }}>
      <Btn t={t} variant="soft" icon={<Ic.Upload size={16}/>} onClick={() => go('uploadDoc', { animalId: animal.id })} style={{ width:'100%' }}>
        Upload document
      </Btn>

      {visualDocs.length > 0 && (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:t.muted, letterSpacing:'0.06em', textTransform:'uppercase', padding:'4px 4px 8px', display:'flex', justifyContent:'space-between' }}>
            <span>Visual records · {visualDocs.length}</span>
          </div>
          <MediaGrid t={t} photos={visualDocs} cols={3} ratio={1}
            onOpen={(photos, idx) => onOpenPhotos && onOpenPhotos(photos, idx)}/>
        </div>
      )}

      {cats.map(cat => byCat[cat].length > 0 && (
        <div key={cat}>
          <div style={{ fontSize:12, fontWeight:700, color:t.muted, letterSpacing:'0.06em', textTransform:'uppercase', padding:'4px 4px 6px' }}>{cat}</div>
          <Card t={t} padded={false}>
            {byCat[cat].map((d, i) => {
              const isEditing = editingId === d.id;
              return (
                <div key={d.id} style={{
                  display:'flex', alignItems:'center', gap:10, padding: '11px 14px',
                  borderBottom: i === byCat[cat].length - 1 ? '0' : `0.5px solid ${t.line}`,
                }}>
                  <Photo seed={d.seed || d.id} kind={d.media || 'doc'}
                    style={{ width: 36, height: 44, borderRadius: 6 }} rounded={6} showLabel={false}
                    onClick={() => onOpenPhotos && onOpenPhotos([{ id:d.id, seed:d.seed||d.id, kind:d.media||'doc', label:d.kind+' · '+d.name, at:d.at, by:d.by }], 0)}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    {isEditing ? (
                      <Input t={t} value={draftName} onChange={setDraftName} style={{ padding: '7px 10px', fontSize: 13.5 }}/>
                    ) : (
                      <>
                        <div style={{ fontSize: 13.5, color: t.text, fontWeight: 600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</div>
                        <div style={{ fontSize: 11.5, color: t.muted, marginTop:2 }}>{d.kind} · {d.size} · {fmt.rel(d.at)}</div>
                      </>
                    )}
                  </div>
                  <div style={{ display:'flex', gap: 4, flexShrink: 0 }}>
                    {isEditing ? <>
                      <button onClick={() => setEditingId(null)} style={iconBtnXS(t)} title="Cancel"><Ic.Close size={14} color={t.muted}/></button>
                      <button onClick={() => saveEdit(d)} style={iconBtnXS(t, 'primary')} title="Save"><Ic.Check size={14} stroke={2.5}/></button>
                    </> : <>
                      <button onClick={() => startEdit(d)} style={iconBtnXS(t)} title="Rename"><Ic.Edit size={14} color={t.muted}/></button>
                      <button onClick={() => onDelete(d)} style={iconBtnXS(t)} title="Delete"><Ic.Trash size={14} color="#B42318"/></button>
                    </>}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
      {docs.length === 0 && (
        <div style={{ padding:30, textAlign:'center', color:t.muted, fontSize:13.5 }}>
          No documents uploaded yet.
        </div>
      )}
    </div>
  );
}

function iconBtnXS(t, variant) {
  const base = {
    appearance:'none', cursor:'pointer', fontFamily:'inherit',
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.line}`,
    display:'flex', alignItems:'center', justifyContent:'center',
    background: t.surface, color: t.text,
  };
  if (variant === 'primary') return { ...base, background: t.accent, color: '#fff', border: `1px solid ${t.accent}` };
  return base;
}

Object.assign(window, {
  DashboardScreen, AnimalListScreen, AnimalDetailScreen,
});
