const { useEffect, useMemo, useRef, useState } = React;

/* store and defaults */
const LS_KEY = "outreach_tracker_store_v3";

function makeId(){ return Math.random().toString(36).slice(2)+Date.now().toString(36).slice(2); }
function digitsOnly(s){ return String(s||"").replace(/\D/g,"").slice(0,10); }
function formatPhone(s){
  const d = digitsOnly(s);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3,6)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}
function formatDate(iso){ try { return new Date(iso).toLocaleString(); } catch { return iso; } }

/* time rules */
function computeDueAt(step, enrolledAt, isFirst){
  const startH = 6, endH = 16;
  let dt = new Date(enrolledAt);

  if (step.waitDays) dt.setDate(dt.getDate() + Number(step.waitDays||0));
  if (step.waitHours) dt.setHours(dt.getHours() + Number(step.waitHours||0));

  if (isFirst && !step.waitDays && !step.waitHours) {
    const now = new Date(enrolledAt);
    if (now.getHours() >= endH) {
      dt = new Date(now); dt.setDate(now.getDate()+1); dt.setHours(startH,0,0,0);
    } else {
      dt = new Date(now); dt.setHours(startH,0,0,0);
    }
  } else {
    if (dt.getHours() >= endH) { dt.setDate(dt.getDate()+1); dt.setHours(startH,0,0,0); }
    if (dt.getHours() < startH) { dt.setHours(startH,0,0,0); }
  }
  return dt.toISOString();
}

/* default sequences */
function defaultSequencesAndSteps(){
  const genId = makeId();
  const fishId = makeId();
  const nurId = makeId();

  const make = (sequenceId, order, actionType, waitDays=0, waitHours=0) =>
    ({ id: makeId(), sequenceId, order, actionType, waitDays, waitHours, name: "" });

  const general = [
    make(genId, 1, "email", 0, 0),
    make(genId, 2, "call", 0, 2),
    make(genId, 3, "email", 2, 0),
    make(genId, 4, "call", 4, 0),
    make(genId, 5, "email", 6, 0),
    make(genId, 6, "call", 8, 0),
    make(genId, 7, "email", 11, 0),
  ];
  const gofish = general.map(s => ({ ...s, id: makeId(), sequenceId: fishId }));

  const nurture = [
    make(nurId, 1, "email", 0, 0),
    make(nurId, 2, "email", 7, 0),
    make(nurId, 3, "call", 14, 0),
    make(nurId, 4, "email", 21, 0),
    make(nurId, 5, "call", 28, 0),
    make(nurId, 6, "email", 35, 0),
    make(nurId, 7, "call", 45, 0),
  ];

  const sequences = [
    { id: genId,  name: "General Prospecting", description: "12 day light touch sequence" },
    { id: fishId, name: "GoFish Sequence",     description: "Variant of General Prospecting" },
    { id: nurId,  name: "Nurture",             description: "45 day slow follow up" },
  ];
  let steps = [...general, ...gofish, ...nurture];

  const byId = Object.fromEntries(sequences.map(s => [s.id, s]));
  steps = steps
    .sort((a,b)=> a.sequenceId===b.sequenceId ? a.order-b.order : String(a.sequenceId).localeCompare(String(b.sequenceId)))
    .map(st => ({ ...st, name: `${byId[st.sequenceId]?.name || "Sequence"} - Day ${st.waitDays || 0}${st.waitHours?` + ${st.waitHours}h`:``} - ${st.actionType}` }));

  return { sequences, steps };
}

const initialStore = (() => {
  const base = defaultSequencesAndSteps();
  return {
    companies: [],
    contacts: [
      { id: makeId(), firstName: "Mikaela", lastName: "B.", email: "mikaela@example.com", phoneOffice:"3035550100", phoneMobile:"3035550101", company:"Urban Interiors", status:"active", contactNotes:"", sequenceId: base.sequences[0].id },
      { id: makeId(), firstName: "Lexi", lastName: "R.", email: "lexi@example.com",    phoneOffice:"7205550190", phoneMobile:"7205550199", company:"PB Teen",         status:"active", contactNotes:"", sequenceId: base.sequences[1].id },
    ],
    sequences: base.sequences,
    steps: base.steps,
    tasks: [],
  };
})();

