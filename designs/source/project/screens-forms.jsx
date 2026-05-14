// screens-forms.jsx — Admission form, Add Activity, Upload Doc, Reports, Discharge,
// and "pick an animal" intermediate screens.

const { useState: useStateF } = React;

// Make a fresh media object with a unique seed so the placeholder Photo is unique.
function mkMedia(prefix, kind = 'photo', label) {
  const seed = prefix + '-' + Math.random().toString(36).slice(2, 9);
  const out = { id: seed, seed, kind };
  if (label) out.label = label;
  if (kind === 'video') out.durationSec = 8 + Math.floor(Math.random() * 40);
  return out;
}
window.mkMedia = mkMedia;

// ── Pick animal (used by FAB shortcuts) ──────────────────────────────────────
function PickAnimalScreen({ t, go, params }) {
  const [q, setQ] = useStateF('');
  const animals = IPD.state.animals;
  const filtered = animals.filter(a => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.breed.toLowerCase().includes(q.toLowerCase()));
  const next = params.next || 'addActivity';
  const titles = {
    addActivity: 'Choose patient',
    uploadDoc:   'Choose patient',
    discharge:   'Choose patient',
  };
  const subs = {
    addActivity: 'For activity logging',
    uploadDoc:   'For document upload',
    discharge:   'For discharge / death flow',
  };
  return (
    <div style={{ paddingBottom: 100 }}>
      <Header t={t} back={() => go('home')} big title={titles[next] || 'Choose patient'} subtitle={subs[next]}/>
      <div style={{ padding: '8px 14px 0' }}>
        <div style={{ position:'relative' }}>
          <Ic.Search size={17} color={t.soft} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}/>
          <Input t={t} value={q} onChange={setQ} placeholder="Search…" style={{ paddingLeft: 38 }}/>
        </div>
      </div>
      <div style={{ padding: '12px 14px', display:'flex', flexDirection:'column', gap: 8 }}>
        {filtered.map(a => (
          <Card key={a.id} t={t} onClick={() => go(next, { animalId: a.id, ...params })} style={{ cursor:'pointer', display:'flex', gap: 12, alignItems:'center' }}>
            <Avatar animal={a} t={t} size={42}/>
            <div style={{ flex:1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{a.name}</div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{a.species} · {a.ward}</div>
            </div>
            <StatusPill status={a.status} dark={t.bg.startsWith('#0')}/>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Admission form ───────────────────────────────────────────────────────────
function AdmissionScreen({ t, go }) {
  const [step, setStep] = useStateF(0);
  const [form, setForm] = useStateF({
    name: '', species: 'Dog', breed: '', gender: 'Male', age: '', color: '', weight: '',
    vaccination: 'Unknown', sterilized: 'No', aggressive: false,
    rescuer: '', rescuerPhone: '', address: '', ngo: '', broughtBy: IPD.state.me[IPD.state.role],
    complaint: '', injuryType: '', history: '', status: 'Observation', contagious: false,
    diagnosis: '', treatment: '', tests: [], surgeryReq: 'No',
    photos: [], videos: [], wounds: [], prescriptions: [],
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const steps = ['Basics', 'Rescuer', 'Condition', 'Media', 'Doctor'];

  const submit = () => {
    const heroPhotos = [...form.photos, ...form.wounds];
    const a = IPD.addAnimal({
      name: form.name || ('Temp-' + Math.floor(Math.random()*9000)),
      species: form.species, breed: form.breed, gender: form.gender, age: form.age,
      color: form.color, weight: form.weight, vaccination: form.vaccination,
      sterilized: form.sterilized, aggressive: form.aggressive,
      rescuer: form.rescuer, rescuerPhone: form.rescuerPhone, ngo: form.ngo, broughtBy: form.broughtBy,
      complaint: form.complaint, injuryType: form.injuryType, history: form.history,
      status: form.status, contagious: form.contagious,
      diagnosis: form.diagnosis, tests: form.tests, surgeryReq: form.surgeryReq,
      ward: 'New', photo: '#7a4a2f',
      photos: heroPhotos,
    });
    // Stamp the admission activity that addAnimal created with the photos + videos
    const adm = IPD.state.activities.find(x => x.animalId === a.id && x.type === 'admission');
    if (adm) {
      adm.photos = [...heroPhotos, ...form.videos];
    }
    // Drop prescription docs into the documents list so they show in the Docs tab.
    form.prescriptions.forEach((p, i) => {
      IPD.addDocument(a.id, {
        category: 'Medical', kind: 'Past prescription',
        name: `Prescription-${i + 1}.pdf`, size: '—',
        media: 'doc', seed: p.seed,
      });
    });
    go('animal', { id: a.id });
  };

  return (
    <div style={{ paddingBottom: 120 }}>
      <Header t={t} back={() => go('home')} big title="New admission"
        subtitle={`Step ${step+1} of ${steps.length} · ${steps[step]}`} />

      {/* progress */}
      <div style={{ padding: '0 14px 8px', display:'flex', gap:4 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            flex:1, height:4, borderRadius:2,
            background: i <= step ? t.accent : t.line,
          }}/>
        ))}
      </div>

      <div style={{ padding: '4px 14px 0', display:'flex', flexDirection:'column', gap: 14 }}>
        {step === 0 && (
          <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            <Field t={t} label="Animal name / Temp ID" required hint="Use a temp ID like ‘TempD-204’ for unnamed rescues">
              <Input t={t} value={form.name} onChange={v=>set('name',v)} placeholder="Bruno / TempD-204"/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <Field t={t} label="Species" required>
                <Select t={t} value={form.species} onChange={v=>set('species',v)} options={IPD.SPECIES}/>
              </Field>
              <Field t={t} label="Breed">
                <Input t={t} value={form.breed} onChange={v=>set('breed',v)} placeholder="Indie, DSH, …"/>
              </Field>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <Field t={t} label="Gender"><Select t={t} value={form.gender} onChange={v=>set('gender',v)} options={['Male','Female','Unknown']}/></Field>
              <Field t={t} label="Approx age"><Input t={t} value={form.age} onChange={v=>set('age',v)} placeholder="~3 yrs"/></Field>
            </div>
            <Field t={t} label="Color / Identification marks">
              <Input t={t} value={form.color} onChange={v=>set('color',v)} placeholder="Brown, white patch on chest"/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <Field t={t} label="Weight"><Input t={t} value={form.weight} onChange={v=>set('weight',v)} placeholder="14 kg"/></Field>
              <Field t={t} label="Vaccination">
                <Select t={t} value={form.vaccination} onChange={v=>set('vaccination',v)} options={['Done','Partial','None','Unknown','N/A']}/>
              </Field>
            </div>
            <div style={{ display:'flex', gap: 16, padding:'4px 2px' }}>
              <ToggleRow t={t} label="Sterilized" value={form.sterilized === 'Yes'} onChange={v => set('sterilized', v ? 'Yes' : 'No')}/>
              <ToggleRow t={t} label="Aggressive" value={form.aggressive} onChange={v => set('aggressive', v)}/>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            <Field t={t} label="Rescuer / Owner name">
              <Input t={t} value={form.rescuer} onChange={v=>set('rescuer',v)} placeholder="Name"/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <Field t={t} label="Contact number">
                <Input t={t} value={form.rescuerPhone} onChange={v=>set('rescuerPhone',v)} placeholder="+91 …" type="tel"/>
              </Field>
              <Field t={t} label="NGO / Ambulance">
                <Input t={t} value={form.ngo} onChange={v=>set('ngo',v)} placeholder="Optional"/>
              </Field>
            </div>
            <Field t={t} label="Address">
              <Textarea t={t} value={form.address} onChange={v=>set('address',v)} placeholder="Pickup / owner address"/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <Field t={t} label="Admission date & time">
                <Input t={t} value={new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })} onChange={()=>{}} />
              </Field>
              <Field t={t} label="Brought by (staff)">
                <Input t={t} value={form.broughtBy} onChange={v=>set('broughtBy',v)} placeholder="Staff name"/>
              </Field>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            <Field t={t} label="Chief complaint" required>
              <Textarea t={t} value={form.complaint} onChange={v=>set('complaint',v)} placeholder="What's wrong?"/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <Field t={t} label="Injury type">
                <Select t={t} value={form.injuryType} onChange={v=>set('injuryType',v)} options={['Trauma / RTA','Medical','Post-op','Infectious','Burn','Bite','Other']} placeholder="Select"/>
              </Field>
              <Field t={t} label="Triage status" required>
                <Select t={t} value={form.status} onChange={v=>set('status',v)} options={['Critical','Stable','Observation']}/>
              </Field>
            </div>
            <Field t={t} label="History">
              <Textarea t={t} value={form.history} onChange={v=>set('history',v)} placeholder="Background, prior visits, owner notes"/>
            </Field>
            <ToggleRow t={t} label="Contagious — isolate" value={form.contagious} onChange={v => set('contagious', v)}/>
          </Card>
        )}

        {step === 3 && (
          <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            <div style={{ fontSize:13, color:t.muted }}>Capture admission media so the floor team has visual context.</div>
            <UploadGrid t={t} label="Admission photos" icon={Ic.Camera} items={form.photos} type="photo"
              onAdd={() => set('photos', [...form.photos, mkMedia('adm-photo', 'photo', `On admission ${form.photos.length + 1}`)])}/>
            <UploadGrid t={t} label="Admission videos" icon={Ic.Camera} items={form.videos} type="video"
              onAdd={() => set('videos', [...form.videos, mkMedia('adm-video', 'video', `Admission clip ${form.videos.length + 1}`)])}/>
            <UploadGrid t={t} label="Wound closeups" icon={Ic.Camera} items={form.wounds} type="photo"
              onAdd={() => set('wounds', [...form.wounds, mkMedia('wound', 'photo', `Wound ${form.wounds.length + 1}`)])}/>
            <UploadGrid t={t} label="Previous prescriptions" icon={Ic.Doc} items={form.prescriptions} type="doc"
              onAdd={() => set('prescriptions', [...form.prescriptions, mkMedia('rx', 'doc', `Prescription ${form.prescriptions.length + 1}`)])}/>
          </Card>
        )}

        {step === 4 && (
          <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            <Field t={t} label="Tentative diagnosis">
              <Textarea t={t} value={form.diagnosis} onChange={v=>set('diagnosis',v)} placeholder="Working diagnosis"/>
            </Field>
            <Field t={t} label="Immediate treatment started">
              <Textarea t={t} value={form.treatment} onChange={v=>set('treatment',v)} placeholder="Fluids, pain mgmt, AB cover…"/>
            </Field>
            <Field t={t} label="Tests advised">
              <MultiChips t={t} value={form.tests} onChange={v => set('tests', v)}
                options={['X-ray','USG','Blood Test','MRI','CT Scan']}/>
            </Field>
            <Field t={t} label="Surgery required?">
              <Segmented t={t} value={form.surgeryReq} onChange={v=>set('surgeryReq',v)}
                options={['No','Maybe','Yes — urgent','Yes — scheduled']}/>
            </Field>
          </Card>
        )}
      </div>

      {/* footer */}
      <div style={{
        position:'absolute', bottom: 84, left: 0, right: 0, padding: '10px 14px',
        background: `linear-gradient(to top, ${t.bg} 65%, ${t.bg}00)`,
        display:'flex', gap: 10,
      }}>
        {step > 0 && <Btn t={t} variant="ghost" onClick={() => setStep(step-1)} style={{ flex:1 }}>Back</Btn>}
        {step < steps.length - 1
          ? <Btn t={t} onClick={() => setStep(step+1)} style={{ flex: 2 }}>Next · {steps[step+1]}</Btn>
          : <Btn t={t} onClick={submit} style={{ flex: 2 }} icon={<Ic.Check size={16} stroke={2.5}/>}>Admit patient</Btn>}
      </div>
    </div>
  );
}

function ToggleRow({ t, label, value, onChange }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color: t.text, cursor:'pointer', flex:1 }}>
      <Toggle t={t} value={value} onChange={onChange}/>
      <span style={{ fontWeight: 500 }}>{label}</span>
    </label>
  );
}

