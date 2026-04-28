'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

type ViewMode = 'dashboard' | 'projects' | 'report';

type SavedReport = {
  id: string;
  projectId: string;
  projectName: string;
  location: string;
  client: string;
  date: string;
  siteManager: string;
  weather: string;
  workStart: string;
  workEnd: string;
  speechText: string;
  section: string;
  floor: string;
  workType: string;
  description: string;
  employees: string;
  devices: string[];
  amountM3: string;
  amountT: string;
  material: string;
  issue: string;
  issueTime: string;
  photos: number;
  attachments: { name: string; type: string; size: number }[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = 'hagemann-bautagebuch-v03';

const projects = [
  { id: '25258', name: 'Berufliche Schule Rostock', location: 'Rostock', client: 'Oeffentlicher Auftraggeber' },
  { id: '25189', name: 'Kesselbornpark Rostock', location: 'Rostock', client: 'Projektentwicklung' },
  { id: '25377', name: 'Wacholderweg 1-2, Greifswald', location: 'Greifswald', client: 'Wohnungsbau' },
  { id: '25116', name: 'Schornsteinrueckbau', location: 'Mecklenburg-Vorpommern', client: 'Bestandsbau' },
];

const deviceOptions = [
  'Abbruchhammer',
  'Kernbohrgeraet',
  'Wandsaege',
  'Fugenschneider',
  'Minibagger',
  'Bagger',
  'Radlader',
  'Container',
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function detectStructuredData(text: string) {
  const normalized = (text || '').toLowerCase();
  const employeesMatch = normalized.match(/(\d+)\s*(mann|mitarbeiter|leute|personen)/);
  const m3Match = normalized.match(/(\d+[\.,]?\d*)\s*(kubikmeter|m3|m³)/);
  const tonMatch = normalized.match(/(\d+[\.,]?\d*)\s*(tonnen|tonne|t)/);
  const timeMatch = normalized.match(/ab\s*(\d{1,2}[:\.]\d{2})/);
  const photosMatch = normalized.match(/(\d+)\s*fotos?/);

  const devices = deviceOptions.filter((d) => normalized.includes(d.toLowerCase()));

  let workType = 'Sonstiges';
  if (/abbruch|rueckbau|rückbau|zurueckgebaut|zurückgebaut/.test(normalized)) workType = 'Abbruch';
  if (/kernbohr/.test(normalized)) workType = 'Kernbohrung';
  if (/wandsaege|wandsaege|wandsage/.test(normalized)) workType = 'Wandsaegearbeit';
  if (/erd|aushub/.test(normalized)) workType = 'Erdarbeit';

  const description = /mauer|wand|innenwand/.test(normalized)
    ? 'Rueckbau Mauerwerks- / Innenwaende'
    : /beton/.test(normalized)
      ? 'Bearbeitung / Rueckbau Betonbauteile'
      : /abbruch|rueckbau|rückbau/.test(normalized)
        ? 'Abbrucharbeiten'
        : 'Leistung aus Spracheingabe uebernehmen';

  const floor = normalized.includes('erdgeschoss') ? 'Erdgeschoss' : normalized.includes('obergeschoss') ? 'Obergeschoss' : normalized.includes('keller') ? 'Kellergeschoss' : '';
  const section = normalized.includes('treppenhaus ost') ? 'Treppenhaus Ost' : normalized.includes('treppenhaus west') ? 'Treppenhaus West' : normalized.includes('treppenhaus') ? 'Treppenhaus' : '';
  const issue = /freigabe|behinder|verzoeger|verzöger|wartezeit/.test(normalized)
    ? normalized.includes('freigabe') ? 'fehlende Freigabe' : 'Behinderung im Arbeitsablauf'
    : '';

  return {
    employees: employeesMatch ? employeesMatch[1] : '',
    amountM3: m3Match ? m3Match[1].replace(',', '.') : '',
    amountT: tonMatch ? tonMatch[1].replace(',', '.') : '',
    issueTime: timeMatch ? timeMatch[1].replace('.', ':') : '',
    photos: photosMatch ? Number(photosMatch[1]) : undefined,
    devices,
    floor,
    section,
    issue,
    workType,
    description,
    material: /abbruch|mauer|beton|bauschutt/.test(normalized) ? 'Bauschutt' : '',
  };
}

function buildReport(data: {
  date: string;
  section: string;
  floor: string;
  description: string;
  employees: string;
  devices: string[];
  amountM3: string;
  amountT: string;
  material: string;
  issue: string;
  issueTime: string;
  photos: number;
  weather: string;
  workStart: string;
  workEnd: string;
}) {
  const date = data.date || '[Datum]';
  const locationBits = [data.section, data.floor].filter(Boolean).join(', ');
  const devices = data.devices.length ? data.devices.join(', ') : 'keine Angabe';
  const amounts = [data.amountM3 ? `ca. ${data.amountM3} m3` : null, data.amountT ? `rund ${data.amountT} t` : null].filter(Boolean).join(' bzw. ');

  return {
    dailyReport: `Am ${date} wurden${locationBits ? ` im Bereich ${locationBits}` : ''} ${data.description || 'Arbeiten'} ausgefuehrt. Die Arbeiten erfolgten bei Witterung ${data.weather || 'ohne Angabe'} in der Zeit von ${data.workStart || '[Start]'} bis ${data.workEnd || '[Ende]'} Uhr. Im Einsatz waren ${data.employees || '[Anzahl]'} Mitarbeiter. Verwendet wurden ${devices}. ${amounts ? `Die angefallene Menge wurde mit ${amounts}${data.material ? ` ${data.material}` : ''} eingeschaetzt.` : 'Mengenangaben wurden nicht naeher konkretisiert.'} ${data.issue ? `${data.issueTime ? `Ab ${data.issueTime} Uhr ` : ''}kam es zu einer Behinderung aufgrund ${data.issue}.` : 'Besondere Behinderungen im Arbeitsablauf wurden nicht angegeben.'} Fotodokumentation: ${data.photos} Foto(s).`,
    proof: `${data.description || 'Leistung'}${locationBits ? ` in ${locationBits}` : ''}, ${data.employees || '[Anzahl]'} Mitarbeiter, ${devices}${amounts ? `, ${amounts}` : ''}.`,
    issueNote: data.issue ? `${data.issueTime ? `Ab ${data.issueTime} Uhr ` : ''}Behinderung wegen ${data.issue}.` : 'Keine Behinderung dokumentiert.',
  };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-header"><h2 className="card-title">{title}</h2></div>
      <div className="card-content">{children}</div>
    </section>
  );
}

export default function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [projectSearch, setProjectSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [projectId, setProjectId] = useState('25258');
  const [date, setDate] = useState(today);
  const [siteManager, setSiteManager] = useState('Olaf Hagemann');
  const [weather, setWeather] = useState('trocken');
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('16:00');
  const [speechText, setSpeechText] = useState('Heute im Treppenhaus Ost im Erdgeschoss Mauerwerkswaende rueckgebaut. Zwei Mitarbeiter im Einsatz, Abbruchhammer und Kernbohrgeraet. Ca. 5 Kubikmeter Bauschutt, rund 9 Tonnen. Ab 11:00 Verzoegerung wegen fehlender Freigabe im Nebenraum. Drei Fotos gemacht.');
  const [section, setSection] = useState('Treppenhaus Ost');
  const [floor, setFloor] = useState('Erdgeschoss');
  const [workType, setWorkType] = useState('Abbruch');
  const [description, setDescription] = useState('Rueckbau Mauerwerkswaende');
  const [employees, setEmployees] = useState('2');
  const [devices, setDevices] = useState<string[]>(['Abbruchhammer', 'Kernbohrgeraet']);
  const [amountM3, setAmountM3] = useState('5.0');
  const [amountT, setAmountT] = useState('9.0');
  const [material, setMaterial] = useState('Bauschutt');
  const [issue, setIssue] = useState('fehlende Freigabe');
  const [issueTime, setIssueTime] = useState('11:00');
  const [photos, setPhotos] = useState(3);
  const [status, setStatus] = useState('Entwurf');
  const [attachments, setAttachments] = useState<{ name: string; type: string; size: number }[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const project = useMemo(() => projects.find((p) => p.id === projectId) || projects[0], [projectId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedReports(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReports));
    } catch {}
  }, [savedReports]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter((p) => `${p.id} ${p.name} ${p.location} ${p.client}`.toLowerCase().includes(q));
  }, [projectSearch]);

  const filteredReports = useMemo(() => {
    const q = reportSearch.toLowerCase().trim();
    if (!q) return savedReports;
    return savedReports.filter((r) => `${r.projectId} ${r.projectName} ${r.date} ${r.status} ${r.description}`.toLowerCase().includes(q));
  }, [reportSearch, savedReports]);

  const stats = useMemo(() => ({
    totalProjects: projects.length,
    totalReports: savedReports.length,
    drafts: savedReports.filter((r) => r.status === 'Entwurf').length,
    reviewed: savedReports.filter((r) => r.status === 'geprueft').length,
    approved: savedReports.filter((r) => r.status === 'freigegeben').length,
  }), [savedReports]);

  const report = useMemo(() => buildReport({ date, section, floor, description, employees, devices, amountM3, amountT, material, issue, issueTime, photos, weather, workStart, workEnd }), [date, section, floor, description, employees, devices, amountM3, amountT, material, issue, issueTime, photos, weather, workStart, workEnd]);

  const applySpeech = () => {
    const parsed = detectStructuredData(speechText);
    if (parsed.workType) setWorkType(parsed.workType);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.employees) setEmployees(parsed.employees);
    if (parsed.amountM3) setAmountM3(parsed.amountM3);
    if (parsed.amountT) setAmountT(parsed.amountT);
    if (parsed.issue) setIssue(parsed.issue);
    if (parsed.issueTime) setIssueTime(parsed.issueTime);
    if (parsed.floor) setFloor(parsed.floor);
    if (parsed.section) setSection(parsed.section);
    if (parsed.material) setMaterial(parsed.material);
    if (parsed.devices.length) setDevices(parsed.devices);
    if (typeof parsed.photos === 'number') setPhotos(parsed.photos);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Spracherkennung wird in diesem Browser nicht unterstuetzt. Bitte Chrome oder Edge verwenden.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i += 1) finalTranscript += event.results[i][0].transcript + ' ';
      setSpeechText(finalTranscript.trim());
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
  };

  const toggleDevice = (device: string) => {
    setDevices((prev) => prev.includes(device) ? prev.filter((d) => d !== device) : [...prev, device]);
  };

  const resetForm = () => {
    setCurrentId(null);
    setProjectId('25258');
    setDate(today);
    setSiteManager('Olaf Hagemann');
    setWeather('trocken');
    setWorkStart('07:00');
    setWorkEnd('16:00');
    setSpeechText('');
    setSection('');
    setFloor('');
    setWorkType('Sonstiges');
    setDescription('');
    setEmployees('');
    setDevices([]);
    setAmountM3('');
    setAmountT('');
    setMaterial('');
    setIssue('');
    setIssueTime('');
    setPhotos(0);
    setAttachments([]);
    setStatus('Entwurf');
  };

  const buildSavedReport = (): SavedReport => ({
    id: currentId || uid(),
    projectId,
    projectName: project.name,
    location: project.location,
    client: project.client,
    date,
    siteManager,
    weather,
    workStart,
    workEnd,
    speechText,
    section,
    floor,
    workType,
    description,
    employees,
    devices,
    amountM3,
    amountT,
    material,
    issue,
    issueTime,
    photos,
    attachments,
    status,
    createdAt: currentId ? savedReports.find((r) => r.id === currentId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const saveReport = () => {
    const next = buildSavedReport();
    setCurrentId(next.id);
    setSavedReports((prev) => prev.some((r) => r.id === next.id) ? prev.map((r) => (r.id === next.id ? next : r)) : [next, ...prev]);
  };

  const loadReport = (item: SavedReport) => {
    setCurrentId(item.id);
    setProjectId(item.projectId);
    setDate(item.date);
    setSiteManager(item.siteManager);
    setWeather(item.weather);
    setWorkStart(item.workStart);
    setWorkEnd(item.workEnd);
    setSpeechText(item.speechText);
    setSection(item.section);
    setFloor(item.floor);
    setWorkType(item.workType);
    setDescription(item.description);
    setEmployees(item.employees);
    setDevices(item.devices);
    setAmountM3(item.amountM3);
    setAmountT(item.amountT);
    setMaterial(item.material);
    setIssue(item.issue);
    setIssueTime(item.issueTime);
    setPhotos(item.photos);
    setAttachments(item.attachments || []);
    setStatus(item.status);
    setViewMode('report');
  };

  const deleteReport = (id: string) => {
    setSavedReports((prev) => prev.filter((r) => r.id !== id));
    if (currentId === id) resetForm();
  };

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).map((file) => ({ name: file.name, type: file.type || 'Datei', size: file.size }));
    setAttachments((prev) => [...prev, ...files]);
  };

  return (
    <main className="page">
      <div className="topbar no-print">
        <div>
          <h1 className="title">Hagemann KI-Bautagebuch v0.3</h1>
          <div className="subtitle">ZIP-Testversion fuer Vercel, mobil geeignet, mit Projekten, Berichten und lokaler Speicherung.</div>
        </div>
        <div className="tabs">
          <button className={`btn ${viewMode === 'dashboard' ? '' : 'secondary'}`} onClick={() => setViewMode('dashboard')}>Dashboard</button>
          <button className={`btn ${viewMode === 'projects' ? '' : 'secondary'}`} onClick={() => setViewMode('projects')}>Projekte</button>
          <button className={`btn ${viewMode === 'report' ? '' : 'secondary'}`} onClick={() => setViewMode('report')}>Bericht</button>
        </div>
      </div>

      {viewMode === 'dashboard' && (
        <div className="grid" style={{ gap: 20 }}>
          <div className="grid stats no-print">
            <Card title="Projekte"><div className="kpi">{stats.totalProjects}</div></Card>
            <Card title="Berichte gesamt"><div className="kpi">{stats.totalReports}</div></Card>
            <Card title="Entwuerfe"><div className="kpi">{stats.drafts}</div></Card>
            <Card title="Geprueft"><div className="kpi">{stats.reviewed}</div></Card>
            <Card title="Freigegeben"><div className="kpi">{stats.approved}</div></Card>
          </div>
          <div className="grid main">
            <Card title="Schnellzugriff Projekte">
              <div className="list">
                {projects.map((p) => (
                  <div className="item" key={p.id}>
                    <div className="item-title">{p.id} - {p.name}</div>
                    <div className="muted small">{p.location}</div>
                    <div className="muted tiny">{p.client}</div>
                    <div className="actions" style={{ marginTop: 10 }}>
                      <button className="btn secondary" onClick={() => { setProjectId(p.id); setViewMode('report'); }}>Bericht anlegen</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Letzte Berichte">
              <label className="label">Berichte durchsuchen</label>
              <input value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} placeholder="Projekt, Datum, Status oder Inhalt" />
              <hr className="sep" />
              <div className="list">
                {filteredReports.length === 0 ? <div className="muted">Noch keine Berichte gespeichert.</div> : filteredReports.slice(0, 8).map((item) => (
                  <div className="item" key={item.id}>
                    <div className="item-title">{item.projectId} - {item.projectName}</div>
                    <div className="muted small">{item.date} - {item.status}</div>
                    <div className="muted small">{item.description || 'Ohne Beschreibung'}</div>
                    <div className="actions" style={{ marginTop: 10 }}>
                      <button className="btn secondary" onClick={() => loadReport(item)}>Oeffnen</button>
                      <button className="btn ghost" onClick={() => deleteReport(item.id)}>Loeschen</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {viewMode === 'projects' && (
        <Card title="Projektuebersicht">
          <label className="label">Projekte durchsuchen</label>
          <input value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder="Projektnummer, Name oder Ort" />
          <hr className="sep" />
          <div className="grid three">
            {filteredProjects.map((p) => {
              const reportsForProject = savedReports.filter((r) => r.projectId === p.id);
              return (
                <div className="item" key={p.id}>
                  <div className="item-title">{p.id} - {p.name}</div>
                  <div className="muted small">{p.location}</div>
                  <div className="muted tiny">{p.client}</div>
                  <div className="row" style={{ marginTop: 12 }}>
                    <div className="muted small">Berichte: {reportsForProject.length}</div>
                    <div className="muted small">Freigegeben: {reportsForProject.filter((r) => r.status === 'freigegeben').length}</div>
                  </div>
                  <div className="actions" style={{ marginTop: 10 }}>
                    <button className="btn secondary" onClick={() => { setProjectId(p.id); setViewMode('report'); }}>Neuer Bericht</button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {viewMode === 'report' && (
        <div className="grid main">
          <div className="grid" style={{ gap: 16 }}>
            <Card title="Projekt und Kopfdaten">
              <div className="grid two">
                <div>
                  <label className="label">Projekt</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.id} - {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Baustelle / Ort</label>
                  <input value={project.location} readOnly />
                </div>
                <div>
                  <label className="label">Datum</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Bauleiter</label>
                  <input value={siteManager} onChange={(e) => setSiteManager(e.target.value)} />
                </div>
                <div>
                  <label className="label">Wetter</label>
                  <select value={weather} onChange={(e) => setWeather(e.target.value)}>
                    {['trocken', 'Regen', 'wechselhaft', 'Wind', 'Frost'].map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className="row">
                  <div>
                    <label className="label">Arbeitsbeginn</label>
                    <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Arbeitsende</label>
                    <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Spracheingabe oder Tippen">
              <div className="help">Diktieren oder direkt eintippen. Danach auf Auswerten klicken und die Felder darunter kontrollieren.</div>
              <div className="actions" style={{ marginTop: 14, marginBottom: 14 }}>
                {!isListening ? <button className="btn" onClick={startListening}>Mikrofon starten</button> : <button className="btn" onClick={stopListening}>Mikrofon stoppen</button>}
                <button className="btn secondary" onClick={applySpeech}>Auswerten</button>
              </div>
              <label className="label">Rohtranskript / Freitext</label>
              <textarea value={speechText} onChange={(e) => setSpeechText(e.target.value)} />
            </Card>

            <div className="grid two">
              <Card title="Leistungsdaten">
                <div className="grid" style={{ gap: 12 }}>
                  <div className="row">
                    <div><label className="label">Bereich</label><input value={section} onChange={(e) => setSection(e.target.value)} /></div>
                    <div><label className="label">Geschoss</label><input value={floor} onChange={(e) => setFloor(e.target.value)} /></div>
                  </div>
                  <div><label className="label">Leistungsart</label><select value={workType} onChange={(e) => setWorkType(e.target.value)}>{['Abbruch','Kernbohrung','Wandsaegearbeit','Erdarbeit','Entsorgung','Sonstiges'].map((w) => <option key={w} value={w}>{w}</option>)}</select></div>
                  <div><label className="label">Beschreibung</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                  <div><label className="label">Mitarbeiter</label><input value={employees} onChange={(e) => setEmployees(e.target.value)} /></div>
                </div>
              </Card>

              <Card title="Geraete und Mengen">
                <div className="grid" style={{ gap: 12 }}>
                  <div>
                    <label className="label">Geraete</label>
                    <div className="device-list">
                      {deviceOptions.map((device) => (
                        <label className="checkbox-row" key={device}>
                          <input type="checkbox" checked={devices.includes(device)} onChange={() => toggleDevice(device)} style={{ width: 18, height: 18 }} />
                          <span>{device}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="row">
                    <div><label className="label">Menge m3</label><input value={amountM3} onChange={(e) => setAmountM3(e.target.value)} /></div>
                    <div><label className="label">Menge t</label><input value={amountT} onChange={(e) => setAmountT(e.target.value)} /></div>
                  </div>
                  <div><label className="label">Materialart</label><input value={material} onChange={(e) => setMaterial(e.target.value)} /></div>
                </div>
              </Card>
            </div>

            <div className="grid two">
              <Card title="Behinderungen">
                <div className="grid" style={{ gap: 12 }}>
                  <div><label className="label">Ursache / Behinderung</label><input value={issue} onChange={(e) => setIssue(e.target.value)} /></div>
                  <div><label className="label">Uhrzeit ab</label><input type="time" value={issueTime} onChange={(e) => setIssueTime(e.target.value)} /></div>
                  <div><label className="label">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)}>{['Entwurf','geprueft','freigegeben'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
              </Card>

              <Card title="Nachweise / Uploads">
                <div className="grid" style={{ gap: 12 }}>
                  <div><label className="label">Anzahl Fotos</label><input type="number" min="0" value={photos} onChange={(e) => setPhotos(Number(e.target.value))} /></div>
                  <div><label className="label">Dateien</label><input type="file" multiple onChange={onFilesSelected} /></div>
                  <div className="item">
                    {attachments.length === 0 ? <span className="muted">Noch keine Dateien ausgewaehlt.</span> : attachments.map((file, index) => <div key={`${file.name}-${index}`} className="small">{file.name} ({Math.round(file.size / 1024)} KB)</div>)}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="grid" style={{ gap: 16 }}>
            <Card title="Berichtsvorschau">
              <div className="preview-box">
                <div className="item-title">Hagemann GmbH</div>
                <div className="muted small">Projekt {project.id} - {project.name}</div>
                <div className="muted small">Ort: {project.location}</div>
                <div className="muted small">Datum: {date}</div>
                <div className="muted small">Bauleiter: {siteManager}</div>
                <div className="muted small">Wetter: {weather}</div>
                <div className="muted small">Arbeitszeit: {workStart} - {workEnd}</div>
              </div>
              <hr className="sep" />
              <div><div className="item-title">Tagesbericht</div><p>{report.dailyReport}</p></div>
              <div><div className="item-title">Leistungsnachweis</div><p>{report.proof}</p></div>
              <div><div className="item-title">Behinderungsnotiz</div><p>{report.issueNote}</p></div>
              <div className="summary-grid">
                <div className="summary-cell"><div className="tiny muted">Mitarbeiter</div><div>{employees || '-'}</div></div>
                <div className="summary-cell"><div className="tiny muted">Fotos</div><div>{photos}</div></div>
                <div className="summary-cell"><div className="tiny muted">Menge m3</div><div>{amountM3 || '-'}</div></div>
                <div className="summary-cell"><div className="tiny muted">Menge t</div><div>{amountT || '-'}</div></div>
              </div>
              <div className="actions no-print" style={{ marginTop: 16 }}>
                <span className="badge">Status: {status}</span>
                <button className="btn secondary" onClick={saveReport}>Speichern</button>
                <button className="btn secondary" onClick={() => window.print()}>PDF / Drucken</button>
                <button className="btn ghost" onClick={resetForm}>Neu</button>
              </div>
            </Card>

            <Card title="Gespeicherte Berichte">
              <div className="list">
                {savedReports.length === 0 ? <div className="muted">Noch keine Berichte gespeichert.</div> : savedReports.map((item) => (
                  <div className="item" key={item.id}>
                    <div className="item-title">{item.projectId} - {item.projectName}</div>
                    <div className="muted small">{item.date} - {item.status}</div>
                    <div className="muted small">{item.description || 'Ohne Beschreibung'}</div>
                    <div className="actions" style={{ marginTop: 10 }}>
                      <button className="btn secondary" onClick={() => loadReport(item)}>Oeffnen</button>
                      <button className="btn ghost" onClick={() => deleteReport(item.id)}>Loeschen</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
