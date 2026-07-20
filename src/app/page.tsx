'use client';

import { useState, useEffect, useRef } from 'react';
import { t, LOCALES, type Locale } from '@/lib/i18n';

interface AdminContract {
  id: string; contractNumber: string; customerName: string; customerEmail: string | null; customerPhone: string | null;
  vehiclePlate: string; vehicleModel: string; vehicleColor: string | null; status: string; createdAt: string;
  tokens: Array<{ id: string; token: string; expiresAt: string; usedAt: string | null; isExpired: boolean }>;
  photosSubmitted: number;
}

interface ChecklistItem {
  id: string; key: string; label: string; description: string | null; required: boolean; completed: boolean; photoCount: number;
}

const MAX_PHOTOS = 10;

export default function Home() {
  const [locale, setLocale] = useState<Locale>('en');
  const [mode, setMode] = useState<'loading' | 'admin' | 'customer' | 'completed'>('loading');
  const [token, setToken] = useState('');
  const [contracts, setContracts] = useState<AdminContract[]>([]);
  
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' });
  const [uploading, setUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [tokenDialog, setTokenDialog] = useState<{ contractId: string; contractNumber: string } | null>(null);
  const [generatedToken, setGeneratedToken] = useState<{ token: string; expiresAt: string; link: string } | null>(null);
  const [copied, setCopied] = useState('');
  
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  const [contract, setContract] = useState<any>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [localPreviews, setLocalPreviews] = useState<Record<string, string[]>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) { 
      const tk = hash.replace('#token=', ''); 
      setToken(tk); 
      setMode('customer'); 
      validateToken(tk); 
    } else { 
      setMode('admin'); 
      loadContracts(); 
    }
  }, []);

  const validateToken = async (tk: string) => {
    try {
      setError('');
      const res = await fetch('/api/token/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk }) });
      const data = await res.json();
      if (!res.ok) { 
        setError(data.error || 'Invalid token'); 
        if (res.status === 410) setMode('completed'); 
        return; 
      }
      setContract(data.contract); 
      setChecklist(data.photoChecklist);
      const counts: Record<string, number> = {};
      data.photoChecklist.forEach((item: ChecklistItem) => { counts[item.key] = item.photoCount; });
      setPhotoCounts(counts);
    } catch { 
      setError(t(locale, 'landing.connectionError')); 
    }
  };

  const openCamera = (key: string) => {
    const count = photoCounts[key] || 0;
    if (count >= MAX_PHOTOS) { setError('Maximum ' + MAX_PHOTOS + ' photos for this angle.'); return; }
    const item = checklist.find(c => c.key === key);
    if (!item) return;
    setActiveKey(key); 
    setError('');
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
        const fd = new FormData();
        fd.append('token', token); 
        fd.append('photo', file); 
        fd.append('requirementId', item.id);
        const res = await fetch('/api/photos/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setLocalPreviews(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), URL.createObjectURL(file)] }));
        setPhotoCounts(p => ({ ...p, [activeKey]: (p[activeKey] || 0) + 1 }));
        setChecklist(p => p.map(c => c.key === activeKey ? { ...c, completed: true, photoCount: c.photoCount + 1 } : c));
      } catch (err: unknown) { 
        setError(err instanceof Error ? err.message : 'Upload failed'); 
      } finally { 
        setUploadingPhoto(null); 
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalPhotos = Object.values(photoCounts).reduce((s, c) => s + c, 0);

  const handleSubmit = async () => {
    if (totalPhotos === 0 || isSubmitting) return;
    setIsSubmitting(true); 
    setError('');
    try {
      const res = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setMode('completed');
    } catch (err: unknown) { 
      setError(err instanceof Error ? err.message : 'Submit failed'); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const loadContracts = async () => { 
    try { 
      const r = await fetch('/api/admin/contracts'); 
      if (r.ok) setContracts((await r.json()).contracts || []); 
    } catch {} 
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) });
      const d = await r.json(); 
      if (!r.ok) throw new Error(d.error);
      setShowCreate(false); 
      setCreateForm({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' });
      if (d.accessToken) setGeneratedToken(d.accessToken); 
      loadContracts();
    } catch (err: unknown) { 
      alert(err instanceof Error ? err.message : 'Failed'); 
    }
  };

  const handleGenerateToken = async (cid: string) => {
    try { 
      const r = await fetch('/api/admin/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractId: cid }) }); 
      const d = await r.json(); 
      if (!r.ok) throw new Error(d.error); 
      setGeneratedToken(d.accessToken); 
    } catch (err: unknown) { 
      alert(err instanceof Error ? err.message : 'Failed'); 
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return; 
    setUploading(true); 
    setBulkResult(null);
    try { 
      const fd = new FormData(); 
      fd.append('file', file); 
      const r = await fetch('/api/admin/bulk-upload', { method: 'POST', body: fd }); 
      const d = await r.json(); 
      if (!r.ok) throw new Error(d.error); 
      setBulkResult(d); 
      loadContracts(); 
    } catch (err: unknown) { 
      alert(err instanceof Error ? err.message : 'Failed'); 
    } finally { 
      setUploading(false); 
      if (e.target) e.target.value = ''; 
    }
  };

  const copyToClip = (text: string, id: string) => { 
    navigator.clipboard.writeText(text); 
    setCopied(id); 
    setTimeout(() => setCopied(''), 2000); 
  };

  const handleDeleteContract = async (id: string) => {
    try {
      const r = await fetch('/api/admin/contracts?id=' + id, { method: 'DELETE' });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || 'Delete failed');
      }
      setDeleteConfirm(null);
      setSelectedContracts(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadContracts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedContracts.size === 0) return;
    const ids = Array.from(selectedContracts);
    try {
      for (const id of ids) {
        const r = await fetch('/api/admin/contracts?id=' + id, { method: 'DELETE' });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || `Delete failed for ${id}`);
        }
      }
      setSelectedContracts(new Set());
      setDeleteAllConfirm(false);
      loadContracts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const toggleSelectAll = () => {
    if (selectedContracts.size === contracts.length && contracts.length > 0) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(contracts.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedContracts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (mode === 'loading') return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div></div>;

  if (mode === 'completed') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t(locale, 'confirm.title')}</h1>
        <p className="text-gray-600 mb-6">{t(locale, 'confirm.subtitle')}</p>
        <p className="text-sm text-gray-500 font-medium">{t(locale, 'confirm.thanks')}</p>
      </div>
    </div>
  );

  if (mode === 'customer') return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">HERTZ MALTA</h1>
          <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white shadow-sm">
            {LOCALES.map(l => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
          </select>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold text-red-400 ml-2">x</button>
          </div>
        )}

        {contract && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t(locale, 'confirm.contract')}</p>
            <p className="font-semibold text-gray-800">{contract.contractNumber}</p>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
              <div><p className="text-xs text-gray-500">{t(locale, 'checklist.customer')}</p><p className="font-medium text-sm">{contract.customerName}</p></div>
              <div><p className="text-xs text-gray-500">{t(locale, 'checklist.vehicle')}</p><p className="font-medium text-sm">{contract.vehicleModel}</p></div>
              <div><p className="text-xs text-gray-500">{t(locale, 'checklist.plate')}</p><p className="font-medium text-sm">{contract.vehiclePlate}</p></div>
              {contract.vehicleColor && <div><p className="text-xs text-gray-500">{t(locale, 'checklist.color')}</p><p className="font-medium text-sm">{contract.vehicleColor}</p></div>}
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleFileChange} />
        
        <div className="space-y-3">
          {checklist.map(item => {
            const count = photoCounts[item.key] || 0;
            const full = count >= MAX_PHOTOS;
            const isUploading = uploadingPhoto === item.key;
            const previews = localPreviews[item.key] || [];
            return (
              <div key={item.id} onClick={() => !full && openCamera(item.key)} className={'bg-white rounded-xl p-4 border-2 cursor-pointer transition-all active:scale-[0.98] ' + (full ? 'border-green-300 bg-green-50/60' : count > 0 ? 'border-yellow-300 bg-yellow-50/60' : 'border-gray-200 hover:border-yellow-300')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800">{item.label}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${full ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                    {isUploading ? t(locale, 'checklist.uploading') : full ? '✓' : `${count}/${MAX_PHOTOS}`}
                  </span>
                </div>
                {previews.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
                    {previews.map((src, i) => <img key={i} src={src} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />)}
                    {!full && (
                      <div onClick={(e) => { e.stopPropagation(); openCamera(item.key); }} className="w-16 h-16 rounded-lg bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-gray-100 text-gray-400 text-2xl">+</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-md mx-auto">
            {totalPhotos > 0 ? (
              <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-3.5 rounded-xl text-white font-bold text-lg shadow-lg transition-all active:scale-[0.98]" style={{ backgroundColor: isSubmitting ? '#999' : '#1a1a1a' }}>
                {isSubmitting ? t(locale, 'checklist.submitting') : `${t(locale, 'checklist.submitCheckin')} (${totalPhotos})`}
              </button>
            ) : (
              <div className="text-center text-sm text-gray-500">{t(locale, 'checklist.completeAll')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* ADMIN VIEW */
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">HERTZ MALTA</h1>
            <p className="text-gray-500 text-sm">{t(locale, 'admin.subtitle')}</p>
          </div>
          <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm">
            {LOCALES.map(l => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: t(locale, 'admin.totalContracts'), value: contracts.length, bg: '#fff', bc: '#e5e5e5', c: '#1a1a1a' },
            { label: t(locale, 'admin.pending'), value: contracts.filter(c => c.status === 'pending').length, bg: '#fff', bc: '#e5e5e5', c: '#666' },
            { label: t(locale, 'admin.inProgress'), value: contracts.filter(c => c.status === 'in_progress').length, bg: '#FFCB05', bc: '#e6b800', c: '#1a1a1a' },
            { label: t(locale, 'admin.completed'), value: contracts.filter(c => c.status === 'completed').length, bg: '#22c55e', bc: '#16a34a', c: '#fff' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 shadow-sm border" style={{ backgroundColor: s.bg, borderColor: s.bc, color: s.c }}>
              <div className="text-3xl font-bold mb-1">{s.value}</div>
              <div className="text-xs font-medium uppercase tracking-wider opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button onClick={() => setShowCreate(true)} className="text-sm font-medium px-4 py-2 rounded-lg text-white shadow-sm" style={{ backgroundColor: '#1a1a1a' }}>+ {t(locale, 'admin.newContract')}</button>
          <label className="text-sm font-medium px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 cursor-pointer shadow-sm hover:bg-gray-50">
            {uploading ? t(locale, 'admin.processing') : t(locale, 'admin.bulkUpload')}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkUpload} />
          </label>
          <button onClick={loadContracts} className="text-sm font-medium px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 shadow-sm hover:bg-gray-50">{t(locale, 'admin.refresh')}</button>
          
          {selectedContracts.size > 0 && (
            <button onClick={() => setDeleteAllConfirm(true)} className="text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white shadow-sm hover:bg-red-700 ml-auto">
              {t(locale, 'admin.deleteSelected')} ({selectedContracts.size})
            </button>
          )}
        </div>

        {bulkResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-green-800 mb-2">{t(locale, 'admin.uploadSuccess')}</h3>
            <p className="text-sm text-green-700 mb-3">
              {bulkResult.summary.created} {t(locale, 'admin.created')}, {bulkResult.summary.skipped} {t(locale, 'admin.skipped')}, {bulkResult.summary.errors} {t(locale, 'admin.errors')}
            </p>
            <button onClick={() => setBulkResult(null)} className="text-xs text-green-600 underline">{t(locale, 'admin.close')}</button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selectedContracts.size === contracts.length && contracts.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300" />
                  </th>
                  {['Contract', 'Client', 'Vehicle', 'Status', 'Photos', 'Tokens', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contracts.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">{t(locale, 'admin.noContracts')}</td></tr>
                ) : (
                  contracts.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedContracts.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.contractNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.customerName}</div>
                        {c.customerEmail && <div className="text-xs text-gray-500">{c.customerEmail}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.vehicleModel}</div>
                        <div className="text-xs text-gray-500">{c.vehiclePlate}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${c.status === 'completed' ? 'bg-green-100 text-green-800' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{c.photosSubmitted}</td>
                      <td className="px-4 py-3">
                        {c.tokens.map(tk => {
                          const link = window.location.origin + '/#token=' + tk.token;
                          const statusText = tk.usedAt ? t(locale, 'admin.tokenUsed') : tk.isExpired ? t(locale, 'admin.tokenExpired') : t(locale, 'admin.tokenActive');
                          return (
                            <div key={tk.id} className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{tk.token.substring(0, 8)}...</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tk.usedAt ? 'bg-gray-200 text-gray-700' : tk.isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {statusText}
                              </span>
                              <button onClick={() => copyToClip(link, tk.id)} className="text-xs px-2 py-0.5 rounded font-medium transition-colors" style={{ backgroundColor: copied === tk.id ? '#22c55e' : '#FFCB05', color: copied === tk.id ? '#fff' : '#1a1a1a' }}>
                                {copied === tk.id ? 'OK' : t(locale, 'admin.copy')}
                              </button>
                            </div>
                          );
                        })}
                        {c.tokens.length === 0 && <span className="text-xs text-gray-400">{t(locale, 'admin.noTokens')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setTokenDialog({ contractId: c.id, contractNumber: c.contractNumber }); setGeneratedToken(null); }} className="text-xs font-medium px-2.5 py-1.5 rounded bg-gray-900 text-yellow-400 hover:bg-gray-800">+ Token</button>
                          {deleteConfirm === c.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeleteContract(c.id)} className="text-xs font-medium px-2 py-1.5 rounded bg-red-600 text-white hover:bg-red-700">Yes</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-xs font-medium px-2 py-1.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(c.id)} className="text-xs font-medium px-2.5 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200">{t(locale, 'admin.delete')}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-2">{t(locale, 'admin.newContractTitle')}</h2>
              <p className="text-sm text-gray-600 mb-4">{t(locale, 'admin.newContractDesc')}</p>
              <form onSubmit={handleCreateContract} className="space-y-3">
                {[
                  { key: 'contractNumber', label: t(locale, 'admin.contractNumber'), required: true },
                  { key: 'customerName', label: t(locale, 'admin.customerName'), required: true },
                  { key: 'vehiclePlate', label: t(locale, 'admin.vehiclePlate'), required: false },
                  { key: 'vehicleModel', label: t(locale, 'admin.vehicleModel'), required: false },
                  { key: 'customerEmail', label: t(locale, 'admin.customerEmail'), required: false },
                  { key: 'customerPhone', label: t(locale, 'admin.customerPhone'), required: false },
                  { key: 'vehicleColor', label: t(locale, 'admin.vehicleColor'), required: false }
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}{f.required && '*'}</label>
                    <input type="text" value={(createForm as any)[f.key]} onChange={e => setCreateForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none" required={f.required} />
                  </div>
                ))}
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 text-white py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: '#1a1a1a' }}>{t(locale, 'admin.createAndGenerate')}</button>
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">{t(locale, 'admin.close')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {(generatedToken || tokenDialog) && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setGeneratedToken(null); setTokenDialog(null); }}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full">
              {generatedToken ? (
                <>
                  <h2 className="text-xl font-bold mb-2">{t(locale, 'admin.linkGenerated')}</h2>
                  <p className="text-sm text-gray-600 mb-4">{t(locale, 'admin.linkGeneratedDesc')}</p>
                  <div className="bg-gray-50 p-3 rounded-lg break-all text-sm font-mono mb-4 border border-gray-200">{window.location.origin}{generatedToken.link}</div>
                  <div className="flex gap-3">
                    <button onClick={() => copyToClip(window.location.origin + generatedToken.link, 'dialog')} className="flex-1 text-white py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: '#1a1a1a' }}>{copied === 'dialog' ? 'OK!' : t(locale, 'admin.copyLink')}</button>
                    <button onClick={() => { setGeneratedToken(null); setTokenDialog(null); }} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">{t(locale, 'admin.close')}</button>
                  </div>
                </>
              ) : tokenDialog ? (
                <>
                  <h2 className="text-xl font-bold mb-2">{t(locale, 'admin.generateToken')}</h2>
                  <p className="text-sm text-gray-600 mb-4">{t(locale, 'admin.contractLabel')} <strong>{tokenDialog.contractNumber}</strong></p>
                  <button onClick={() => handleGenerateToken(tokenDialog.contractId)} className="w-full text-white py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: '#1a1a1a' }}>{t(locale, 'admin.generate')}</button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {deleteAllConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteAllConfirm(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg">{t(locale, 'admin.deleteSelected')}</h3>
                  <p className="text-sm text-gray-500">{selectedContracts.size} contracts</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">{t(locale, 'admin.deleteAllConfirm')}</p>
              <div className="flex gap-3">
                <button onClick={handleDeleteSelected} className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700">{t(locale, 'admin.deleteSelected')}</button>
                <button onClick={() => setDeleteAllConfirm(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200">{t(locale, 'admin.close')}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
