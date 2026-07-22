'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { t, LOCALES, type Locale } from '@/lib/i18n';




interface AdminContract {
  id: string; contractNumber: string; customerName: string; customerEmail: string | null; customerPhone: string | null;
  vehiclePlate: string; vehicleModel: string; vehicleColor: string | null; status: string; createdAt: string;
  tokens: Array<{ id: string; token: string; expiresAt: string; usedAt: string | null; isExpired: boolean }>;
  photosSubmitted: number; photos: Array<{ key: string; label: string; fileName: string; uploadedAt: string; capturedAt?: string; latitude?: number | null; longitude?: number | null }>;
}




interface ChecklistItem {
  id: string; key: string; label: string; labelEn: string | null; description: string | null; icon: string | null;
  required: boolean; completed: boolean; photoCount: number;
}




interface ValidatedContract {
  id: string; contractNumber: string; customerName: string; vehiclePlate: string; vehicleModel: string; vehicleColor: string | null; status: string;
}




const MAX_PHOTOS = 10;




function CarDiagram({ onSelect, photoCounts }: { onSelect: (key: string) => void; photoCounts: Record<string, number> }) {
  const g = (k: string) => photoCounts[k] || 0;
  const done = (k: string) => g(k) > 0;
  return (
    <svg viewBox="0 0 300 540" className="w-full max-w-[280px] mx-auto">
      <path d="M108 510 Q60 490 48 430 L48 110 Q48 55 108 32 L192 32 Q252 55 252 110 L252 430 Q240 490 192 510 Z" fill="#f8f8f3" stroke="#d8d8d2" strokeWidth="2" />
      <path d="M120 430 L120 490 Q150 510 180 490 L180 430 Q150 420 120 430 Z" fill="#ebebe6" opacity="0.5" />
      <path d="M95 390 Q150 410 205 390 L185 350 Q150 365 115 350 Z" fill="#dbeafe" stroke="#60a5fa" strokeWidth="1.5" />
      <rect x="80" y="180" width="140" height="170" rx="20" fill="#f0f0eb" stroke="#b8b8b2" strokeWidth="1" />
      <path d="M95 180 Q150 160 205 180 L185 215 Q150 200 115 215 Z" fill="#dbeafe" stroke="#60a5fa" strokeWidth="1.5" />
      <path d="M120 110 L120 180 Q150 170 180 180 L180 110 Q150 100 120 110 Z" fill="#ebebe6" opacity="0.5" />
      <rect x="38" y="365" width="12" height="20" rx="4" fill="#d8d8d2" />
      <rect x="250" y="365" width="12" height="20" rx="4" fill="#d8d8d2" />
      <ellipse cx="100" cy="478" rx="12" ry="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
      <ellipse cx="200" cy="478" rx="12" ry="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
      <ellipse cx="100" cy="60" rx="10" ry="7" fill="#fecaca" stroke="#ef4444" strokeWidth="1.5" />
      <ellipse cx="200" cy="60" rx="10" ry="7" fill="#fecaca" stroke="#ef4444" strokeWidth="1.5" />
      <ellipse cx="62" cy="155" rx="18" ry="28" fill="#1f2937" />
      <ellipse cx="62" cy="155" rx="8" ry="14" fill="#64748b" />
      <ellipse cx="238" cy="155" rx="18" ry="28" fill="#1f2937" />
      <ellipse cx="238" cy="155" rx="8" ry="14" fill="#64748b" />
      <ellipse cx="68" cy="420" rx="18" ry="26" fill="#1f2937" />
      <ellipse cx="68" cy="420" rx="8" ry="13" fill="#64748b" />
      <ellipse cx="232" cy="420" rx="18" ry="26" fill="#1f2937" />
      <ellipse cx="232" cy="420" rx="8" ry="13" fill="#64748b" />
      <PhotoZone x={90} y={435} w={120} h={60} label="front" done={done('front')} count={g('front')} onSelect={onSelect} />
      <PhotoZone x={90} y={75} w={120} h={60} label="back" done={done('back')} count={g('back')} onSelect={onSelect} />
      <PhotoZone x={28} y={195} w={50} h={130} label="passenger_side" done={done('passenger_side')} count={g('passenger_side')} onSelect={onSelect} />
      <PhotoZone x={222} y={195} w={50} h={130} label="driver_side" done={done('driver_side')} count={g('driver_side')} onSelect={onSelect} />
      <text x="150" y="525" textAnchor="middle" fill="#5c5c5c" fontSize="10" fontWeight="700" letterSpacing="1.5">FRONT</text>
      <text x="150" y="22" textAnchor="middle" fill="#5c5c5c" fontSize="10" fontWeight="700" letterSpacing="1.5">BACK</text>
      <text x="14" y="265" textAnchor="middle" fill="#5c5c5c" fontSize="9" fontWeight="600" transform="rotate(-90,14,265)" letterSpacing="0.5">PASSENGER</text>
      <text x="286" y="265" textAnchor="middle" fill="#5c5c5c" fontSize="9" fontWeight="600" transform="rotate(90,286,265)" letterSpacing="0.5">DRIVER</text>
    </svg>
  );
}




