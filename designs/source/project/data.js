// data.js — seed data + in-memory state store for the IPD prototype.
// Session-only: lost on refresh.

(function () {
  const now = new Date();
  const t = (h, m = 0, dayOffset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const SPECIES = ['Dog', 'Cat', 'Cow', 'Bird', 'Goat', 'Rabbit'];

  const animals = [
    {
      id: 'a1',
      name: 'Bruno',
      species: 'Dog',
      breed: 'Indie',
      gender: 'Male',
      age: '~3 yrs',
      color: 'Brown & white, white patch on chest',
      weight: '14 kg',
      vaccination: 'Partial',
      sterilized: 'No',
      aggressive: false,
      status: 'Critical',
      contagious: false,
      ward: 'ICU-2',
      admittedAt: t(8, 12, -1),
      rescuer: 'Priya Naik',
      rescuerPhone: '+91 98201 23456',
      ngo: 'Arham Rescue',
      broughtBy: 'Sahil (paramedic)',
      complaint: 'Hit by vehicle — left hindlimb fracture, mild shock',
      injuryType: 'Trauma / RTA',
      history: 'Found on Mulund link road. No prior history known.',
      diagnosis: 'Suspected femur fracture, monitor for internal bleeding',
      tests: ['X-ray', 'Blood Test'],
      surgeryReq: 'Yes — pending stabilization',
      photo: '#7a4a2f',
      photos: [
        { id:'p-a1-1', seed:'bruno-roadside',  kind:'photo', label:'On arrival — roadside' },
        { id:'p-a1-2', seed:'bruno-leg',       kind:'photo', label:'Left hindlimb' },
        { id:'p-a1-3', seed:'bruno-portrait',  kind:'photo', label:'Portrait' },
      ],
    },
    {
      id: 'a2',
      name: 'Mishti',
      species: 'Cat',
      breed: 'DSH',
      gender: 'Female',
      age: '~1.5 yrs',
      color: 'Calico',
      weight: '3.1 kg',
      vaccination: 'Done',
      sterilized: 'Yes',
      aggressive: false,
      status: 'Stable',
      contagious: false,
      ward: 'Cat ward',
      admittedAt: t(14, 30, -2),
      rescuer: 'Walk-in',
      rescuerPhone: '+91 99876 11122',
      ngo: '—',
      broughtBy: 'Reception',
      complaint: 'Anorexia x 3 days, vomiting',
      injuryType: 'Medical',
      history: 'Indoor cat. Owner reports reduced appetite.',
      diagnosis: 'Suspected gastritis',
      tests: ['Blood Test', 'Sonography'],
      surgeryReq: 'No',
      photo: '#a08060',
      photos: [
        { id:'p-a2-1', seed:'mishti-cage',     kind:'photo', label:'Settled in cat ward' },
        { id:'p-a2-2', seed:'mishti-front',    kind:'photo', label:'Calico markings' },
      ],
    },
    {
      id: 'a3',
      name: 'TempD-204',
      species: 'Dog',
      breed: 'Indie pup',
      gender: 'Male',
      age: '~2 mo',
      color: 'Black, tan paws',
      weight: '2.4 kg',
      vaccination: 'None',
      sterilized: 'No',
      aggressive: false,
      status: 'Observation',
      contagious: true,
      ward: 'Isolation-1',
      admittedAt: t(6, 5, 0),
      rescuer: 'Ramesh K.',
      rescuerPhone: '+91 91234 55667',
      ngo: 'Animal Ambulance #4',
      broughtBy: 'Vikram',
      complaint: 'Bloody diarrhea, lethargy — suspect parvo',
      injuryType: 'Medical / Infectious',
      history: 'Litter of 4, others healthy so far',
      diagnosis: 'R/o Canine Parvovirus',
      tests: ['Blood Test'],
      surgeryReq: 'No',
      photo: '#2a2520',
      photos: [
        { id:'p-a3-1', seed:'tempd-pup',       kind:'photo', label:'On admission — isolation' },
        { id:'p-a3-2', seed:'tempd-iv',        kind:'photo', label:'IV placed' },
      ],
    },
    {
      id: 'a4',
      name: 'Laxmi',
      species: 'Cow',
      breed: 'Gir',
      gender: 'Female',
      age: '~6 yrs',
      color: 'Reddish brown',
      weight: '320 kg',
      vaccination: 'Done',
      sterilized: 'No',
      aggressive: false,
      status: 'Stable',
      contagious: false,
      ward: 'Large animal',
      admittedAt: t(10, 0, -3),
      rescuer: 'Gaushala referral',
      rescuerPhone: '+91 98765 44332',
      ngo: 'Local gaushala',
      broughtBy: 'Sahil',
      complaint: 'Lameness right forelimb, swelling',
      injuryType: 'Trauma',
      history: 'Worked at field, sudden swelling 2 days ago',
      diagnosis: 'Soft tissue injury, r/o abscess',
      tests: ['X-ray', 'Sonography'],
      surgeryReq: 'Maybe',
      photo: '#8a5a3a',
      photos: [
        { id:'p-a4-1', seed:'laxmi-side',      kind:'photo', label:'Right forelimb swelling' },
        { id:'p-a4-2', seed:'laxmi-stall',     kind:'photo', label:'Large animal stall' },
      ],
    },
    {
      id: 'a5',
      name: 'Pixel',
      species: 'Cat',
      breed: 'Persian',
      gender: 'Male',
      age: '~4 yrs',
      color: 'White, blue eyes',
      weight: '4.6 kg',
      vaccination: 'Done',
      sterilized: 'Yes',
      aggressive: true,
      status: 'Stable',
      contagious: false,
      ward: 'Cat ward',
      admittedAt: t(17, 40, -1),
      rescuer: 'Owner — Mrs. Shah',
      rescuerPhone: '+91 98200 99887',
      ngo: '—',
      broughtBy: 'Reception',
      complaint: 'Post-neuter follow-up, mild fever',
      injuryType: 'Post-op',
      history: 'Neutered 4 days ago at our clinic',
      diagnosis: 'Mild post-op fever, monitor',
      tests: [],
      surgeryReq: 'No',
      photo: '#eeece6',
      photos: [
        { id:'p-a5-1', seed:'pixel-fluffy',    kind:'photo', label:'Re-admit portrait' },
      ],
    },
    {
      id: 'a6',
      name: 'TempB-09',
      species: 'Bird',
      breed: 'Pigeon',
      gender: 'Unknown',
      age: 'Adult',
      color: 'Grey',
      weight: '320 g',
      vaccination: 'N/A',
      sterilized: 'No',
      aggressive: false,
      status: 'Critical',
      contagious: false,
      ward: 'Aviary',
      admittedAt: t(11, 15, 0),
      rescuer: 'Walk-in',
      rescuerPhone: '+91 90000 00001',
      ngo: '—',
      broughtBy: 'Reception',
      complaint: 'Wing fracture, kite-string injury',
      injuryType: 'Trauma',
      history: 'Fell from balcony',
      diagnosis: 'Open fracture left wing',
      tests: ['X-ray'],
      surgeryReq: 'Yes',
      photo: '#9aa0a8',
      photos: [
        { id:'p-a6-1', seed:'bird-wing',       kind:'photo', label:'Wing on admission' },
        { id:'p-a6-2', seed:'bird-perch',      kind:'photo', label:'Aviary perch' },
      ],
    },
  ];

  const activities = [
    // Bruno (a1) — critical, lots of activity
    { id: 'x1',  animalId: 'a1', type: 'admission', at: t(8, 12, -1), by: 'Dr. Mehta', summary: 'Admitted — RTA, suspected femur fracture',
      photos: [
        { id:'mp-x1-1', seed:'bruno-roadside',  kind:'photo', label:'Roadside' },
        { id:'mp-x1-2', seed:'bruno-leg',       kind:'photo', label:'Left hindlimb' },
        { id:'mp-x1-3', seed:'bruno-arrival',   kind:'video', label:'Arrival clip', durationSec: 22 },
      ] },
    { id: 'x2',  animalId: 'a1', type: 'treatment', at: t(8, 30, -1), by: 'Nurse Pooja', meds: [{ name: 'Tramadol', dose: '20mg', route: 'IM' }, { name: 'Ringer Lactate', dose: '250ml', route: 'IV' }], remarks: 'Pain mgmt + fluids on admission',
      photos: [
        { id:'mp-x2-1', seed:'bruno-iv-line',   kind:'photo', label:'IV line placed' },
      ] },
    { id: 'x3',  animalId: 'a1', type: 'diagnostic', at: t(10, 0, -1), by: 'Dr. Mehta', tests: ['X-ray'], findings: 'Mid-shaft femur fracture, no displacement of pelvis', interpretation: 'Plan for ORIF once stable',
      photos: [
        { id:'mp-x3-1', seed:'bruno-xray-ap',   kind:'xray',  label:'Femur AP view' },
        { id:'mp-x3-2', seed:'bruno-xray-lat',  kind:'xray',  label:'Lateral view' },
      ] },
    { id: 'x4',  animalId: 'a1', type: 'round',     at: t(11, 0, -1), by: 'Dr. Mehta', temp: '102.4', appetite: 'Refused', hydration: 'Mild dehydration', pain: '6/10', wound: 'Closed, swollen', stool: 'Not passed', progress: 'Stabilizing', notes: 'Continue fluids, recheck in 4h',
      photos: [
        { id:'mp-x4-1', seed:'bruno-wound-1',   kind:'photo', label:'Wound — closed' },
      ] },
    { id: 'x5',  animalId: 'a1', type: 'food',      at: t(13, 0, -1), by: 'Sahil', foodType: 'Vegetable broth', qty: '50 ml', water: '30 ml', intake: 'Partially', vomiting: false,
      photos: [
        { id:'mp-x5-1', seed:'bruno-bowl-1',    kind:'photo', label:'Bowl after feed' },
      ] },
    { id: 'x6',  animalId: 'a1', type: 'treatment', at: t(20, 30, -1), by: 'Nurse Pooja', meds: [{ name: 'Ceftriaxone', dose: '500mg', route: 'IV' }], remarks: 'Antibiotic cover started' },
    { id: 'x7',  animalId: 'a1', type: 'round',     at: t(8, 0, 0),   by: 'Dr. Iyer',  temp: '101.6', appetite: 'Partial', hydration: 'OK', pain: '4/10', wound: 'Less swelling', stool: 'Passed', progress: 'Improving', notes: 'Surgery scheduled tomorrow AM',
      photos: [
        { id:'mp-x7-1', seed:'bruno-wound-2',   kind:'photo', label:'Wound — less swelling' },
        { id:'mp-x7-2', seed:'bruno-rest',      kind:'photo', label:'Resting in ICU' },
      ] },
    { id: 'x8',  animalId: 'a1', type: 'food',      at: t(9, 30, 0),  by: 'Sahil', foodType: 'Curd-rice & boiled veggies', qty: '120 g', water: '180 ml', intake: 'Fully', vomiting: false,
      photos: [
        { id:'mp-x8-1', seed:'bruno-bowl-2',    kind:'photo', label:'Cleared bowl' },
      ] },

    // Mishti (a2)
    { id: 'x10', animalId: 'a2', type: 'admission', at: t(14, 30, -2), by: 'Dr. Iyer', summary: 'Admitted — anorexia, vomiting',
      photos: [
        { id:'mp-x10-1', seed:'mishti-arrival', kind:'photo', label:'On arrival' },
      ] },
    { id: 'x11', animalId: 'a2', type: 'diagnostic',at: t(17, 0, -2), by: 'Dr. Iyer', tests: ['Blood test', 'Sonography'], findings: 'Mild elevation in liver enzymes; sono unremarkable', interpretation: 'Likely dietary indiscretion',
      photos: [
        { id:'mp-x11-1', seed:'mishti-cbc',    kind:'doc',   label:'CBC report' },
        { id:'mp-x11-2', seed:'mishti-sono',   kind:'xray',  label:'Abdominal sono' },
      ] },
    { id: 'x12', animalId: 'a2', type: 'treatment', at: t(19, 0, -2), by: 'Nurse Anu', meds: [{ name: 'Ondansetron', dose: '2mg', route: 'IV' }, { name: 'Pantoprazole', dose: '5mg', route: 'IV' }], remarks: 'Anti-emetic + PPI' },
    { id: 'x13', animalId: 'a2', type: 'round',     at: t(9, 0, -1),  by: 'Dr. Iyer',  temp: '101.0', appetite: 'Partial', hydration: 'OK', pain: '1/10', wound: 'N/A', stool: 'Normal', progress: 'Improving', notes: 'Continue oral meds, plan discharge if tolerated' },
    { id: 'x14', animalId: 'a2', type: 'food',      at: t(10, 0, -1), by: 'Anu', foodType: 'Paneer crumble + curd (small)', qty: '40 g', water: '60 ml', intake: 'Fully', vomiting: false },
    { id: 'x15', animalId: 'a2', type: 'round',     at: t(10, 0, 0),  by: 'Dr. Iyer',  temp: '100.8', appetite: 'Normal', hydration: 'Good', pain: '0/10', wound: 'N/A', stool: 'Normal', progress: 'Recovered', notes: 'Ready for discharge today' },

    // TempD-204 (a3) — parvo suspect
    { id: 'x20', animalId: 'a3', type: 'admission', at: t(6, 5, 0),   by: 'Dr. Iyer', summary: 'Admitted — bloody diarrhea, lethargy',
      photos: [
        { id:'mp-x20-1', seed:'tempd-arrival', kind:'photo', label:'On arrival — lethargic' },
        { id:'mp-x20-2', seed:'tempd-iso',    kind:'photo', label:'Isolation kennel' },
      ] },
    { id: 'x21', animalId: 'a3', type: 'treatment', at: t(6, 30, 0),  by: 'Nurse Pooja', meds: [{ name: 'NS', dose: '50ml', route: 'IV' }, { name: 'Ondansetron', dose: '0.5mg', route: 'IV' }], remarks: 'Fluid resus, isolation precautions',
      photos: [
        { id:'mp-x21-1', seed:'tempd-fluids', kind:'photo', label:'Fluids running' },
      ] },
    { id: 'x22', animalId: 'a3', type: 'diagnostic',at: t(7, 30, 0),  by: 'Dr. Iyer', tests: ['Blood test'], findings: 'Parvo Ag positive (snap test)', interpretation: 'Confirmed parvo. Continue supportive care.',
      photos: [
        { id:'mp-x22-1', seed:'tempd-snap',  kind:'photo', label:'Snap test — positive' },
      ] },
    { id: 'x23', animalId: 'a3', type: 'bath',      at: t(9, 0, 0),   by: 'Sahil', bathType: 'Wound cleaning', remarks: 'Hindquarters cleaned of stool',
      photos: [
        { id:'mp-x23-1', seed:'tempd-clean', kind:'photo', label:'After cleaning' },
      ] },

    // Laxmi (a4) — no updates recently (test for 6h alert)
    { id: 'x30', animalId: 'a4', type: 'admission', at: t(10, 0, -3), by: 'Dr. Iyer', summary: 'Admitted — lameness, swelling',
      photos: [
        { id:'mp-x30-1', seed:'laxmi-arrive', kind:'photo', label:'Brought from gaushala' },
        { id:'mp-x30-2', seed:'laxmi-leg',   kind:'photo', label:'Right foreleg swelling' },
      ] },
    { id: 'x31', animalId: 'a4', type: 'diagnostic',at: t(14, 0, -3), by: 'Dr. Iyer', tests: ['X-ray'], findings: 'No fracture, soft tissue oedema', interpretation: 'Conservative mgmt',
      photos: [
        { id:'mp-x31-1', seed:'laxmi-xray',  kind:'xray',  label:'Carpal joint X-ray' },
      ] },
    { id: 'x32', animalId: 'a4', type: 'treatment', at: t(15, 0, -3), by: 'Sahil', meds: [{ name: 'Meloxicam', dose: '40mg', route: 'IM' }], remarks: 'Anti-inflammatory' },
    { id: 'x33', animalId: 'a4', type: 'food',      at: t(8, 0, -1),  by: 'Sahil', foodType: 'Hay + bran', qty: '5 kg', water: '20 L', intake: 'Fully', vomiting: false },
    { id: 'x34', animalId: 'a4', type: 'walk',      at: t(11, 0, -1), by: 'Sahil', duration: '15 min', urination: true, stool: true, mobility: 'Mild limp', assisted: false },

    // Pixel (a5)
    { id: 'x40', animalId: 'a5', type: 'admission', at: t(17, 40, -1), by: 'Dr. Mehta', summary: 'Re-admit — post-op fever' },
    { id: 'x41', animalId: 'a5', type: 'treatment', at: t(18, 0, -1), by: 'Nurse Anu', meds: [{ name: 'Amoxiclav', dose: '50mg', route: 'Oral' }], remarks: 'Empiric AB' },
    { id: 'x42', animalId: 'a5', type: 'round',     at: t(9, 0, 0),   by: 'Dr. Mehta', temp: '102.2', appetite: 'Partial', hydration: 'OK', pain: '2/10', wound: 'Healing, no discharge', stool: 'Normal', progress: 'Improving', notes: 'Continue AB x 3 days' },
    { id: 'x43', animalId: 'a5', type: 'food',      at: t(10, 30, 0), by: 'Anu', foodType: 'Veg kibble + curd', qty: '80 g', water: '100 ml', intake: 'Fully', vomiting: false },

    // Bird (a6)
    { id: 'x50', animalId: 'a6', type: 'admission', at: t(11, 15, 0), by: 'Dr. Mehta', summary: 'Admitted — wing fracture',
      photos: [
        { id:'mp-x50-1', seed:'bird-arrival', kind:'photo', label:'On arrival — wing extended' },
        { id:'mp-x50-2', seed:'bird-closeup', kind:'photo', label:'Open fracture' },
      ] },
    { id: 'x51', animalId: 'a6', type: 'diagnostic',at: t(12, 0, 0),  by: 'Dr. Mehta', tests: ['X-ray'], findings: 'Open fracture distal radius', interpretation: 'Surgery indicated',
      photos: [
        { id:'mp-x51-1', seed:'bird-xray',  kind:'xray',  label:'Wing X-ray' },
      ] },
    { id: 'x52', animalId: 'a6', type: 'surgery',   at: t(14, 30, 0), by: 'Dr. Mehta', surgeryName: 'Wing fracture repair', surgeon: 'Dr. Mehta', anesthesia: 'Isoflurane', duration: '45 min', findings: 'Clean reduction, pin placed', complications: 'None', postOp: 'Cage rest, AB x 7 days',
      photos: [
        { id:'mp-x52-1', seed:'bird-ot-1',   kind:'photo', label:'OT — prep' },
        { id:'mp-x52-2', seed:'bird-ot-2',   kind:'photo', label:'OT — pin placement' },
        { id:'mp-x52-3', seed:'bird-ot-3',   kind:'video', label:'Reduction clip', durationSec: 41 },
        { id:'mp-x52-4', seed:'bird-postop', kind:'xray',  label:'Post-op X-ray' },
      ] },
  ];

  // historic events for the summary count (today)
  const historic = {
    surgeriesToday: 1,   // Bird wing
    deathsToday: 0,
    dischargesToday: 1,  // Mishti planned
  };

  // Document records — `media` tells the renderer how to draw the preview tile.
  const documents = [
    { id: 'd1', animalId: 'a1', category: 'Diagnostics', kind: 'X-ray',          name: 'Bruno-femur-AP.jpg',     size: '2.1 MB', at: t(10, 5, -1),  by: 'Dr. Mehta',  media: 'xray',  seed:'bruno-xray-ap' },
    { id: 'd1b',animalId: 'a1', category: 'Diagnostics', kind: 'X-ray',          name: 'Bruno-femur-LAT.jpg',    size: '1.9 MB', at: t(10, 8, -1),  by: 'Dr. Mehta',  media: 'xray',  seed:'bruno-xray-lat' },
    { id: 'd2', animalId: 'a1', category: 'Medical',    kind: 'Referral',        name: 'Mulund-vet-referral.pdf',size: '180 KB', at: t(8, 10, -1),  by: 'Reception',  media: 'doc',   seed:'doc-referral-1' },
    { id: 'd3', animalId: 'a2', category: 'Diagnostics', kind: 'Blood report',   name: 'Mishti-CBC.pdf',         size: '320 KB', at: t(17, 30, -2), by: 'Lab',        media: 'doc',   seed:'doc-cbc-mishti' },
    { id: 'd3b',animalId: 'a2', category: 'Diagnostics', kind: 'Sonography',     name: 'Mishti-abd-sono.jpg',    size: '1.1 MB', at: t(17, 5, -2),  by: 'Lab',        media: 'xray',  seed:'mishti-sono' },
    { id: 'd4', animalId: 'a6', category: 'Consent',    kind: 'Surgery consent', name: 'Bird-consent.jpg',       size: '1.4 MB', at: t(13, 50, 0),  by: 'Reception',  media: 'photo', seed:'doc-consent-bird' },
    { id: 'd4b',animalId: 'a6', category: 'Diagnostics', kind: 'X-ray',          name: 'Bird-wing-preop.jpg',    size: '2.4 MB', at: t(12, 10, 0),  by: 'Dr. Mehta',  media: 'xray',  seed:'bird-xray' },
    { id: 'd4c',animalId: 'a6', category: 'Diagnostics', kind: 'X-ray',          name: 'Bird-wing-postop.jpg',   size: '2.6 MB', at: t(15, 30, 0),  by: 'Dr. Mehta',  media: 'xray',  seed:'bird-postop' },
    { id: 'd5', animalId: 'a5', category: 'Ownership',  kind: 'Owner ID',        name: 'Shah-ID.pdf',            size: '420 KB', at: t(17, 35, -1), by: 'Reception',  media: 'doc',   seed:'doc-owner-shah' },
  ];

  const state = {
    role: 'staff', // staff | doctor | admin
    me: { staff: 'Sahil (paramedic)', doctor: 'Dr. Mehta', admin: 'Reception (Asha)' },
    animals,
    activities,
    documents,
    historic,
    // ui
    nav: { screen: 'home', params: {} },
    listeners: new Set(),
  };

  function notify() {
    state.listeners.forEach(fn => { try { fn(); } catch (e) {} });
  }

  const api = {
    state,
    subscribe(fn) { state.listeners.add(fn); return () => state.listeners.delete(fn); },
    setRole(r)   { state.role = r; notify(); },
    go(screen, params = {}) { state.nav = { screen, params }; notify(); window.scrollTo?.(0, 0); },
    back() { state.nav = { screen: 'home', params: {} }; notify(); },
    addAnimal(a) {
      const id = 'a' + (state.animals.length + 100);
      const animal = { id, admittedAt: new Date().toISOString(), status: 'Observation', ...a };
      state.animals.unshift(animal);
      state.activities.unshift({
        id: 'x' + Date.now(), animalId: id, type: 'admission',
        at: animal.admittedAt, by: state.me[state.role],
        summary: 'Admitted — ' + (a.complaint || 'New patient'),
      });
      notify();
      return animal;
    },
    addActivity(animalId, act) {
      const a = { id: 'x' + Date.now(), animalId, at: new Date().toISOString(), by: state.me[state.role], ...act };
      state.activities.unshift(a);
      notify();
      return a;
    },
    addDocument(animalId, doc) {
      const d = { id: 'd' + Date.now(), animalId, at: new Date().toISOString(), by: state.me[state.role], ...doc };
      state.documents.unshift(d);
      notify();
      return d;
    },
    updateAnimal(id, patch) {
      const a = state.animals.find(x => x.id === id);
      if (a) {
        Object.assign(a, patch);
        a.editedAt = new Date().toISOString();
        a.editedBy = state.me[state.role];
      }
      notify();
    },
    updateActivity(id, patch) {
      const a = state.activities.find(x => x.id === id);
      if (a) {
        Object.assign(a, patch);
        a.editedAt = new Date().toISOString();
        a.editedBy = state.me[state.role];
      }
      notify();
      return a;
    },
    deleteActivity(id) {
      const idx = state.activities.findIndex(x => x.id === id);
      if (idx === -1) return null;
      const [removed] = state.activities.splice(idx, 1);
      notify();
      return { removed, idx };
    },
    restoreActivity(removed, idx) {
      state.activities.splice(idx, 0, removed);
      notify();
    },
    duplicateActivity(id) {
      const orig = state.activities.find(x => x.id === id);
      if (!orig) return null;
      const copy = {
        ...orig,
        id: 'x' + Date.now(),
        at: new Date().toISOString(),
        by: state.me[state.role],
        duplicatedFrom: orig.id,
      };
      delete copy.editedAt; delete copy.editedBy;
      state.activities.unshift(copy);
      notify();
      return copy;
    },
    updateDocument(id, patch) {
      const d = state.documents.find(x => x.id === id);
      if (d) Object.assign(d, patch);
      notify();
    },
    deleteDocument(id) {
      const idx = state.documents.findIndex(x => x.id === id);
      if (idx === -1) return null;
      const [removed] = state.documents.splice(idx, 1);
      notify();
      return { removed, idx };
    },
    restoreDocument(removed, idx) {
      state.documents.splice(idx, 0, removed);
      notify();
    },
    activitiesFor(animalId) {
      return state.activities
        .filter(a => a.animalId === animalId)
        .sort((a, b) => new Date(b.at) - new Date(a.at));
    },
    // All proof media for an animal, chronologically (newest first).
    // Pulled from admission photos, every activity's photos, and image-kind docs.
    mediaFor(animalId) {
      const out = [];
      const animal = state.animals.find(a => a.id === animalId);
      if (animal && Array.isArray(animal.photos)) {
        animal.photos.forEach(p => out.push({
          ...p,
          at: animal.admittedAt,
          source: 'admission',
          by: animal.rescuer || animal.broughtBy || 'On admission',
          time: 'On admission',
        }));
      }
      state.activities.filter(a => a.animalId === animalId).forEach(act => {
        if (!Array.isArray(act.photos)) return;
        const meta = { round:'Round', treatment:'Treatment', diagnostic:'Diagnostic',
          surgery:'Surgery', food:'Food', bath:'Bath', walk:'Walk', admission:'Admission' };
        act.photos.forEach(p => out.push({
          ...p,
          at: act.at,
          source: act.type,
          activityId: act.id,
          by: act.by,
          context: meta[act.type] || act.type,
        }));
      });
      state.documents.filter(d => d.animalId === animalId && (d.media === 'photo' || d.media === 'xray')).forEach(d => {
        out.push({
          id: d.id, seed: d.seed || d.id, kind: d.media,
          label: d.kind + ' \u2014 ' + d.name,
          at: d.at, source: 'document', by: d.by, context: d.kind,
        });
      });
      // sort newest first
      out.sort((a, b) => new Date(b.at) - new Date(a.at));
      return out;
    },
    lastActivityAt(animalId) {
      const list = api.activitiesFor(animalId);
      return list.length ? list[0].at : null;
    },
    activitiesToday() {
      const today = new Date(); today.setHours(0,0,0,0);
      return state.activities.filter(a => new Date(a.at) >= today);
    },
    animalsToday() {
      const today = new Date(); today.setHours(0,0,0,0);
      return state.animals.filter(a => new Date(a.admittedAt) >= today);
    },
    SPECIES,
  };

  window.IPD = api;
})();