function MultiChips({ t, value, onChange, options }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
      {options.map(o => {
        const active = value.includes(o);
        return (
          <Chip key={o} t={t} active={active}
            icon={active ? <Ic.Check size={13} stroke={2.5}/> : null}
            onClick={() => onChange(active ? value.filter(x => x !== o) : [...value, o])}>{o}</Chip>
        );
      })}
    </div>
  );
}

function UploadGrid({ t, label, icon: I, items, onAdd, onOpen, type }) {
  const list = items || [];
  const isMediaKind = type === 'photo' || type === 'video' || type === 'xray';
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: t.muted, marginBottom: 6 }}>{label}{list.length > 0 && ` · ${list.length}`}</div>
      <div style={{ display:'flex', gap: 8, overflowX:'auto', padding:'2px 0 4px' }}>
        <button onClick={onAdd} style={{
          appearance:'none', cursor:'pointer', fontFamily:'inherit',
          flexShrink: 0, width: 76, height: 76, borderRadius: 12,
          border: `1.5px dashed ${t.line}`, background: t.surface2, color: t.muted,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 4,
        }}>
          <I size={20}/>
          <span style={{ fontSize: 10.5, fontWeight: 600 }}>Add</span>
        </button>
        {list.map((it, i) => (
          isMediaKind ? (
            <Photo key={it.id || i}
              seed={it.seed || it.id || (label + '-' + i)}
              kind={it.kind || (type === 'video' ? 'video' : 'photo')}
              durationSec={it.durationSec}
              style={{ flexShrink: 0, width: 76, height: 76, borderRadius: 12 }}
              rounded={12} showLabel={false}
              onClick={onOpen ? () => onOpen(list, i) : undefined}/>
          ) : (
            <Photo key={it.id || i}
              seed={it.seed || it.id || (label + '-' + i)}
              kind={'doc'}
              style={{ flexShrink: 0, width: 76, height: 76, borderRadius: 12 }}
              rounded={12} showLabel={false}
              onClick={onOpen ? () => onOpen(list, i) : undefined}/>
          )
        ))}
      </div>
    </div>
  );
}