function PhotoZone({ x, y, w, h, label, done, count, onSelect }: { x: number; y: number; w: number; h: number; label: string; done: boolean; count: number; onSelect: (k: string) => void }) {
  return (
    <g onClick={() => onSelect(label)} style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={done ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.02)'} stroke={done ? '#10b981' : '#d8d8d2'} strokeWidth="1.5" strokeDasharray={done ? 'none' : '4 3'} />
      {count > 0 && (
        <>
          <circle cx={x + w - 10} cy={y + 10} r={10} fill="#10b981" />
          <text x={x + w - 10} y={y + 14} textAnchor="middle" fill="white" fontSize="10" fontWeight="700">{count}</text>
        </>
      )}
    </g>
  );
}




function LanguageSelector({ locale, setLocale, dark = false }: { locale: Locale; setLocale: (l: Locale) => void; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const currentLocale = LOCALES.find(l => l.code === locale) || LOCALES[0];
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ' + (dark ? 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10' : 'border-[#ebebe6] bg-white text-gray-600 hover:bg-[#fafaf7]')}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
        {currentLocale.nativeName}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-[#ebebe6] py-1 z-50 min-w-[160px] max-h-[300px] overflow-y-auto animate-slide-up">
            {LOCALES.map(l => (
              <button key={l.code} onClick={() => { setLocale(l.code); setOpen(false); }} className={'w-full text-left px-4 py-2 text-sm hover:bg-[#fafaf7] transition-colors ' + (l.code === locale ? 'font-semibold text-[#0a0a0a] bg-[#fef9d9]' : 'text-gray-700')}>
                <span className="mr-2 text-xs text-gray-400">{l.code.toUpperCase()}</span>
                {l.nativeName}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}




const Icon = {
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  Upload: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9 5 5 0 019.9-1A5.5 5.5 0 0118 16M12 12v6m0 0l-3-3m3 3l3-3" /></svg>,
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Close: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  Link: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Car: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  Calendar: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
};




export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const [locale, setLocale] = useState<Locale>('it');
  const [mode, setMode] = useState<'loading' | 'admin' | 'customer' | 'completed' | 'unauthenticated'>('loading');
  const [token, setToken] = useState('');
  const [contracts, setContracts] = useState<AdminContract[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' });
  const [uploading, setUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [generatedToken, setGeneratedToken] = useState<{ token: string; expiresAt: string; link: string } | null>(null);
  const [copied, setCopied] = useState('');
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [contract, setContract] = useState<ValidatedContract | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [localPreviews, setLocalPreviews] = useState<Record<string, string[]>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);




  useEffect(() => { return () => { objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url)); }; }, []);




  const geoRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const geoRequestedRef = useRef(false);




  const requestGeolocation = useCallback((): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (geoRef.current) { resolve(geoRef.current); return; }
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => { const geo = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }; geoRef.current = geo; resolve(geo); },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 }
      );
    });
  }, []);




  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) { const tk = hash.replace('#token=', ''); setToken(tk); setMode('customer'); validateToken(tk); }
    else {
      if (sessionStatus === 'loading') return;
      if (sessionStatus === 'unauthenticated' || !session) { setMode('unauthenticated'); return; }
      setMode('admin'); loadContracts();
    }
  }, [sessionStatus, session]);




  const validateToken = async (tk: string) => {
    try {
      setError('');
      const res = await fetch('/api/token/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid token'); if (res.status === 410) setMode('completed'); return; }
      setContract(data.contract); setChecklist(data.photoChecklist);
      const counts: Record<string, number> = {};
      data.photoChecklist.forEach((item: ChecklistItem) => { counts[item.key] = item.photoCount; });
      setPhotoCounts(counts);
    } catch { setError(t(locale, 'landing.connectionError')); }
  };




  const loadContracts = async () => { try { const r = await fetch('/api/admin/contracts'); if (r.ok) setContracts((await r.json()).contracts || []); } catch {} };




  const openCamera = (key: string) => {
    const count = photoCounts[key] || 0;
    if (count >= MAX_PHOTOS) { setError('Massimo ' + MAX_PHOTOS + ' foto per questo angolo.'); return; }
    const item = checklist.find(c => c.key === key);
    if (!item) return;
    setActiveKey(key); setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => fileInputRef.current?.click(), 150);
  };




  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !activeKey || !contract) return;
    const item = checklist.find(c => c.key === activeKey);
    if (!item) return;
    const remaining = MAX_PHOTOS - (photoCounts[activeKey] || 0);
    const toUpload = Array.from(files).slice(0, remaining);
    for (const file of toUpload) {
      setUploadingPhoto(activeKey);
      try {
        if (!geoRequestedRef.current) { geoRequestedRef.current = true; requestGeolocation(); }
        const geo = geoRef.current;
        const fd = new FormData();
        fd.append('token', token); fd.append('photo', file); fd.append('requirementId', item.id);
        if (geo) { fd.append('latitude', geo.latitude.toString()); fd.append('longitude', geo.longitude.toString()); }
        const res = await fetch('/api/photos/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        const objectUrl = URL.createObjectURL(file);
        objectUrlsRef.current.push(objectUrl);
        setLocalPreviews(p => ({ ...p, [activeKey!]: [...(p[activeKey!] || []), objectUrl] }));
        setPhotoCounts(p => ({ ...p, [activeKey!]: (p[activeKey!] || 0) + 1 }));
        setChecklist(p => p.map(c => c.key === activeKey ? { ...c, completed: true, photoCount: c.photoCount + 1 } : c));
      } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Upload failed'); }
      finally { setUploadingPhoto(null); }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };




  const totalPhotos = Object.values(photoCounts).reduce((s, c) => s + c, 0);
  const handleSubmit = async () => {
    if (totalPhotos === 0 || isSubmitting) return;
    setIsSubmitting(true); setError('');
    try {
      const res = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setMode('completed');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Submit failed'); }
    finally { setIsSubmitting(false); }
  };




  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setShowCreate(false); setCreateForm({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' });
      if (d.accessToken) setGeneratedToken(d.accessToken); loadContracts();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };




  const handleGenerateToken = async (cid: string) => {
    try { const r = await fetch('/api/admin/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractId: cid }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setGeneratedToken(d.accessToken); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };




  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true); setBulkResult(null);
    try { const fd = new FormData(); fd.append('file', file); const r = await fetch('/api/admin/bulk-upload', { method: 'POST', body: fd }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setBulkResult(d); loadContracts(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setUploading(false); if (e.target) e.target.value = ''; }
  };




  const copyToClip = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(''), 2000); };




  const statusBadge = (s: string) => {
    const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
      completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
      in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'In Progress' },
      pending: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Pending' },
      archived: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Archived' },
    };
    return map[s] || map.pending;
  };




  const filteredContracts = useCallback(() => {
    let result = contracts;
    if (statusFilter !== 'all') result = result.filter(c => c.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c =>
        c.contractNumber.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.vehiclePlate.toLowerCase().includes(q) ||
        c.vehicleModel.toLowerCase().includes(q) ||
        (c.customerEmail && c.customerEmail.toLowerCase().includes(q))
      );
    }
    return result;
  }, [contracts, searchQuery, statusFilter]);




  const handleDeleteSelected = async () => {
    if (selectedContracts.size === 0) return;
    const ids = Array.from(selectedContracts);
    try {
      for (const id of ids) { const r = await fetch('/api/admin/contracts?id=' + id, { method: 'DELETE' }); if (!r.ok) { const errData = await r.json().catch(() => ({})); throw new Error(errData.error || `Delete failed for ${id}`); } }
      setSelectedContracts(new Set()); setDeleteAllConfirm(false); loadContracts();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to delete'); }
  };




  const toggleSelectAll = () => {
    const filtered = filteredContracts();
    if (selectedContracts.size === filtered.length && filtered.length > 0) setSelectedContracts(new Set());
    else setSelectedContracts(new Set(filtered.map(c => c.id)));
  };




  const toggleSelect = (id: string) => {
    setSelectedContracts(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };




  if (mode === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#FFCB05] animate-spin" />
      </div>
    </div>
  );




  if (mode === 'unauthenticated') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#161616] to-[#0a0a0a] px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FFCB05] mb-5 shadow-lg shadow-[#FFCB05]/20"><Icon.Car /></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HERTZ MALTA</h1>
          <p className="text-sm text-gray-400 mt-1.5 font-medium">Check-out · Admin Console</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in with your Hertz Malta Microsoft 365 account.</p>
          <button onClick={() => signIn('azure-ad', { callbackUrl: '/' })} className="w-full flex items-center justify-center gap-2.5 bg-[#0a0a0a] hover:bg-[#161616] text-white font-medium py-3 px-4 rounded-xl transition-all active:scale-[0.98]">
            <svg viewBox="0 0 21 21" className="w-4 h-4" fill="currentColor"><path d="M1 1h9v9H1V1zm10 0h9v9h-9V1zM1 11h9v9H1v-9zm10 0h9v9h-9v-9z"/></svg>
            Sign in with Microsoft
          </button>
          <p className="mt-6 text-[11px] text-gray-400 text-center leading-relaxed">Restricted to Hertz Malta / United Garage accounts.<br />Single-tenant authentication via Microsoft Entra ID.</p>
        </div>
      </div>
    </div>
  );




  if (mode === 'completed') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center border border-emerald-100 animate-slide-up">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><Icon.Check /></div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{t(locale, 'confirm.title')}</h1>
        <p className="text-sm text-gray-600">{t(locale, 'confirm.subtitle')}</p>
        <div className="mt-8 pt-6 border-t border-gray-100"><p className="text-xs text-gray-400">{t(locale, 'confirm.thanks')}</p></div>
      </div>
    </div>
  );




  if (mode === 'customer') return (
    <div className="min-h-screen bg-[#fafaf7]">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
      <div className="bg-[#0a0a0a]">
        <div className="max-w-lg mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-[#FFCB05] flex items-center justify-center"><Icon.Car /></div>
                <h1 className="text-base font-bold text-white tracking-tight">HERTZ MALTA</h1>
              </div>
              <p className="text-[11px] text-[#FFCB05] mt-0.5 font-medium ml-9">{t(locale, 'app.title')}</p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector locale={locale} setLocale={setLocale} dark />
              {contract && (
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{t(locale, 'confirm.contract')}</p>
                  <p className="text-sm font-semibold text-white tabular-nums">{contract.contractNumber}</p>
                </div>
              )}
            </div>
          </div>
          {contract && (
            <div className="mt-4 p-3.5 rounded-xl bg-white/5 border border-white/10 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] text-[#FFCB05] uppercase tracking-wide font-medium">{t(locale, 'checklist.customer')}</p><p className="font-medium text-white">{contract.customerName}</p></div>
              <div><p className="text-[10px] text-[#FFCB05] uppercase tracking-wide font-medium">{t(locale, 'checklist.vehicle')}</p><p className="font-medium text-white">{contract.vehicleModel}</p></div>
              <div><p className="text-[10px] text-[#FFCB05] uppercase tracking-wide font-medium">{t(locale, 'checklist.plate')}</p><p className="font-medium text-white tabular-nums">{contract.vehiclePlate}</p></div>
              {contract.vehicleColor && <div><p className="text-[10px] text-[#FFCB05] uppercase tracking-wide font-medium">{t(locale, 'checklist.color')}</p><p className="font-medium text-white">{contract.vehicleColor}</p></div>}
            </div>
          )}
        </div>
      </div>
      <div className="max-w-lg mx-auto px-5 py-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2 animate-slide-up">
            <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs flex-shrink-0">!</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="font-bold text-red-400 ml-2"><Icon.Close /></button>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-[#ebebe6]"><CarDiagram onSelect={openCamera} photoCounts={photoCounts} /></div>
        <div className="space-y-2">
          {checklist.map(item => {
            const count = photoCounts[item.key] || 0;
            const full = count >= MAX_PHOTOS;
            const isUploading = uploadingPhoto === item.key;
            const previews = localPreviews[item.key] || [];
            const translatedLabel = t(locale, 'photo.' + item.key) !== 'photo.' + item.key ? t(locale, 'photo.' + item.key) : item.label;
            return (
              <div key={item.id} onClick={() => !full && openCamera(item.key)} className={'bg-white rounded-xl p-3.5 border cursor-pointer transition-all active:scale-[0.99] ' + (full ? 'border-red-200 bg-red-50/40' : count > 0 ? 'border-emerald-200 bg-emerald-50/30' : 'border-[#ebebe6] hover:border-[#FFCB05]')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium ' + (full ? 'bg-red-100 text-red-700' : count > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                      {isUploading ? <div className="w-4 h-4 border-2 border-[#FFCB05] border-t-transparent rounded-full animate-spin" /> : full ? '✓' : count > 0 ? '✓' : <Icon.Car />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{translatedLabel}</p>
                      <p className="text-xs text-gray-500 tabular-nums">{count}/{MAX_PHOTOS} foto</p>
                    </div>
                  </div>
                  <div className={'px-2.5 py-1 rounded-md text-xs font-medium ' + (full ? 'bg-red-100 text-red-700' : isUploading ? 'bg-amber-100 text-amber-700' : count > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                    {full ? t(locale, 'checklist.retake') : isUploading ? t(locale, 'checklist.uploading') : count > 0 ? t(locale, 'checklist.retake') : t(locale, 'checklist.takePhoto')}
                  </div>
                </div>
                {previews.length > 0 && (
                  <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
                    {previews.map((src, i) => <img key={i} src={src} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-200" />)}
                    {!full && (<div onClick={e => { e.stopPropagation(); openCamera(item.key); }} className="w-14 h-14 rounded-lg bg-[#fef9d9] border-2 border-dashed border-[#FFCB05] flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-[#fef3c7]"><Icon.Plus /></div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {totalPhotos > 0 && (
          <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-4 rounded-xl text-white font-bold text-base tracking-tight transition-all active:scale-[0.99] shadow-lg shadow-emerald-200 disabled:shadow-none" style={{ backgroundColor: isSubmitting ? '#9ca3af' : '#10b981' }}>
            {isSubmitting ? (<span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t(locale, 'checklist.submitting')}</span>) : (<span className="flex items-center justify-center gap-2"><Icon.Check /><span>{t(locale, 'checklist.submitCheckin')}</span></span>)}
          </button>
        )}
        {totalPhotos === 0 && <p className="text-center text-xs text-gray-400">{t(locale, 'checklist.completeAll')}</p>}
      </div>
      <div className="h-10" />
    </div>
  );




  return (
    <div className="min-h-screen bg-[#fafaf7] text-gray-900">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#ebebe6]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0a0a0a] flex items-center justify-center text-[#FFCB05]"><Icon.Car /></div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-[#0a0a0a]">HERTZ MALTA</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Admin Console</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadContracts} className="p-2 rounded-lg hover:bg-[#fafaf7] text-gray-600 transition-colors" title="Refresh"><Icon.Refresh /></button>
            <button onClick={() => signOut({ callbackUrl: '/' })} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-[#fafaf7] border border-[#ebebe6] transition-colors">Sign out</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#0a0a0a]">Contracts</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage check-ins, create tokens and upload photos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2 bg-white border border-[#ebebe6] text-gray-700 hover:bg-[#fafaf7] px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              {uploading ? <><span className="w-4 h-4 border-2 border-gray-300 border-t-[#FFCB05] rounded-full animate-spin" /> Uploading...</> : <><Icon.Upload /> Bulk Upload Excel</>}
              <input type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" disabled={uploading} />
            </label>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 bg-[#FFCB05] hover:bg-[#e6b800] text-[#0a0a0a] px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-[0.98]"><Icon.Plus /> New Contract</button>
            {selectedContracts.size > 0 && (<button onClick={() => setDeleteAllConfirm(true)} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]"><Icon.Trash /> Delete ({selectedContracts.size})</button>)}
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Search /></span>
            <input type="text" placeholder="Search by contract, name, plate..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#ebebe6] bg-white text-sm focus:outline-none focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/20 transition-all" />
            {searchQuery && (<button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><Icon.Close /></button>)}
          </div>
          <div className="flex gap-1.5 bg-white border border-[#ebebe6] rounded-lg p-1 overflow-x-auto">
            {[{ v: 'all', l: 'All' }, { v: 'pending', l: 'Pending' }, { v: 'in_progress', l: 'In Progress' }, { v: 'completed', l: 'Completed' }].map(f => (
              <button key={f.v} onClick={() => setStatusFilter(f.v)} className={'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ' + (statusFilter === f.v ? 'bg-[#0a0a0a] text-white' : 'text-gray-600 hover:bg-[#fafaf7]')}>{f.l}</button>
            ))}
          </div>
        </div>
        {bulkResult && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-4 animate-slide-up">
            <strong>Import complete:</strong> {bulkResult.created || 0} created, {bulkResult.updated || 0} updated, {bulkResult.errors?.length || 0} errors.
            {bulkResult.errors?.length > 0 && (<details className="mt-2"><summary className="cursor-pointer font-medium">Show errors</summary><ul className="mt-2 text-xs space-y-1">{bulkResult.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}</ul></details>)}
          </div>
        )}
        <div className="bg-white rounded-2xl border border-[#ebebe6] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ebebe6] bg-[#fafaf7] flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filteredContracts().length > 0 && selectedContracts.size === filteredContracts().length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-[#0a0a0a] focus:ring-[#FFCB05]" />
              <span className="text-xs font-medium text-gray-600">{filteredContracts().length} contracts</span>
            </label>
            <span className="text-xs text-gray-400">Total: {contracts.length}</span>
          </div>
          {filteredContracts().length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#fafaf7] flex items-center justify-center mx-auto mb-3 text-gray-400"><Icon.Car /></div>
              <p className="text-sm font-medium text-gray-700 mb-1">No contracts found</p>
              <p className="text-xs text-gray-500">{searchQuery ? 'Try a different search.' : 'Create your first contract to get started.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#ebebe6]">
              {filteredContracts().map(c => {
                const sb = statusBadge(c.status);
                return (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#fafaf7] transition-colors">
                    <input type="checkbox" checked={selectedContracts.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-gray-300 text-[#0a0a0a] focus:ring-[#FFCB05]" />
                    <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-12 md:col-span-3">
                        <p className="text-sm font-semibold text-gray-900 tabular-nums truncate">{c.contractNumber}</p>
                        <p className="text-xs text-gray-500 truncate">{c.customerName}</p>
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <p className="text-sm text-gray-700 tabular-nums truncate">{c.vehiclePlate}</p>
                        <p className="text-xs text-gray-500 truncate">{c.vehicleModel}</p>
                      </div>
                      <div className="col-span-3 md:col-span-2 hidden md:block">
                        <p className="text-xs text-gray-500">{c.photosSubmitted} photos</p>
                        <p className="text-xs text-gray-400">{c.tokens.length} tokens</p>
                      </div>
                      <div className="col-span-3 md:col-span-2 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${sb.dot}`}></span>
                        <span className={`text-xs font-medium ${sb.text}`}>{sb.label}</span>
                      </div>
                      <div className="col-span-12 md:col-span-2 flex justify-end gap-1">
                        <button onClick={() => handleGenerateToken(c.id)} className="p-2 rounded-lg text-gray-500 hover:bg-[#FFCB05]/10 hover:text-[#0a0a0a] transition-colors" title="Generate Token"><Icon.Link /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">New Contract</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><Icon.Close /></button>
            </div>
            <form onSubmit={handleCreateContract} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contract Number</label>
                  <input required value={createForm.contractNumber} onChange={e => setCreateForm({ ...createForm, contractNumber: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
                  <input required value={createForm.customerName} onChange={e => setCreateForm({ ...createForm, customerName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email (Optional)</label>
                  <input type="email" value={createForm.customerEmail} onChange={e => setCreateForm({ ...createForm, customerEmail: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone (Optional)</label>
                  <input value={createForm.customerPhone} onChange={e => setCreateForm({ ...createForm, customerPhone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Plate</label>
                  <input required value={createForm.vehiclePlate} onChange={e => setCreateForm({ ...createForm, vehiclePlate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Model</label>
                  <input required value={createForm.vehicleModel} onChange={e => setCreateForm({ ...createForm, vehicleModel: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Color (Optional)</label>
                <input value={createForm.vehicleColor} onChange={e => setCreateForm({ ...createForm, vehicleColor: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/20" />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#161616]">Create Contract</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {generatedToken && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setGeneratedToken(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Access Link Generated</h3>
              <button onClick={() => setGeneratedToken(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><Icon.Close /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Token</span>
                  <button onClick={() => copyToClip(generatedToken.token, 'token')} className="text-xs font-medium text-[#0a0a0a] hover:underline">{copied === 'token' ? 'Copied!' : 'Copy'}</button>
                </div>
                <p className="font-mono text-sm text-gray-900 break-all">{generatedToken.token}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Customer Link</span>
                  <button onClick={() => copyToClip(generatedToken.link, 'link')} className="text-xs font-medium text-[#0a0a0a] hover:underline">{copied === 'link' ? 'Copied!' : 'Copy'}</button>
                </div>
                <p className="font-mono text-sm text-gray-900 break-all">{generatedToken.link}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Icon.Calendar />
                <span>Expires: {new Date(generatedToken.expiresAt).toLocaleString()}</span>
              </div>
              <button onClick={() => setGeneratedToken(null)} className="w-full py-2.5 rounded-lg bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#161616]">Done</button>
            </div>
          </div>
        </div>
      )}
      {deleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setDeleteAllConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete {selectedContracts.size} contracts?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone. All photos and tokens associated with these contracts will be permanently deleted.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteAllConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteSelected} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}