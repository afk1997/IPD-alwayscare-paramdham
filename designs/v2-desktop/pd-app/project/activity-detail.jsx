// activity-detail.jsx — Activity detail bottom-sheet + inline edit.
// Tap any activity card/timeline row → opens ActivitySheet.
// Supports view / edit / duplicate / delete (with undo via toast).

const { useState: useSAD, useEffect: useEAD } = React;

// ── Field renderers per activity type ────────────────────────────────────────
// Each returns an array of { label, value, big? } entries to render.

function fieldsFor(act) {
  const out = [];
  const push = (label, value, opts = {}) => {
    if (value === undefined || value === null || value === '') return;
    out.push({ label, value, ...opts });
  };

  switch (act.type) {
    case 'admission':
      push('Summary', act.summary, { big: true });
      break;

    case 'treatment':
      // meds rendered separately
      push('Overall remarks', act.remarks, { big: true });
      break;

    case 'round':
      push('Temperature', act.temp ? `${act.temp} °F` : null);
      push('Pain', act.pain);
      push('Appetite', act.appetite);
      push('Hydration', act.hydration);
      push('Wound', act.wound);
      push('Stool / Urine', act.stool);
      push('Progress', act.progress);
      push('New instructions', act.notes, { big: true });
      break;

    case 'diagnostic':
      push('Tests', (act.tests || []).join(', '));
      push('Findings', act.findings, { big: true });
      push('Interpretation', act.interpretation, { big: true });
      if (act.reportCount) push('Reports attached', act.reportCount + ' file(s)');
      break;

    case 'surgery':
      push('Surgery', act.surgeryName, { big: true });
      push('Surgeon', act.surgeon);
      push('Anesthesia', act.anesthesia);
      push('Duration', act.duration);
      push('Findings', act.findings, { big: true });
      push('Complications', act.complications, { big: true });
      push('Post-op care', act.postOp, { big: true });
      break;

    case 'food':
      push('Food type', act.foodType, { big: true });
      push('Quantity', act.qty);
      push('Water', act.water);
      push('Intake', act.intake);
      push('Vomiting?', act.vomiting ? 'Yes' : 'No');
      break;

    case 'bath':
      push('Type', act.bathType, { big: true });
      push('Remarks', act.remarks, { big: true });
      break;

    case 'walk':
      push('Duration', act.duration);
      push('Urination', act.urination ? 'Passed' : 'Not passed');
      push('Stool', act.stool ? 'Passed' : 'Not passed');
      push('Mobility', act.mobility);
      push('Movement', act.assisted ? 'Assisted' : 'Independent');
      break;

    default:
      push('Summary', act.summary || activitySummary(act), { big: true });
  }
  push('Notes', act.notes && act.type !== 'round' ? act.notes : null, { big: true });
  return out;
}