/* app shell */
function App(){ return <TabsApp />; }

function TabsApp(){
  const [store, setStore] = useState(() => {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : initialStore; }
    catch { return initialStore; }
  });
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(store)); }, [store]);

  const [tab, setTab] = useState("today");

  return (
    <>
      <div className="tabs" style={{marginBottom:"1rem"}}>
        {[
          {id:"today",label:"Today"},
          {id:"contacts",label:"Contacts"},
          {id:"sequences",label:"Sequences"},
          {id:"backup",label:"Backup"},
        ].map(t =>
          <button key={t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}>{t.label}</button>
        )}
      </div>

      {tab==="today"    && <TodayView store={store} setStore={setStore} />}
      {tab==="contacts" && <ContactsView store={store} setStore={setStore} />}
      {tab==="sequences"&& <SequencesView store={store} setStore={setStore} />}
      {tab==="backup"   && <BackupView store={store} setStore={setStore} />}
    </>
  );
}

/* views */
function TodayView({ store, setStore }){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59);

  const overdue = store.tasks.filter(t => !t.outcome && new Date(t.dueAt) < start)
    .sort((a,b)=> new Date(a.dueAt) - new Date(b.dueAt));
  const dueToday = store.tasks.filter(t => !t.outcome && new Date(t.dueAt) >= start && new Date(t.dueAt) <= end)
    .sort((a,b)=> new Date(a.dueAt) - new Date(b.dueAt));
  const done = store.tasks.filter(t => t.outcome==="done" && new Date(t.dueAt) <= end)
    .sort((a,b)=> new Date(b.dueAt) - new Date(a.dueAt));

  return (
    <div className="space-y-6">
      <Card title="Past Due"><TaskTable tasks={overdue} store={store} setStore={setStore} /></Card>
      <Card title="Today"><TaskTable tasks={dueToday} store={store} setStore={setStore} /></Card>
      <Card title="Completed"><TaskTable tasks={done} store={store} setStore={setStore} readonlyDone /></Card>
    </div>
  );
}