// ── Add Activity ─────────────────────────────────────────────────────────────
function AddActivityScreen({ t, go, params }) {
  const animal = IPD.state.animals.find(a => a.id === params.animalId);
  const [type, setType] = useStateF(params.preselect || 'treatment');
  if (!animal) return <div style={{ padding: 30 }}>No animal selected. <button onClick={()=>go('home')}>Back</button></div>;

  const opts = Object.keys(ACT_META).filter(k => k !== 'admission');

  return (
    <div style={{ paddingBottom: 120 }}>
      <Header t={t} back={() => go('animal', { id: animal.id })} big title="Log activity" subtitle={animal.name + ' · ' + animal.ward}/>

      <div style={{ padding: '8px 14px', display:'flex', gap:6, overflowX:'auto' }}>
        {opts.map(o => {
          const m = ACT_META[o]; const I = m.icon;
          return (
            <Chip key={o} t={t} active={type === o} onClick={() => setType(o)} icon={<I size={14}/>}>{m.label}</Chip>
          );
        })}
      </div>

      <div style={{ padding: '4px 14px 0' }}>
        {type === 'treatment'  && <TreatmentForm  t={t} animal={animal} onSave={() => go('animal', { id: animal.id })}/>}
        {type === 'round'      && <RoundForm      t={t} animal={animal} onSave={() => go('animal', { id: animal.id })}/>}
        {type === 'diagnostic' && <DiagnosticForm t={t} animal={animal} onSave={() => go('animal', { id: animal.id })}/>}
        {type === 'surgery'    && <SurgeryForm    t={t} animal={animal} onSave={() => go('animal', { id: animal.id })}/>}
        {type === 'food'       && <FoodForm       t={t} animal={animal} onSave={() => go('animal', { id: animal.id })}/>}
        {type === 'bath'       && <BathForm       t={t} animal={animal} onSave={() => go('animal', { id: animal.id })}/>}
        {type === 'walk'       && <WalkForm       t={t} animal={animal} onSave={() => go('animal', { id: animal.id })}/>}
      </div>
    </div>
  );
}

function ActivityFooter({ t, onSave, primaryLabel = 'Save activity' }) {
  return (
    <div style={{ padding: '14px 0 0' }}>
      <Btn t={t} onClick={onSave} style={{ width: '100%' }} icon={<Ic.Check size={16} stroke={2.5}/>}>{primaryLabel}</Btn>
    </div>
  );
}

