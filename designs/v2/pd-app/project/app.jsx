// app.jsx — App shell, routing, tweaks. Web-app layout (sidebar + top bar).

const { useState: useS, useEffect: useE, useMemo: useM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "clinical",
  "feedStyle": "timeline",
  "density": "comfortable",
  "showRoleBadge": true
}/*EDITMODE-END*/;

function App() {
  // Force re-renders on state changes
  const [, force] = useS(0);
  useE(() => IPD.subscribe(() => force(n => n + 1)), []);

  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [addOpen, setAddOpen] = useS(false);
  const [roleOpen, setRoleOpen] = useS(false);
  const [toast, setToast] = useS(null);
  const [openActId, setOpenActId] = useS(null);
  const [search, setSearch] = useS('');
  const lb = useLightbox();

  const t = THEMES[tw.theme] || THEMES.clinical;

  const go = (screen, params = {}) => {
    // Translate pick-animal shortcuts
    if (screen === 'pickAnimalForActivity') return IPD.go('pickAnimal', { next: 'addActivity', ...params });
    if (screen === 'pickAnimalForDoc')      return IPD.go('pickAnimal', { next: 'uploadDoc',  ...params });
    if (screen === 'pickAnimalForExit')     return IPD.go('pickAnimal', { next: 'discharge',  ...params });
    if (screen === 'home')    return IPD.go('home');
    if (screen === 'animals') return IPD.go('animals');
    if (screen === 'docs')    return IPD.go('docs');
    if (screen === 'reports') return IPD.go('reports');
    if (screen === 'add')     { setAddOpen(true); return; }
    IPD.go(screen, params);
  };

  const { screen, params } = IPD.state.nav;
  const sideNavActive = (screen === 'home') ? 'home'
    : (screen === 'animals' || screen === 'animal' || screen === 'pickAnimal' || screen === 'admission' || screen === 'addActivity' || screen === 'discharge') ? 'animals'
    : (screen === 'docs' || screen === 'uploadDoc') ? 'docs'
    : (screen === 'reports') ? 'reports'
    : null;

  // Breadcrumb + back for top bar
  const crumb = useM(() => {
    const home = { label: 'Today', onClick: () => IPD.go('home') };
    switch (screen) {
      case 'home':       return [{ label: 'Today' }];
      case 'animals':    return [{ label: 'Patients' }];
      case 'animal': {
        const a = IPD.state.animals.find(x => x.id === params.id);
        return [{ label: 'Patients', onClick: () => IPD.go('animals') }, { label: a ? a.name : 'Patient' }];
      }
      case 'admission':  return [{ label: 'Patients', onClick: () => IPD.go('animals') }, { label: 'New admission' }];
      case 'pickAnimal': return [{ label: 'Patients', onClick: () => IPD.go('animals') }, { label: 'Select patient' }];
      case 'addActivity':return [{ label: 'Patients', onClick: () => IPD.go('animals') }, { label: 'Log activity' }];
      case 'uploadDoc':  return [{ label: 'Documents', onClick: () => IPD.go('docs') }, { label: 'Upload' }];
      case 'discharge':  return [{ label: 'Patients', onClick: () => IPD.go('animals') }, { label: 'Discharge / Death' }];
      case 'docs':       return [{ label: 'Documents' }];
      case 'reports':    return [{ label: 'Reports' }];
      default:           return [home];
    }
  }, [screen, params, IPD.state.animals.length]);

  const showBack = screen !== 'home' && screen !== 'animals' && screen !== 'docs' && screen !== 'reports';
  const back = showBack ? () => IPD.back() : null;

  // Render the active screen
  let body;
  switch (screen) {
    case 'home':       body = <DashboardScreen t={t} density={tw.density} dashLayout="cards" onOpenRole={() => setRoleOpen(true)} go={go}/>; break;
    case 'animals':    body = <AnimalListScreen t={t} go={go} filter={params.filter} search={search}/>; break;
    case 'animal':     body = <AnimalDetailScreen t={t} id={params.id} feedStyle={tw.feedStyle} go={go} onOpenAct={setOpenActId} onToast={setToast} onOpenPhotos={lb.open}/>; break;
    case 'admission':  body = <AdmissionScreen t={t} go={go}/>; break;
    case 'pickAnimal': body = <PickAnimalScreen t={t} go={go} params={params}/>; break;
    case 'addActivity':body = <AddActivityScreen t={t} go={go} params={params}/>; break;
    case 'uploadDoc':  body = <UploadDocScreen t={t} go={go} params={params}/>; break;
    case 'discharge':  body = <DischargeScreen t={t} go={go} params={params}/>; break;
    case 'docs':       body = <DocumentsScreen t={t} go={go}/>; break;
    case 'reports':    body = <ReportsScreen t={t} go={go}/>; break;
    default:           body = <DashboardScreen t={t} density={tw.density} dashLayout="cards" onOpenRole={() => setRoleOpen(true)} go={go}/>;
  }

  // Global keyboard: N = new entry, / = focus search
  useE(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') { setAddOpen(true); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <WebShell
        t={t}
        sideNavActive={sideNavActive}
        go={go}
        onAdd={() => setAddOpen(true)}
        onOpenRole={() => setRoleOpen(true)}
        breadcrumb={crumb}
        back={back}
        search={search}
        onSearch={setSearch}>
        {body}
      </WebShell>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} t={t} go={(to, p) => { go(to, p || {}); }}/>
      <RoleSheet open={roleOpen} onClose={() => setRoleOpen(false)} t={t}/>
      <ActivitySheet open={!!openActId} activityId={openActId} t={t}
        onClose={() => setOpenActId(null)} onToast={setToast} onOpenPhotos={lb.open}/>
      <UndoToast toast={toast} onClose={() => setToast(null)} t={t}/>
      <Lightbox open={lb.state.open} photos={lb.state.photos} startIndex={lb.state.idx} t={t} onClose={lb.close}/>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Aesthetic" />
        <TweakRadio  label="Theme" value={tw.theme} options={[
          { value:'clinical', label:'Clinical' },
          { value:'warm',     label:'Warm' },
          { value:'utility',  label:'Utility' },
        ]} onChange={v => setTweak('theme', v)} />
        <TweakSection label="Layout" />
        <TweakRadio  label="Activity feed" value={tw.feedStyle} options={[
          { value:'timeline', label:'Timeline' },
          { value:'tabs',     label:'Tabs' },
          { value:'grouped',  label:'By day' },
        ]} onChange={v => setTweak('feedStyle', v)} />
        <TweakRadio  label="Density" value={tw.density} options={[
          { value:'comfortable', label:'Comfortable' },
          { value:'compact',     label:'Compact' },
        ]} onChange={v => setTweak('density', v)} />
        <TweakSection label="Role (demo)" />
        <TweakRadio label="Active role" value={IPD.state.role} options={[
          { value:'staff',  label:'Staff' },
          { value:'doctor', label:'Doctor' },
          { value:'admin',  label:'Admin' },
        ]} onChange={v => IPD.setRole(v)}/>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