function ContactsView({ store, setStore }){
  const companiesByName = useMemo(() => Object.fromEntries(store.companies.map(c => [c.name, c])), [store.companies]);

  function addContact(){
    setStore(prev => ({
      ...prev,
      contacts: [...prev.contacts, { id: makeId(), firstName:"First", lastName:"Last", email:"", phoneOffice:"", phoneMobile:"", company:"", status:"active", contactNotes:"", sequenceId:"" }]
    }));
  }
  function changeCompany(contactId, name){
    setStore(prev => {
      const next = { ...prev };
      next.contacts = prev.contacts.map(c => c.id===contactId ? { ...c, company:name } : c);
      if (name && !next.companies.find(co => co.name===name)) {
        next.companies = [...prev.companies, { id: makeId(), name, notes: "" }];
      }
      return next;
    });
  }
  function updateContact(id, patch){
    setStore(prev => ({ ...prev, contacts: prev.contacts.map(c => c.id===id ? { ...c, ...patch } : c) }));
  }
  function removeContact(id){
    setStore(prev => ({
      ...prev,
      contacts: prev.contacts.filter(c => c.id!==id),
      tasks: prev.tasks.filter(t => t.contactId !== id),
    }));
  }
  function enrollContact(contactId){
    setStore(prev => {
      const contact = prev.contacts.find(c => c.id===contactId);
      if (!contact) return prev;
      if (!contact.sequenceId) { alert("Select a sequence first"); return prev; }

      const steps = prev.steps
        .filter(s => s.sequenceId === contact.sequenceId)
        .sort((a,b)=> a.order - b.order);

      if (!steps.length) { alert("Selected sequence has no steps"); return prev; }

      const enrolledAt = new Date();
      const tasks = steps.map((s, idx) => ({
        id: makeId(),
        contactId: contact.id,
        sequenceId: s.sequenceId,
        stepId: s.id,
        actionType: s.actionType,
        name: stepDisplayName(prev, s),
        dueAt: computeDueAt(s, enrolledAt, idx===0),
        outcome: "",
        notes: "",
      }));

      return { ...prev, tasks: [...prev.tasks, ...tasks] };
    });
  }

  return (
    <Card title="Contacts">
      <div className="bd">
        <div className="stack" style={{marginBottom:".75rem"}}>
          <button className="btn" onClick={addContact}>Add</button>
        </div>
        <div style={{overflowX:"auto"}}>
          <table className="sheet">
            <thead>
              <tr>
                <th>First</th><th>Last</th><th>Email</th>
                <th>Office</th><th>Mobile</th>
                <th>Company</th>
                <th>Status</th>
                <th>Sequence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {store.contacts.map(c => (
                <tr key={c.id}>
                  <td><Input value={c.firstName} onChange={v=>updateContact(c.id,{firstName:v})} /></td>
                  <td><Input value={c.lastName}  onChange={v=>updateContact(c.id,{lastName:v})} /></td>
                  <td><Input value={c.email}     onChange={v=>updateContact(c.id,{email:v})} /></td>
                  <td><Phone value={c.phoneOffice} onChange={v=>updateContact(c.id,{phoneOffice:v})} /></td>
                  <td><Phone value={c.phoneMobile} onChange={v=>updateContact(c.id,{phoneMobile:v})} /></td>
                  <td><Input value={c.company} onChange={v=>changeCompany(c.id, v)} /></td>
                  <td>
                    <select className="input" value={c.status} onChange={e=>updateContact(c.id,{status:e.target.value})}>
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                      <option value="completed">completed</option>
                    </select>
                  </td>
                  <td>
                    <select className="input" value={c.sequenceId||""} onChange={e=>updateContact(c.id,{sequenceId:e.target.value})}>
                      <option value="">Not enrolled</option>
                      {store.sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td style={{display:"flex",gap:".5rem"}}>
                    <button className="btn" onClick={()=>enrollContact(c.id)}>Enroll</button>
                    <button className="btn danger" onClick={()=>removeContact(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function SequencesView({ store, setStore }){
  const [selectedId, setSelectedId] = useState(store.sequences[0]?.id || "");

  function addSequence(){
    const id = makeId();
    setStore(prev => ({ ...prev, sequences: [...prev.sequences, { id, name:"New Sequence", description:"" }] }));
    setSelectedId(id);
  }
  function updateSequence(id, patch){
    setStore(prev => ({ ...prev, sequences: prev.sequences.map(s => s.id===id ? { ...s, ...patch } : s) }));
  }
  function deleteSequence(id){
    setStore(prev => ({
      ...prev,
      sequences: prev.sequences.filter(s=>s.id!==id),
      steps: prev.steps.filter(st=>st.sequenceId!==id),
      tasks: prev.tasks.filter(t=>t.sequenceId!==id),
    }));
    if (selectedId===id) setSelectedId(store.sequences.find(s=>s.id!==id)?.id || "");
  }
  function addStep(){
    if (!selectedId) return alert("Select a sequence");
    setStore(prev => {
      const maxOrder = Math.max(0, ...prev.steps.filter(st=>st.sequenceId===selectedId).map(st=>st.order));
      return { ...prev, steps: [...prev.steps, { id: makeId(), sequenceId: selectedId, order: maxOrder+1, actionType:"email", waitDays:0, waitHours:0, name:"" }] };
    });
  }
  function updateStep(id, patch){
    setStore(prev => {
      let steps = prev.steps.map(st => st.id===id ? { ...st, ...patch } : st);
      const st = steps.find(s => s.id===id);
      const seq = prev.sequences.find(s => s.id===st.sequenceId);
      steps = steps.map(s => s.id===id ? { ...s, name: `${seq?.name || "Sequence"} - Day ${s.waitDays || 0}${s.waitHours?` + ${s.waitHours}h`:``} - ${s.actionType}` } : s);
      return { ...prev, steps };
    });
  }
  function removeStep(id){ setStore(prev => ({ ...prev, steps: prev.steps.filter(st=>st.id!==id) })); }

  const steps = store.steps.filter(st => st.sequenceId===selectedId).sort((a,b)=> a.order - b.order);

  return (
    <div className="two">
      <Card title="Sequences">
        <div className="bd">
          <div className="stack" style={{marginBottom:".75rem"}}>
            <button className="btn" onClick={addSequence}>Add sequence</button>
          </div>
          <div style={{display:"grid", gap:".5rem"}}>
            {store.sequences.map(s => (
              <div key={s.id} className="card" style={{borderColor:selectedId===s.id?"#111827":undefined}}>
                <div className="hd">
                  <div style={{fontWeight:600}}>{s.name}</div>
                  <div className="stack">
                    <button className="btn subtle" onClick={()=>setSelectedId(s.id)}>Open</button>
                    <button className="btn danger" onClick={()=>deleteSequence(s.id)}>Delete</button>
                  </div>
                </div>
                <div className="bd">
                  <Input value={s.description} onChange={v=>updateSequence(s.id,{description:v})} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title={store.sequences.find(s=>s.id===selectedId)?.name || "Steps"}>
        <div className="bd">
          <div className="stack" style={{marginBottom:".75rem"}}>
            <button className="btn" onClick={addStep}>Add step</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="sheet">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Action</th>
                  <th>Wait days</th>
                  <th>Wait hours</th>
                  <th>Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
              {steps.map(st => (
                <tr key={st.id}>
                  <td><Input value={String(st.order)} onChange={v=>updateStep(st.id,{order: Number(v)||st.order})} /></td>
                  <td>
                    <select className="input" value={st.actionType} onChange={e=>updateStep(st.id,{actionType:e.target.value})}>
                      <option value="email">email</option>
                      <option value="call">call</option>
                    </select>
                  </td>
                  <td><Input value={String(st.waitDays||0)} onChange={v=>updateStep(st.id,{waitDays: Number(v)||0})} /></td>
                  <td><Input value={String(st.waitHours||0)} onChange={v=>updateStep(st.id,{waitHours: Number(v)||0})} /></td>
                  <td><Input value={st.name} onChange={v=>updateStep(st.id,{name:v})} /></td>
                  <td><button className="btn danger" onClick={()=>removeStep(st.id)}>Delete</button></td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BackupView({ store, setStore }){
  function exportAll(){
    const blob = new Blob([JSON.stringify(store,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`outreach-backup-${Date.now()}.json`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }
  function importAll(file){
    const r = new FileReader();
    r.onload = () => {
      try {
        const next = JSON.parse(String(r.result));
        localStorage.setItem(LS_KEY, JSON.stringify(next));
        window.location.reload();
      } catch { alert("Invalid file"); }
    };
    r.readAsText(file);
  }
  const fileRef = useRef(null);

  return (
    <Card title="Import or export">
      <div className="bd">
        <div className="stack">
          <button className="btn" onClick={exportAll}>Export backup</button>
          <input ref={fileRef} type="file" className="hidden" accept="application/json" onChange={e=>e.target.files && importAll(e.target.files[0])} />
          <button className="btn subtle" onClick={()=>fileRef.current?.click()}>Import backup</button>
          <button className="btn danger" onClick={()=>{ if(confirm("Clear all data?")) { localStorage.removeItem(LS_KEY); window.location.reload(); } }}>Clear all data</button>
        </div>
        <p style={{color:"#6b7280", fontSize:".9rem", marginTop:".5rem"}}>Backups include sequences, steps, contacts, companies, and tasks.</p>
      </div>
    </Card>
  );
}

/* components */
function Card({ title, children }){
  return (
    <div className="card">
      <div className="hd"><h2 style={{fontSize:"1.05rem", fontWeight:700}}>{title}</h2></div>
      {children}
    </div>
  );
}
function Input({ value, onChange }){ return <input className="input" value={value} onChange={e=>onChange(e.target.value)} />; }
function Phone({ value, onChange }){
  const [raw,setRaw] = useState(digitsOnly(value));
  useEffect(()=>{ setRaw(digitsOnly(value)); },[value]);
  return <input className="input" value={formatPhone(raw)} onChange={e=>{ const d=digitsOnly(e.target.value); setRaw(d); onChange(d); }} placeholder="(555) 555-1234" />;
}
function AutoTA({ value, onChange, minRows=2, maxRows=14 }){
  const ref = useRef(null);
  useEffect(()=>{
    const el = ref.current; if(!el) return;
    el.style.height = "auto";
    const h = Math.min(maxRows, Math.max(minRows, Math.ceil(el.scrollHeight/22)));
    el.style.height = (h*22)+"px";
  },[value,minRows,maxRows]);
  return <textarea ref={ref} className="ta" rows={minRows} value={value} onChange={e=>onChange(e.target.value)} />;
}

function TaskTable({ tasks, store, setStore, readonlyDone }){
  const contactsById = useMemo(()=>Object.fromEntries(store.contacts.map(c=>[c.id,c])),[store.contacts]);
  const companiesByName = useMemo(()=>Object.fromEntries(store.companies.map(c=>[c.name,c])),[store.companies]);

  function setCompanyNotes(name, notes){
    if(!name) return;
    setStore(prev => {
      const idx = prev.companies.findIndex(c => c.name===name);
      if (idx === -1) return { ...prev, companies: [...prev.companies, { id: makeId(), name, notes }] };
      return { ...prev, companies: prev.companies.map((c,i)=> i===idx ? { ...c, notes } : c) };
    });
  }
  function updateTask(id, patch){ setStore(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id===id ? { ...t, ...patch } : t) })); }
  function completeTask(id){ setStore(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id===id ? { ...t, outcome:"done" } : t) })); }
  function cancelTask(id){ setStore(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id!==id) })); }

  if (!tasks.length) return <div style={{color:"#6b7280", fontSize:".95rem"}}>Nothing here</div>;

  return (
    <div style={{overflowX:"auto"}}>
      <table className="sheet">
        <thead>
          <tr>
            <th>Due at</th>
            <th>Action</th>
            <th>Contact</th>
            <th>Company</th>
            <th style={{width:"28%"}}>Company notes</th>
            <th style={{width:"28%"}}>Contact notes</th>
            <th style={{width:"18%"}}>Task notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
        {tasks.map(t => {
          const contact = contactsById[t.contactId];
          const compNotes = contact?.company ? companiesByName[contact.company]?.notes || "" : "";
          return (
            <tr key={t.id}>
              <td>{formatDate(t.dueAt)}</td>
              <td className="capitalize">{t.actionType}{t.name ? ` • ${t.name}` : ""}</td>
              <td>{contact ? `${contact.firstName} ${contact.lastName}` : "Unknown"}</td>
              <td>{contact?.company || ""}</td>
              <td><AutoTA value={compNotes} onChange={v => setCompanyNotes(contact?.company || "", v)} /></td>
              <td><AutoTA value={contact?.contactNotes || ""} onChange={v => contact && setStore(prev => ({ ...prev, contacts: prev.contacts.map(c => c.id===contact.id ? { ...c, contactNotes: v } : c) }))} /></td>
              <td><AutoTA value={t.notes || ""} onChange={v => updateTask(t.id, { notes: v })} /></td>
              <td style={{display:"flex", gap:".5rem"}}>
                {!readonlyDone && <button className="btn success" onClick={()=>completeTask(t.id)}>Complete</button>}
                {!readonlyDone && <button className="btn subtle" onClick={()=>updateTask(t.id,{ dueAt: addHoursISO(t.dueAt,24) })}>Snooze 1 day</button>}
                <button className="btn danger" onClick={()=>cancelTask(t.id)}>Delete</button>
              </td>
            </tr>
          );
        })}
        </tbody>
      </table>
    </div>
  );
}

/* helpers */
function addHoursISO(iso, hours){ const d=new Date(iso); d.setHours(d.getHours()+hours); return d.toISOString(); }
function stepDisplayName(store, step){
  const seq = store.sequences.find(s => s.id===step.sequenceId);
  const day = step.waitDays || 0;
  const hrs = step.waitHours ? ` + ${step.waitHours}h` : "";
  return `${seq?.name || "Sequence"} - Day ${day}${hrs} - ${step.actionType}`;
}

/* mount */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
