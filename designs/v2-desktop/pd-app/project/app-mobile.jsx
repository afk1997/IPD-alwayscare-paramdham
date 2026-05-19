// app-mobile.jsx — Mobile-styled app. Full viewport, no device frame,
// no browser chrome. Sticky page header, bottom nav with center FAB,
// bottom sheets. Renders the SAME screens as the web app but with
// mobile UI furniture.

const { useState: useSM, useEffect: useEM, useMemo: useMM } = React;

const TWEAK_DEFAULTS_M = /*EDITMODE-BEGIN*/{
  "theme": "clinical",
  "feedStyle": "grouped",
  "density": "compact"
}/*EDITMODE-END*/;

function AppMobile() {
  const [, force] = useSM(0);
  useEM(() => IPD.subscribe(() => force(n => n + 1)), []);

  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS_M);
  const [addOpen, setAddOpen] = useSM(false);
  const [roleOpen, setRoleOpen] = useSM(false);
  const [toast, setToast] = useSM(null);
  const [openActId, setOpenActId] = useSM(null);
  const lb = useLightbox();

  const t = THEMES[tw.theme] || THEMES.clinical;

  const go = (screen, params = {}) => {
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
  const bottomTab = (screen === 'home') ? 'home'
    : (screen === 'animals' || screen === 'animal' || screen === 'pickAnimal' || screen === 'admission' || screen === 'addActivity' || screen === 'discharge') ? 'animals'
    : (screen === 'docs' || screen === 'uploadDoc') ? 'docs'
    : (screen === 'reports') ? 'reports'
    : null;

  let body;
  switch (screen) {
    case 'home':       body = <DashboardScreen t={t} density={tw.density} dashLayout="cards" onOpenRole={() => setRoleOpen(true)} go={go}/>; break;
    case 'animals':    body = <AnimalListScreen t={t} go={go} filter={params.filter}/>; break;
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

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: t.bg, color: t.text, fontFamily: 'inherit',
      position: 'relative',
      paddingBottom: 88, // leave room for the bottom nav
    }}>
      {body}

      {bottomTab !== null && (
        <BottomNav screen={bottomTab} go={go} t={t} onAdd={() => setAddOpen(true)}/>
      )}

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} t={t} go={(to, p) => { go(to, p || {}); }}/>
      <RoleSheet open={roleOpen} onClose={() => setRoleOpen(false)} t={t}/>
      <ActivitySheet open={!!openActId} activityId={openActId} t={t}
        onClose={() => setOpenActId(null)} onToast={setToast} onOpenPhotos={lb.open}/>
      <UndoToast toast={toast} onClose={() => setToast(null)} t={t}/>
      <Lightbox open={lb.state.open} photos={lb.state.photos} startIndex={lb.state.idx} t={t} onClose={lb.close}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppMobile/>);