function TreatmentForm({ t, animal, onSave }) {
  const [meds, setMeds] = useStateF([{ name:'', dose:'', route:'IV', time:'', remarks:'' }]);
  const [remarks, setRemarks] = useStateF('');
  const [photos, setPhotos] = useStateF([]);
  const update = (i, k, v) => setMeds(m => m.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const add = () => setMeds([...meds, { name:'', dose:'', route:'IV', time:'', remarks:'' }]);
  const del = (i) => setMeds(meds.filter((_, j) => j !== i));
  const save = () => {
    const valid = meds.filter(m => m.name.trim());
    IPD.addActivity(animal.id, { type:'treatment', meds: valid, remarks, photos });
    onSave();
  };
  return (
    <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 14 }}>
      {meds.map((m, i) => (
        <div key={i} style={{ paddingBottom: 14, borderBottom: i < meds.length-1 ? `0.5px solid ${t.line}` : 0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight:600, color:t.muted }}>Medicine {i+1}</div>
            {meds.length > 1 && <button onClick={() => del(i)} style={{ appearance:'none', border:0, background:'transparent', color:'#B42318', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Remove</button>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <Field t={t} label="Medicine name" required>
              <Input t={t} value={m.name} onChange={v=>update(i,'name',v)} placeholder="Ceftriaxone"/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <Field t={t} label="Dose"><Input t={t} value={m.dose} onChange={v=>update(i,'dose',v)} placeholder="500mg"/></Field>
              <Field t={t} label="Route"><Segmented t={t} value={m.route} onChange={v=>update(i,'route',v)} options={['IV','IM','Oral','SC']}/></Field>
            </div>
            <Field t={t} label="Remarks">
              <Input t={t} value={m.remarks} onChange={v=>update(i,'remarks',v)} placeholder="Optional"/>
            </Field>
          </div>
        </div>
      ))}
      <Btn t={t} variant="soft" icon={<Ic.Plus size={14} stroke={2.5}/>} onClick={add} style={{ alignSelf:'flex-start' }}>Add another medicine</Btn>
      <Field t={t} label="Overall remarks">
        <Textarea t={t} value={remarks} onChange={setRemarks} placeholder="Optional"/>
      </Field>
      <UploadGrid t={t} label="Attach proof photo (optional)" icon={Ic.Camera} items={photos} type="photo"
        onAdd={() => setPhotos([...photos, mkMedia('tx', 'photo', `Treatment proof ${photos.length + 1}`)])}/>
      <ActivityFooter t={t} onSave={save}/>
    </Card>
  );
}

function RoundForm({ t, animal, onSave }) {
  const [f, setF] = useStateF({ temp:'', appetite:'Normal', hydration:'OK', pain:'2/10', wound:'', stool:'Normal', progress:'Improving', notes:'' });
  const [photos, setPhotos] = useStateF([]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const save = () => { IPD.addActivity(animal.id, { type:'round', ...f, photos }); onSave(); };
  return (
    <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
        <Field t={t} label="Temperature (°F)"><Input t={t} value={f.temp} onChange={v=>set('temp',v)} placeholder="101.5"/></Field>
        <Field t={t} label="Pain"><Select t={t} value={f.pain} onChange={v=>set('pain',v)} options={['0/10','1/10','2/10','3/10','4/10','5/10','6/10','7/10','8/10','9/10','10/10']}/></Field>
      </div>
      <Field t={t} label="Appetite"><Segmented t={t} value={f.appetite} onChange={v=>set('appetite',v)} options={['Normal','Partial','Refused']}/></Field>
      <Field t={t} label="Hydration"><Segmented t={t} value={f.hydration} onChange={v=>set('hydration',v)} options={['Good','OK','Mild','Severe']}/></Field>
      <Field t={t} label="Wound status"><Input t={t} value={f.wound} onChange={v=>set('wound',v)} placeholder="e.g. less swelling, no discharge"/></Field>
      <Field t={t} label="Stool / Urine"><Input t={t} value={f.stool} onChange={v=>set('stool',v)} placeholder="Normal / passed / not passed"/></Field>
      <Field t={t} label="Recovery progress"><Segmented t={t} value={f.progress} onChange={v=>set('progress',v)} options={['Worsening','Stable','Improving','Recovered']}/></Field>
      <Field t={t} label="New instructions"><Textarea t={t} value={f.notes} onChange={v=>set('notes',v)} placeholder="Plan for next 24h"/></Field>
      <UploadGrid t={t} label="Attach round photo (wound, condition)" icon={Ic.Camera} items={photos} type="photo"
        onAdd={() => setPhotos([...photos, mkMedia('round', 'photo', `Round photo ${photos.length + 1}`)])}/>
      <ActivityFooter t={t} onSave={save}/>
    </Card>
  );
}

function DiagnosticForm({ t, animal, onSave }) {
  const [tests, setTests] = useStateF([]);
  const [findings, setFindings] = useStateF('');
  const [interpretation, setInterpretation] = useStateF('');
  const [reports, setReports] = useStateF([]);
  const imagingTest = tests.find(x => /x-ray|sono|mri|ct/i.test(x));
  const save = () => {
    IPD.addActivity(animal.id, {
      type:'diagnostic', tests, findings, interpretation,
      reportCount: reports.length, photos: reports,
    });
    onSave();
  };
  return (
    <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
      <Field t={t} label="Tests performed">
        <MultiChips t={t} value={tests} onChange={setTests} options={['Blood test','X-ray','Sonography','MRI','CT Scan','Urine','Other']}/>
      </Field>
      <UploadGrid t={t} label="Upload reports" icon={Ic.Doc} items={reports} type={imagingTest ? 'xray' : 'doc'}
        onAdd={() => setReports([...reports, mkMedia('dx', imagingTest ? 'xray' : 'doc', `Report ${reports.length + 1}`)])}/>
      <Field t={t} label="Findings"><Textarea t={t} value={findings} onChange={setFindings} placeholder="What the report shows"/></Field>
      <Field t={t} label="Doctor interpretation"><Textarea t={t} value={interpretation} onChange={setInterpretation} placeholder="Clinical interpretation & plan"/></Field>
      <ActivityFooter t={t} onSave={save}/>
    </Card>
  );
}

function SurgeryForm({ t, animal, onSave }) {
  const [f, setF] = useStateF({ surgeryName:'', surgeon: IPD.state.me.doctor, anesthesia:'', duration:'', findings:'', complications:'', postOp:'', ot:[], consent:[], notes:[] });
  const set = (k,v) => setF(x => ({...x,[k]:v}));
  const save = () => {
    const { ot, consent, notes, ...rest } = f;
    IPD.addActivity(animal.id, {
      type:'surgery', ...rest,
      photos: [...ot, ...consent, ...notes],
    });
    onSave();
  };
  return (
    <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
      <Field t={t} label="Surgery name" required><Input t={t} value={f.surgeryName} onChange={v=>set('surgeryName',v)} placeholder="ORIF femur"/></Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <Field t={t} label="Surgeon"><Input t={t} value={f.surgeon} onChange={v=>set('surgeon',v)}/></Field>
        <Field t={t} label="Duration"><Input t={t} value={f.duration} onChange={v=>set('duration',v)} placeholder="45 min"/></Field>
      </div>
      <Field t={t} label="Anesthesia used"><Input t={t} value={f.anesthesia} onChange={v=>set('anesthesia',v)} placeholder="Isoflurane, Ketamine + Xylazine"/></Field>
      <Field t={t} label="Findings during surgery"><Textarea t={t} value={f.findings} onChange={v=>set('findings',v)}/></Field>
      <Field t={t} label="Complications"><Textarea t={t} value={f.complications} onChange={v=>set('complications',v)} placeholder="None / details"/></Field>
      <Field t={t} label="Post-op instructions"><Textarea t={t} value={f.postOp} onChange={v=>set('postOp',v)}/></Field>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <UploadGrid t={t} label="OT photos" icon={Ic.Camera} items={f.ot} type="photo"
          onAdd={() => set('ot', [...f.ot, mkMedia('ot', 'photo', `OT ${f.ot.length + 1}`)])}/>
        <UploadGrid t={t} label="Consent forms" icon={Ic.Doc} items={f.consent} type="doc"
          onAdd={() => set('consent', [...f.consent, mkMedia('consent', 'doc', `Consent ${f.consent.length + 1}`)])}/>
        <UploadGrid t={t} label="Surgical notes" icon={Ic.Doc} items={f.notes} type="doc"
          onAdd={() => set('notes', [...f.notes, mkMedia('snotes', 'doc', `Note ${f.notes.length + 1}`)])}/>
      </div>
      <ActivityFooter t={t} onSave={save}/>
    </Card>
  );
}

function FoodForm({ t, animal, onSave }) {
  const [f, setF] = useStateF({ foodType:'', qty:'', water:'', intake:'Fully', vomiting:false });
  const [photos, setPhotos] = useStateF([]);
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  const save = () => { IPD.addActivity(animal.id, { type:'food', ...f, photos }); onSave(); };
  return (
    <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
      <Field t={t} label="Food type"><Input t={t} value={f.foodType} onChange={v=>set('foodType',v)} placeholder="Curd-rice, paneer, veg kibble"/></Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <Field t={t} label="Quantity"><Input t={t} value={f.qty} onChange={v=>set('qty',v)} placeholder="80 g"/></Field>
        <Field t={t} label="Water intake"><Input t={t} value={f.water} onChange={v=>set('water',v)} placeholder="100 ml"/></Field>
      </div>
      <Field t={t} label="How much eaten"><Segmented t={t} value={f.intake} onChange={v=>set('intake',v)} options={['Fully','Partially','Refused']}/></Field>
      <ToggleRow t={t} label="Vomiting?" value={f.vomiting} onChange={v=>set('vomiting',v)}/>
      <UploadGrid t={t} label="Bowl / feeding photo (optional)" icon={Ic.Camera} items={photos} type="photo"
        onAdd={() => setPhotos([...photos, mkMedia('food', 'photo', `Food photo ${photos.length + 1}`)])}/>
      <ActivityFooter t={t} onSave={save}/>
    </Card>
  );
}

function BathForm({ t, animal, onSave }) {
  const [f, setF] = useStateF({ bathType:'Medicated bath', remarks:'' });
  const [photos, setPhotos] = useStateF([]);
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  const save = () => { IPD.addActivity(animal.id, { type:'bath', ...f, photos }); onSave(); };
  return (
    <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
      <Field t={t} label="Type of bath / grooming">
        <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
          {['Medicated bath','Tick treatment','Wound cleaning','Regular bath','Coat grooming','Nail trim'].map(o => (
            <Chip key={o} t={t} active={f.bathType === o} onClick={() => set('bathType', o)}>{o}</Chip>
          ))}
        </div>
      </Field>
      <Field t={t} label="Remarks"><Textarea t={t} value={f.remarks} onChange={v=>set('remarks',v)} placeholder="Optional notes"/></Field>
      <UploadGrid t={t} label="Before / after photo (optional)" icon={Ic.Camera} items={photos} type="photo"
        onAdd={() => setPhotos([...photos, mkMedia('bath', 'photo', `Bath ${photos.length + 1}`)])}/>
      <ActivityFooter t={t} onSave={save}/>
    </Card>
  );
}

function WalkForm({ t, animal, onSave }) {
  const [f, setF] = useStateF({ duration:'', urination:false, stool:false, mobility:'Normal', assisted:false });
  const [photos, setPhotos] = useStateF([]);
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  const save = () => { IPD.addActivity(animal.id, { type:'walk', ...f, photos }); onSave(); };
  return (
    <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
      <Field t={t} label="Walk duration"><Input t={t} value={f.duration} onChange={v=>set('duration',v)} placeholder="15 min"/></Field>
      <div style={{ display:'flex', gap: 16 }}>
        <ToggleRow t={t} label="Urination passed" value={f.urination} onChange={v=>set('urination',v)}/>
        <ToggleRow t={t} label="Stool passed" value={f.stool} onChange={v=>set('stool',v)}/>
      </div>
      <Field t={t} label="Mobility"><Segmented t={t} value={f.mobility} onChange={v=>set('mobility',v)} options={['Normal','Mild limp','Severe limp','Unable']}/></Field>
      <Field t={t} label="Movement"><Segmented t={t} value={f.assisted ? 'Assisted' : 'Independent'} onChange={v=>set('assisted', v === 'Assisted')} options={['Independent','Assisted']}/></Field>
      <UploadGrid t={t} label="Walk photo (optional)" icon={Ic.Camera} items={photos} type="photo"
        onAdd={() => setPhotos([...photos, mkMedia('walk', 'photo', `Walk ${photos.length + 1}`)])}/>
      <ActivityFooter t={t} onSave={save}/>
    </Card>
  );
}

// ── Upload Document ──────────────────────────────────────────────────────────
const DOC_CATEGORIES = [
  { id:'Medical',    kinds:['Past prescription','Referral papers','Previous treatment'] },
  { id:'Diagnostics',kinds:['X-ray','Blood report','MRI/CT','Sonography'] },
  { id:'Consent',    kinds:['Surgery consent','High-risk consent'] },
  { id:'Ownership',  kinds:['Ownership declaration','Owner ID'] },
  { id:'Death',      kinds:['Death certificate','Cause of death','Postmortem report','Body handover form'] },
];

function UploadDocScreen({ t, go, params }) {
  const animal = IPD.state.animals.find(a => a.id === params.animalId);
  const [category, setCategory] = useStateF('Medical');
  const [kind, setKind] = useStateF('Past prescription');
  const [files, setFiles] = useStateF([]);
  const [name, setName] = useStateF('');
  if (!animal) return <div style={{ padding: 30 }}>No animal selected.</div>;
  const cat = DOC_CATEGORIES.find(c => c.id === category);
  // Pick a media kind for the preview tile based on the doc type.
  const mediaKind = /x-ray|mri|ct/i.test(kind) ? 'xray'
    : (category === 'Diagnostics' || category === 'Consent') ? 'photo'
    : 'doc';
  const save = () => {
    const baseName = name || `${animal.name}-${kind}`;
    const ext = mediaKind === 'doc' ? '.pdf' : '.jpg';
    if (files.length === 0) {
      // Save a single empty record so the doc still appears in the list.
      IPD.addDocument(animal.id, {
        category, kind, name: baseName + ext, size: '0.6 MB',
        media: mediaKind, seed: 'doc-' + Date.now(),
      });
    } else {
      files.forEach((f, i) => {
        IPD.addDocument(animal.id, {
          category, kind,
          name: baseName + (files.length > 1 ? `-${i + 1}` : '') + ext,
          size: '0.6 MB',
          media: f.kind === 'xray' ? 'xray' : (f.kind === 'doc' ? 'doc' : 'photo'),
          seed: f.seed,
        });
      });
    }
    go('animal', { id: animal.id });
  };
  return (
    <div style={{ paddingBottom: 120 }}>
      <Header t={t} back={() => go('animal',{id: animal.id})} big title="Upload document" subtitle={animal.name}/>
      <div style={{ padding: '4px 14px', display:'flex', flexDirection:'column', gap: 14 }}>
        <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
          <Field t={t} label="Category">
            <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
              {DOC_CATEGORIES.map(c => (
                <Chip key={c.id} t={t} active={category===c.id} onClick={() => { setCategory(c.id); setKind(c.kinds[0]); }}>{c.id}</Chip>
              ))}
            </div>
          </Field>
          <Field t={t} label="Type">
            <Select t={t} value={kind} onChange={setKind} options={cat.kinds}/>
          </Field>
          <Field t={t} label="File name (optional)">
            <Input t={t} value={name} onChange={setName} placeholder={`${animal.name}-${kind}${mediaKind === 'doc' ? '.pdf' : '.jpg'}`}/>
          </Field>
          <UploadGrid t={t} label="Files" icon={Ic.Upload} items={files} type={mediaKind}
            onAdd={() => setFiles([...files, mkMedia('doc', mediaKind, `${kind} ${files.length + 1}`)])}/>
        </Card>
        <Btn t={t} onClick={save} icon={<Ic.Check size={16} stroke={2.5}/>}>Save document</Btn>
      </div>
    </div>
  );
}

// ── Documents (global, browse all) ───────────────────────────────────────────
function DocumentsScreen({ t, go }) {
  const docs = IPD.state.documents;
  const [q, setQ] = useStateF('');
  const [cat, setCat] = useStateF('all');
  const cats = ['all', ...new Set(docs.map(d => d.category))];
  const filtered = docs.filter(d => {
    if (cat !== 'all' && d.category !== cat) return false;
    if (q) {
      const Q = q.toLowerCase();
      const a = IPD.state.animals.find(x => x.id === d.animalId);
      if (!d.name.toLowerCase().includes(Q) && !d.kind.toLowerCase().includes(Q) && !(a?.name||'').toLowerCase().includes(Q)) return false;
    }
    return true;
  });
  return (
    <div style={{ paddingBottom: 100 }}>
      <Header t={t} big title="Documents" subtitle={`${docs.length} files across ${new Set(docs.map(d=>d.animalId)).size} animals`}/>
      <div style={{ padding: '8px 14px 0' }}>
        <div style={{ position:'relative' }}>
          <Ic.Search size={17} color={t.soft} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}/>
          <Input t={t} value={q} onChange={setQ} placeholder="Search file, animal, type" style={{ paddingLeft: 38 }}/>
        </div>
      </div>
      <div style={{ padding: '10px 14px', display:'flex', gap:6, overflowX:'auto' }}>
        {cats.map(c => <Chip key={c} t={t} active={cat===c} onClick={() => setCat(c)}>{c === 'all' ? 'All' : c}</Chip>)}
      </div>
      <div style={{ padding: '0 14px', display:'flex', flexDirection:'column', gap: 8 }}>
        {filtered.map(d => {
          const a = IPD.state.animals.find(x => x.id === d.animalId);
          return (
            <Card key={d.id} t={t} onClick={() => go('animal',{id:d.animalId})} style={{ cursor:'pointer', display:'flex', gap: 12, alignItems:'center' }}>
              <div style={{
                width: 38, height: 44, borderRadius: 6, background: t.accentSoft, color: t.accentInk,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0,
                fontSize: 11, fontWeight: 700,
              }}>{d.name.split('.').pop().toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize: 13.5, color: t.text, fontWeight: 600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</div>
                <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{a?.name} · {d.category} / {d.kind} · {d.size} · {fmt.rel(d.at)}</div>
              </div>
              <Ic.Chevron size={16} color={t.soft}/>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding:30, textAlign:'center', color:t.muted, fontSize:13.5 }}>No documents match.</div>
        )}
      </div>
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────
function ReportsScreen({ t, go }) {
  const [tab, setTab] = useStateF('today');
  return (
    <div style={{ paddingBottom: 100 }}>
      <Header t={t} big title="Reports" subtitle="Activity logs · animal records"/>
      <div style={{ padding: '0 14px' }}>
        <Segmented t={t} value={tab} onChange={setTab} options={[
          { value:'today',  label:'Activity by date' },
          { value:'animal', label:'By animal' },
        ]}/>
      </div>
      {tab === 'today' && <DateActivityReport t={t} go={go}/>}
      {tab === 'animal' && <AnimalReport t={t} go={go}/>}
    </div>
  );
}

function DateActivityReport({ t, go }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [dateStr, setDateStr] = useStateF(today.toISOString().slice(0,10));
  const [typeF, setTypeF] = useStateF('all');
  const selDate = new Date(dateStr); selDate.setHours(0,0,0,0);
  const end = new Date(selDate); end.setDate(end.getDate()+1);

  const rows = IPD.state.activities
    .filter(a => { const d = new Date(a.at); return d >= selDate && d < end; })
    .filter(a => typeF === 'all' || a.type === typeF)
    .sort((a,b) => new Date(a.at) - new Date(b.at));

  return (
    <div>
      <div style={{ padding: '12px 14px 0', display:'flex', flexDirection:'column', gap: 10 }}>
        <Field t={t} label="Date">
          <Input t={t} type="date" value={dateStr} onChange={setDateStr}/>
        </Field>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom: 4 }}>
          <Chip t={t} active={typeF==='all'} onClick={() => setTypeF('all')}>All ({rows.length})</Chip>
          {Object.keys(ACT_META).filter(x => x !== 'admission').map(k => (
            <Chip key={k} t={t} active={typeF===k} onClick={() => setTypeF(k)}>{ACT_META[k].label}</Chip>
          ))}
        </div>
      </div>

      <div style={{ padding: '6px 14px 0' }}>
        <div style={{ fontSize: 12, color: t.muted, padding: '6px 4px', display:'flex', justifyContent:'space-between' }}>
          <span>{rows.length} activities</span>
          <button style={{
            appearance:'none', border:0, background:'transparent', color: t.accent, fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
          }}>Export CSV</button>
        </div>

        <Card t={t} padded={false} style={{ overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1.2fr 0.7fr', gap: 8, padding:'10px 12px', background: t.surface2, fontSize: 11.5, fontWeight: 700, color: t.muted, letterSpacing: '0.05em', textTransform:'uppercase' }}>
            <span>Animal</span><span>Activity</span><span style={{ textAlign:'right' }}>Time</span>
          </div>
          {rows.map((a, i) => {
            const an = IPD.state.animals.find(x => x.id === a.animalId);
            const m = ACT_META[a.type];
            const I = m.icon;
            return (
              <div key={a.id} onClick={() => go('animal',{id:a.animalId})} style={{
                display:'grid', gridTemplateColumns:'1.6fr 1.2fr 0.7fr', gap: 8, alignItems:'center',
                padding:'10px 12px', borderTop: `0.5px solid ${t.line}`, cursor:'pointer',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, minWidth: 0 }}>
                  <Avatar animal={an} t={t} size={28}/>
                  <div style={{ overflow:'hidden' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:t.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{an?.name}</div>
                    <div style={{ fontSize:10.5, color:t.muted }}>{an?.ward}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:22, height:22, borderRadius:6, background: m.color+'22', color: m.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <I size={13} stroke={2}/>
                  </div>
                  <span style={{ fontSize: 12.5, color: t.text }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 12, color: t.muted, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmt.time(a.at)}</div>
              </div>
            );
          })}
          {rows.length === 0 && <div style={{ padding:24, textAlign:'center', color: t.muted, fontSize: 13.5 }}>No activities for this date.</div>}
        </Card>
      </div>
    </div>
  );
}

function AnimalReport({ t, go }) {
  const [animalId, setAnimalId] = useStateF(IPD.state.animals[0]?.id || '');
  const animal = IPD.state.animals.find(a => a.id === animalId);
  if (!animal) return null;
  const acts = IPD.activitiesFor(animal.id);
  const counts = {};
  Object.keys(ACT_META).forEach(k => counts[k] = acts.filter(a => a.type === k).length);
  return (
    <div style={{ padding: '12px 14px 0' }}>
      <Field t={t} label="Select animal">
        <Select t={t} value={animalId} onChange={setAnimalId}
          options={IPD.state.animals.map(a => ({ value: a.id, label: `${a.name} · ${a.species} · ${a.ward}` }))}/>
      </Field>

      <Card t={t} style={{ marginTop: 14, display:'flex', gap: 12, alignItems:'center' }}>
        <Avatar animal={animal} t={t} size={48}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:700, color:t.text }}>{animal.name}</div>
          <div style={{ fontSize:12, color:t.muted, marginTop:2 }}>{animal.species} · {animal.breed}</div>
          <div style={{ fontSize:12, color:t.muted, marginTop:2 }}>Admitted {fmt.dt(animal.admittedAt)}</div>
        </div>
        <StatusPill status={animal.status} dark={t.bg.startsWith('#0')}/>
      </Card>

      <div style={{ marginTop: 14, fontSize:12, fontWeight:700, color:t.muted, letterSpacing:'0.06em', textTransform:'uppercase' }}>Activity totals</div>
      <Card t={t} style={{ marginTop: 6 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 10 }}>
          {Object.keys(ACT_META).map(k => {
            const m = ACT_META[k]; const I = m.icon;
            return (
              <div key={k} style={{ display:'flex', alignItems:'center', gap: 9 }}>
                <div style={{ width:26, height:26, borderRadius: 7, background: m.color+'22', color: m.color, display:'flex', alignItems:'center', justifyContent:'center' }}><I size={14} stroke={2}/></div>
                <div style={{ flex:1, fontSize: 12.5, color: t.muted }}>{m.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{counts[k]}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ marginTop: 14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:12, fontWeight:700, color:t.muted, letterSpacing:'0.06em', textTransform:'uppercase' }}>Complete history</div>
        <button onClick={() => go('animal', { id: animal.id })} style={{
          appearance:'none', border:0, background:'transparent', color:t.accent, fontSize:13, fontWeight:600,
          cursor:'pointer', fontFamily:'inherit',
        }}>Open chart ›</button>
      </div>
      <div style={{ marginTop: 6, display:'flex', flexDirection:'column', gap: 8 }}>
        {acts.map(a => <ActivityCard key={a.id} act={a} t={t}/>)}
      </div>
    </div>
  );
}

// ── Discharge / Death flow ───────────────────────────────────────────────────
function DischargeScreen({ t, go, params }) {
  const animal = IPD.state.animals.find(a => a.id === params.id);
  const [type, setType] = useStateF('discharge'); // discharge | death
  const [reason, setReason] = useStateF('Recovered');
  const [postCare, setPostCare] = useStateF('');
  const [cause, setCause] = useStateF('');
  const [docs, setDocs] = useStateF([]);
  if (!animal) return null;
  const finish = () => {
    if (type === 'discharge') {
      IPD.state.historic.dischargesToday += 1;
    } else {
      IPD.state.historic.deathsToday += 1;
    }
    IPD.addActivity(animal.id, { type:'admission', summary: type === 'death' ? 'Patient deceased · ' + cause : 'Discharged · ' + reason });
    IPD.updateAnimal(animal.id, { status: type === 'death' ? 'Critical' : 'Stable' });
    go('home');
  };
  return (
    <div style={{ paddingBottom: 120 }}>
      <Header t={t} back={() => go('animal', {id: animal.id})} big title="End of stay" subtitle={animal.name}/>
      <div style={{ padding: '4px 14px', display:'flex', flexDirection:'column', gap: 14 }}>
        <Segmented t={t} value={type} onChange={setType} options={[
          { value:'discharge', label:'Discharge' },
          { value:'death',     label:'Death' },
        ]}/>
        <Card t={t} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
          {type === 'discharge' ? (
            <>
              <Field t={t} label="Reason">
                <Segmented t={t} value={reason} onChange={setReason} options={['Recovered','Improved','Owner request','Referred']}/>
              </Field>
              <Field t={t} label="Post-care instructions">
                <Textarea t={t} value={postCare} onChange={setPostCare} placeholder="Meds at home, follow-up date…"/>
              </Field>
              <UploadGrid t={t} label="Discharge summary / consent" icon={Ic.Doc} items={docs} type="doc"
                onAdd={() => setDocs([...docs, mkMedia('disch', 'doc', `Discharge ${docs.length + 1}`)])}/>
            </>
          ) : (
            <>
              <Field t={t} label="Cause of death">
                <Input t={t} value={cause} onChange={setCause} placeholder="Best-guess cause"/>
              </Field>
              <UploadGrid t={t} label="Death certificate / postmortem / body handover" icon={Ic.Doc} items={docs} type="doc"
                onAdd={() => setDocs([...docs, mkMedia('death', 'doc', `Death record ${docs.length + 1}`)])}/>
              <div style={{ padding:'10px 12px', background:'#FEE4E2', color:'#B42318', borderRadius: 10, fontSize: 12.5 }}>
                This will mark the animal as deceased and remove it from active IPD. Records are kept permanently.
              </div>
            </>
          )}
        </Card>
        <Btn t={t} variant={type === 'death' ? 'danger' : 'primary'} onClick={finish}
          icon={<Ic.Check size={16} stroke={2.5}/>}>
          {type === 'death' ? 'Record death' : 'Discharge patient'}
        </Btn>
      </div>
    </div>
  );
}

Object.assign(window, {
  PickAnimalScreen, AdmissionScreen, AddActivityScreen,
  UploadDocScreen, DocumentsScreen, ReportsScreen, DischargeScreen,
  MultiChips, UploadGrid, ToggleRow,
});