// ── The sheet ────────────────────────────────────────────────────────────────
function ActivitySheet({ open, activityId, t, onClose, onEdited, onToast, onOpenPhotos }) {
  const [mode, setMode] = useSAD('view'); // view | edit | confirmDelete

  // Reset to view on each open
  useEAD(() => { if (open) setMode('view'); }, [open, activityId]);

  if (!open) return null;
  const act = IPD.state.activities.find(a => a.id === activityId);
  if (!act) return null;

  const animal = IPD.state.animals.find(a => a.id === act.animalId);
  const m = ACT_META[act.type] || ACT_META.admission;

  const close = () => onClose && onClose();

  const onDelete = () => {
    const result = IPD.deleteActivity(act.id);
    if (result && onToast) {
      onToast({
        msg: m.label + ' deleted',
        actionLabel: 'Undo',
        action: () => IPD.restoreActivity(result.removed, result.idx),
      });
    }
    close();
  };

  const onDuplicate = () => {
    IPD.duplicateActivity(act.id);
    onToast && onToast({ msg: m.label + ' duplicated to now' });
    close();
  };

  const mobile = window.UI_MODE === 'mobile';

  if (mobile) {
    return (
      <div onClick={close} style={{
        position: 'fixed', inset: 0, background: 'rgba(8,10,15,0.45)', zIndex: 50,
        display: 'flex', alignItems: 'flex-end',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', maxHeight: '88vh', background: t.surface,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          animation: 'slideUp 0.25s cubic-bezier(.2,.7,.3,1)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          <div style={{ width: 38, height: 4, background: t.line, borderRadius: 2, margin: '8px auto 6px', flexShrink: 0 }} />
          {sheetBody()}
        </div>
      </div>
    );
  }

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, background: 'rgba(8,10,15,0.42)', zIndex: 100,
      display: 'flex', justifyContent: 'flex-end',
      animation: 'fadeIn 0.15s ease-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(560px, 100%)', height: '100%', background: t.surface,
        borderLeft: `1px solid ${t.line}`,
        animation: 'slideRight 0.22s cubic-bezier(.2,.7,.3,1)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(8,10,15,0.18)',
      }}>
        {sheetBody()}
      </div>
    </div>
  );

  // ── inner body, shared between mobile bottom sheet & web side drawer ──
  function sheetBody() {
    return <>

        {/* Header */}
        <div style={{
          padding: '6px 16px 12px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: `0.5px solid ${t.line}`, flexShrink: 0,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: m.color + '22', color: m.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}><m.icon size={20} stroke={2} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{m.label}</div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
              {animal?.name} · {fmt.dt(act.at)}
            </div>
          </div>
          <button onClick={close} style={iconBtn(t)} aria-label="Close">
            <Ic.Close size={18} color={t.muted} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {mode === 'view' && <ActivityView act={act} t={t} onOpenPhotos={onOpenPhotos}/>}
          {mode === 'edit' && <ActivityEdit act={act} t={t} onCancel={() => setMode('view')} onSaved={() => { setMode('view'); onEdited && onEdited(); onToast && onToast({ msg: m.label + ' updated' }); }} />}
          {mode === 'confirmDelete' && (
            <div style={{ padding: '18px 16px 8px' }}>
              <div style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>Delete this {m.label.toLowerCase()}?</div>
              <div style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>
                You can undo for a few seconds after deleting.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <Btn t={t} variant="ghost" onClick={() => setMode('view')} style={{ flex: 1 }}>Cancel</Btn>
                <Btn t={t} variant="danger" onClick={onDelete} style={{ flex: 1 }} icon={<Ic.Trash size={15} stroke={2.2} />}>Delete</Btn>
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        {mode === 'view' && (
          <div style={{
            display: 'flex', gap: 8, padding: '10px 14px 22px',
            borderTop: `0.5px solid ${t.line}`, background: t.surface,
            flexShrink: 0,
          }}>
            <button onClick={() => setMode('confirmDelete')} style={actionBtn(t, 'danger')}>
              <Ic.Trash size={16} stroke={2} /> Delete
            </button>
            <button onClick={onDuplicate} style={actionBtn(t)}>
              <Ic.Copy size={16} stroke={2} /> Duplicate
            </button>
            <button onClick={() => setMode('edit')} style={{
              ...actionBtn(t, 'primary'), flex: 1.4,
            }}>
              <Ic.Edit size={16} stroke={2.2} /> Edit
            </button>
          </div>
        )}
      </>;
  }
}

// ── Read-only view ───────────────────────────────────────────────────────────
function ActivityView({ act, t, onOpenPhotos }) {
  const animal = IPD.state.animals.find(a => a.id === act.animalId);
  const fields = fieldsFor(act);
  const m = ACT_META[act.type] || ACT_META.admission;
  const photos = Array.isArray(act.photos) ? act.photos : [];
  return (
    <div style={{ padding: '8px 16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Media banner up top — proof-first */}
      {photos.length > 0 && (
        <div style={{ marginTop: 8, marginBottom: 4 }}>
          {photos.length === 1 ? (
            <Photo seed={photos[0].seed || photos[0].id} kind={photos[0].kind || 'photo'}
              label={photos[0].label} time={fmt.time(act.at)}
              style={{ width: '100%', aspectRatio: '16 / 10', borderRadius: 12 }}
              rounded={12}
              onClick={() => onOpenPhotos && onOpenPhotos(photos, 0)}/>
          ) : (
            <MediaGrid t={t} photos={photos}
              cols={photos.length === 2 ? 2 : 3}
              ratio={photos.length === 2 ? 1.1 : 1}
              onOpen={(p, i) => onOpenPhotos && onOpenPhotos(p, i)}/>
          )}
          <div style={{ fontSize: 11.5, color: t.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ic.Camera size={12}/> {photos.length} attached · tap to view
          </div>
        </div>
      )}
      {/* Summary line */}
      <div style={{
        padding: '12px 14px', background: m.color + '14', borderLeft: `3px solid ${m.color}`,
        borderRadius: 10, color: t.text, fontSize: 14.5, fontWeight: 500, lineHeight: 1.45,
        marginTop: 6, marginBottom: 12,
      }}>
        {activitySummary(act)}
      </div>

      {/* Meds table for treatment */}
      {act.type === 'treatment' && Array.isArray(act.meds) && act.meds.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <SectionLabel t={t}>Medicines · {act.meds.length}</SectionLabel>
          <Card t={t} padded={false} style={{ overflow: 'hidden' }}>
            {act.meds.map((med, i) => (
              <div key={i} style={{
                padding: '11px 13px',
                borderTop: i === 0 ? 0 : `0.5px solid ${t.line}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: t.accentSoft,
                  color: t.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{med.name || '—'}</div>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
                    {[med.dose, med.route].filter(Boolean).join(' · ')}
                    {med.remarks && <span> — {med.remarks}</span>}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Fields */}
      {fields.length > 0 && (
        <>
          <SectionLabel t={t}>Details</SectionLabel>
          <Card t={t}>
            {fields.map((f, i) => (
              <div key={f.label} style={{
                padding: '9px 0',
                borderBottom: i === fields.length - 1 ? 0 : `0.5px solid ${t.line}`,
              }}>
                <div style={{
                  fontSize: 11, color: t.muted, fontWeight: 600,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>{f.label}</div>
                <div style={{
                  fontSize: f.big ? 14 : 13.5, color: t.text, marginTop: 3, lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                }}>{f.value}</div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Meta */}
      <SectionLabel t={t}>Audit</SectionLabel>
      <Card t={t}>
        <KV t={t} k="Logged by" v={act.by} />
        <KV t={t} k="Logged at" v={fmt.dt(act.at)} />
        {act.editedBy && <KV t={t} k="Last edited" v={`${act.editedBy} · ${fmt.rel(act.editedAt)}`} />}
        {act.duplicatedFrom && <KV t={t} k="Duplicated from" v={'#' + act.duplicatedFrom} />}
        <KV t={t} k="Patient" v={animal ? `${animal.name} · ${animal.ward}` : '—'} last />
      </Card>
    </div>
  );
}

function SectionLabel({ t, children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: t.muted, letterSpacing: '0.07em',
      textTransform: 'uppercase', padding: '14px 2px 6px',
    }}>{children}</div>
  );
}

// ── Edit mode ────────────────────────────────────────────────────────────────
function ActivityEdit({ act, t, onCancel, onSaved }) {
  // Clone the act into local state, drop computed/id fields.
  const initial = { ...act };
  delete initial.id; delete initial.animalId; delete initial.editedAt; delete initial.editedBy;
  const [f, setF] = useSAD(initial);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const save = () => {
    IPD.updateActivity(act.id, f);
    onSaved && onSaved();
  };

  // Datetime input value
  const dtVal = (() => {
    const d = new Date(f.at);
    if (isNaN(d)) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })();
  const onDt = (v) => set('at', new Date(v).toISOString());

  return (
    <div style={{ padding: '6px 16px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel t={t}>Edit details</SectionLabel>

      <Card t={t} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field t={t} label="When">
          <Input t={t} type="datetime-local" value={dtVal} onChange={onDt} />
        </Field>
        <Field t={t} label="Logged by">
          <Input t={t} value={f.by} onChange={v => set('by', v)} />
        </Field>

        {/* Type-specific fields */}
        {act.type === 'admission' && (
          <Field t={t} label="Summary"><Textarea t={t} value={f.summary} onChange={v => set('summary', v)} /></Field>
        )}

        {act.type === 'treatment' && (
          <EditMeds t={t} meds={f.meds || []} onChange={v => set('meds', v)} remarks={f.remarks || ''} onRemarks={v => set('remarks', v)} />
        )}

        {act.type === 'round' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field t={t} label="Temperature (°F)"><Input t={t} value={f.temp} onChange={v => set('temp', v)} /></Field>
            <Field t={t} label="Pain">
              <Select t={t} value={f.pain} onChange={v => set('pain', v)}
                options={['0/10','1/10','2/10','3/10','4/10','5/10','6/10','7/10','8/10','9/10','10/10']} />
            </Field>
          </div>
          <Field t={t} label="Appetite"><Segmented t={t} value={f.appetite} onChange={v => set('appetite', v)} options={['Normal','Partial','Refused']} /></Field>
          <Field t={t} label="Hydration"><Segmented t={t} value={f.hydration} onChange={v => set('hydration', v)} options={['Good','OK','Mild','Severe']} /></Field>
          <Field t={t} label="Wound"><Input t={t} value={f.wound} onChange={v => set('wound', v)} /></Field>
          <Field t={t} label="Stool / Urine"><Input t={t} value={f.stool} onChange={v => set('stool', v)} /></Field>
          <Field t={t} label="Progress"><Segmented t={t} value={f.progress} onChange={v => set('progress', v)} options={['Worsening','Stable','Improving','Recovered']} /></Field>
          <Field t={t} label="Notes"><Textarea t={t} value={f.notes} onChange={v => set('notes', v)} /></Field>
        </>}

        {act.type === 'diagnostic' && <>
          <Field t={t} label="Tests">
            <MultiChips t={t} value={f.tests || []} onChange={v => set('tests', v)} options={['Blood test','X-ray','Sonography','MRI','CT Scan','Urine','Other']} />
          </Field>
          <Field t={t} label="Findings"><Textarea t={t} value={f.findings} onChange={v => set('findings', v)} /></Field>
          <Field t={t} label="Interpretation"><Textarea t={t} value={f.interpretation} onChange={v => set('interpretation', v)} /></Field>
        </>}

        {act.type === 'surgery' && <>
          <Field t={t} label="Surgery name"><Input t={t} value={f.surgeryName} onChange={v => set('surgeryName', v)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field t={t} label="Surgeon"><Input t={t} value={f.surgeon} onChange={v => set('surgeon', v)} /></Field>
            <Field t={t} label="Duration"><Input t={t} value={f.duration} onChange={v => set('duration', v)} /></Field>
          </div>
          <Field t={t} label="Anesthesia"><Input t={t} value={f.anesthesia} onChange={v => set('anesthesia', v)} /></Field>
          <Field t={t} label="Findings"><Textarea t={t} value={f.findings} onChange={v => set('findings', v)} /></Field>
          <Field t={t} label="Complications"><Textarea t={t} value={f.complications} onChange={v => set('complications', v)} /></Field>
          <Field t={t} label="Post-op care"><Textarea t={t} value={f.postOp} onChange={v => set('postOp', v)} /></Field>
        </>}

        {act.type === 'food' && <>
          <Field t={t} label="Food type"><Input t={t} value={f.foodType} onChange={v => set('foodType', v)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field t={t} label="Quantity"><Input t={t} value={f.qty} onChange={v => set('qty', v)} /></Field>
            <Field t={t} label="Water"><Input t={t} value={f.water} onChange={v => set('water', v)} /></Field>
          </div>
          <Field t={t} label="Intake"><Segmented t={t} value={f.intake} onChange={v => set('intake', v)} options={['Fully','Partially','Refused']} /></Field>
          <ToggleRow t={t} label="Vomiting?" value={!!f.vomiting} onChange={v => set('vomiting', v)} />
        </>}

        {act.type === 'bath' && <>
          <Field t={t} label="Type of bath">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Medicated bath','Tick treatment','Wound cleaning','Regular bath','Coat grooming','Nail trim'].map(o => (
                <Chip key={o} t={t} active={f.bathType === o} onClick={() => set('bathType', o)}>{o}</Chip>
              ))}
            </div>
          </Field>
          <Field t={t} label="Remarks"><Textarea t={t} value={f.remarks} onChange={v => set('remarks', v)} /></Field>
        </>}

        {act.type === 'walk' && <>
          <Field t={t} label="Duration"><Input t={t} value={f.duration} onChange={v => set('duration', v)} /></Field>
          <div style={{ display: 'flex', gap: 16 }}>
            <ToggleRow t={t} label="Urination" value={!!f.urination} onChange={v => set('urination', v)} />
            <ToggleRow t={t} label="Stool" value={!!f.stool} onChange={v => set('stool', v)} />
          </div>
          <Field t={t} label="Mobility"><Segmented t={t} value={f.mobility} onChange={v => set('mobility', v)} options={['Normal','Mild limp','Severe limp','Unable']} /></Field>
          <Field t={t} label="Movement">
            <Segmented t={t} value={f.assisted ? 'Assisted' : 'Independent'}
              onChange={v => set('assisted', v === 'Assisted')}
              options={['Independent','Assisted']} />
          </Field>
        </>}
      </Card>

      <div style={{ display: 'flex', gap: 10, padding: '6px 0 22px' }}>
        <Btn t={t} variant="ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</Btn>
        <Btn t={t} onClick={save} style={{ flex: 1.6 }} icon={<Ic.Check size={16} stroke={2.5} />}>Save changes</Btn>
      </div>
    </div>
  );
}

function ToggleRow({ t, label, value, onChange }) {
  // mirror of forms file to avoid scope leak — minimal version
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: t.text, cursor: 'pointer', flex: 1 }}>
      <Toggle t={t} value={value} onChange={onChange} />
      <span style={{ fontWeight: 500 }}>{label}</span>
    </label>
  );
}

function EditMeds({ t, meds, onChange, remarks, onRemarks }) {
  const set = (i, k, v) => onChange(meds.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const add = () => onChange([...meds, { name: '', dose: '', route: 'IV', remarks: '' }]);
  const del = (i) => onChange(meds.filter((_, j) => j !== i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: t.muted }}>Medicines</div>
      {meds.map((m, i) => (
        <div key={i} style={{
          padding: 11, border: `1px solid ${t.line}`, borderRadius: 11, background: t.surface2,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.muted }}>Med {i + 1}</div>
            {meds.length > 0 && <button onClick={() => del(i)} style={{
              appearance: 'none', border: 0, background: 'transparent', color: '#B42318',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Remove</button>}
          </div>
          <Field t={t} label="Name"><Input t={t} value={m.name} onChange={v => set(i, 'name', v)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <Field t={t} label="Dose"><Input t={t} value={m.dose} onChange={v => set(i, 'dose', v)} /></Field>
            <Field t={t} label="Route"><Segmented t={t} value={m.route} onChange={v => set(i, 'route', v)} options={['IV','IM','Oral','SC']} /></Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Field t={t} label="Remarks"><Input t={t} value={m.remarks || ''} onChange={v => set(i, 'remarks', v)} /></Field>
          </div>
        </div>
      ))}
      <Btn t={t} variant="soft" icon={<Ic.Plus size={14} stroke={2.5} />} onClick={add} style={{ alignSelf: 'flex-start' }}>Add medicine</Btn>
      <Field t={t} label="Overall remarks"><Textarea t={t} value={remarks} onChange={onRemarks} /></Field>
    </div>
  );
}

// ── Undo toast ───────────────────────────────────────────────────────────────
function UndoToast({ toast, onClose, t }) {
  useEAD(() => {
    if (!toast) return;
    const dur = toast.actionLabel ? 5500 : 2200;
    const id = setTimeout(() => onClose(), dur);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  const mobile = window.UI_MODE === 'mobile';
  return (
    <div style={mobile ? {
      position: 'fixed', left: 16, right: 16, bottom: 96,
      background: '#1A1F26', color: '#fff', borderRadius: 12,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 60,
      animation: 'slideUp 0.2s cubic-bezier(.2,.7,.3,1)',
      fontSize: 14, fontWeight: 500,
    } : {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24,
      background: '#1A1F26', color: '#fff', borderRadius: 12,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      minWidth: 280, maxWidth: 'min(520px, calc(100vw - 32px))', zIndex: 110,
      boxShadow: '0 8px 28px rgba(0,0,0,0.32)',
      animation: 'modalIn 0.18s cubic-bezier(.2,.7,.3,1)',
      fontSize: 14, fontWeight: 500,
    }}>
      <div style={{ flex: 1 }}>{toast.msg}</div>
      {toast.actionLabel && (
        <button onClick={() => { toast.action && toast.action(); onClose(); }} style={{
          appearance: 'none', border: 0, background: 'transparent', color: '#5BE49B',
          fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}>{toast.actionLabel}</button>
      )}
      <button onClick={onClose} style={{
        appearance: 'none', border: 0, background: 'transparent', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', padding: 0, display: 'flex',
      }}><Ic.Close size={16} /></button>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function iconBtn(t) {
  return {
    appearance: 'none', border: 0, background: t.surface2, cursor: 'pointer',
    width: 32, height: 32, borderRadius: 10, display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
}
function actionBtn(t, variant) {
  const base = {
    appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
    fontSize: 13.5, padding: '11px 12px', borderRadius: 11,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1,
  };
  if (variant === 'primary') return { ...base, background: t.accent, color: '#fff', border: `1px solid ${t.accent}` };
  if (variant === 'danger') return { ...base, background: 'transparent', color: '#B42318', border: `1px solid ${t.line}` };
  return { ...base, background: t.surface2, color: t.text, border: `1px solid ${t.line}` };
}

Object.assign(window, { ActivitySheet, UndoToast });
