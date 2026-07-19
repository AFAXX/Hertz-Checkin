'use client';

import { useState, useEffect, useRef } from 'react';
import { t, LOCALES, type Locale } from '@/lib/i18n';

interface AdminContract {
  id: string;
  contractNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string | null;
  status: string;
  createdAt: string;
  tokens: Array<{ id: string; token: string; expiresAt: string; usedAt: string | null; isExpired: boolean }>;
  photosSubmitted: number;
  photos: Array<{ key: string; label: string; fileName: string; uploadedAt: string }>;
}

interface ChecklistItem {
  id: string;
  key: string;
  label: string;
  labelEn: string | null;
  description: string | null;
  icon: string | null;
  required: boolean;
  completed: boolean;
  photoCount: number;
}

interface ValidatedContract {
  id: string;
  contractNumber: string;
  customerName: string;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string | null;
  status: string;
}

const MAX_PHOTOS_PER_ANGLE = 10;

function CarDiagram({ onSelect, photoCounts }: {
  onSelect: (key: string) => void;
  photoCounts: Record<string, number>;
}) {
  const zones = [
    { key: 'front', cx: 200, cy: 40, rx: 70, ry: 18 },
    { key: 'passenger_side', cx: 60, cy: 140, rx: 18, ry: 55 },
    { key: 'driver_side', cx: 340, cy: 140, rx: 18, ry: 55 },
    { key: 'back', cx: 200, cy: 240, rx: 70, ry: 18 },
  ];

  return (
    <svg viewBox="0 0 400 280" className="w-full max-w-sm mx-auto" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}>
      <rect x="75" y="45" width="250" height="190" rx="50" fill="#e2e8f0" />
      <rect x="72" y="42" width="256" height="190" rx="52" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M 120 65 Q 200 45 280 65 L 270 85 Q 200 72 130 85 Z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
      <path d="M 125 210 Q 200 228 275 210 L 270 195 Q 200 208 130 195 Z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
      <rect x="95" y="90" width="18" height="70" rx="5" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" />
      <rect x="287" y="90" width="18" height="70" rx="5" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" />
      <circle cx="120" cy="58" r="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="280" cy="58" r="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="125" cy="218" r="7" fill="#fca5a5" stroke="#ef4444" strokeWidth="1.5" />
      <circle cx="275" cy="218" r="7" fill="#fca5a5" stroke="#ef4444" strokeWidth="1.5" />
      <ellipse cx="120" cy="245" rx="22" ry="10" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="120" cy="245" rx="10" ry="5" fill="#64748b" />
      <ellipse cx="280" cy="245" rx="22" ry="10" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="280" cy="245" rx="10" ry="5" fill="#64748b" />

      {zones.map(zone => {
        const count = photoCounts[zone.key] || 0;
        const done = count > 0;
        const full = count >= MAX_PHOTOS_PER_ANGLE;
        return (
          <g key={zone.key} onClick={() => onSelect(zone.key)} style={{ cursor: full ? 'default' : 'pointer' }}>
            <ellipse
              cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry}
              fill={full ? 'rgba(239,68,68,0.08)' : done ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.08)'}
              stroke={full ? '#ef4444' : done ? '#22c55e' : '#94a3b8'}
              strokeWidth={done ? 2.5 : 1.5}
              strokeDasharray={done ? 'none' : '6 3'}
            />
            {count > 0 && (
              <>
                <circle cx={zone.cx + zone.rx - 8} cy={zone.cy - zone.ry + 8} r="10" fill={full ? '#ef4444' : '#22c55e'} />
                <text x={zone.cx + zone.rx - 8} y={zone.cy - zone.ry + 12} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{count}</text>
              </>
            )}
          </g>
        );
      })}

      <text x="200" y="16" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">ANTERIORE</text>
      <text x="18" y="144" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600" transform="rotate(-90, 18, 144)">PASSEGGERO</text>
      <text x="382" y="144" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600" transform="rotate(90, 382, 144)">AUTISTA</text>
      <text x="200" y="274" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">POSTERIORE</text>
    </svg>
  );
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>('it');
  const [mode, setMode] = useState<'loading' | 'admin' | 'customer' | 'completed'>('loading');
  const [token, setToken] = useState('');

  const [contracts, setContracts] = useState<AdminContract[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' });
  const [uploading, setUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [tokenDialog, setTokenDialog] = useState<{ contractId: string; contractNumber: string } | null>(null);
  const [generatedToken, setGeneratedToken] = useState<{ token: string; expiresAt: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [contract, setContract] = useState<ValidatedContract | null>(null);
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
      const res = await fetch('/api/token/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tk }),
      });
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
    const currentCount = photoCounts[key] || 0;
    if (currentCount >= MAX_PHOTOS_PER_ANGLE) {
      setError(`Hai raggiunto il massimo di ${MAX_PHOTOS_PER_ANGLE} foto per questo angolo.`);
      return;
    }
    setActiveKey(key);
    setError('');
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeKey || !contract) return;
    const item = checklist.find(c => c.key === activeKey);
    if (!item) return;

    const currentCount = photoCounts[activeKey] || 0;
    const remaining = MAX_PHOTOS_PER_ANGLE - currentCount;
    const filesToUpload = Array.from(files).slice(0, remaining);

    if (files.length > remaining) {
      setError(`Puoi caricare massimo ${remaining} altra/e foto per questo angolo (max ${MAX_PHOTOS_PER_ANGLE}).`);
    }

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      setUploadingPhoto(activeKey);
      try {
        const formData = new FormData();
        formData.append('token', token);
        formData.append('photo', file);
        formData.append('requirementId', item.id);

        const res = await fetch('/api/photos/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        const preview = URL.createObjectURL(file);
        setLocalPreviews(prev => ({
          ...prev,
          [activeKey]: [...(prev[activeKey] || []), preview],
        }));

        setPhotoCounts(prev => ({ ...prev, [activeKey]: (prev[activeKey] || 0) + 1 }));
        setChecklist(prev => prev.map(c => c.key === activeKey ? { ...c, completed: true, photoCount: c.photoCount + 1 } : c));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setError('Errore durante il caricamento: ' + msg);
      } finally {
        setUploadingPhoto(null);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasAnyPhoto = Object.values(photoCounts).reduce((sum, c) => sum + c, 0) > 0;
  const totalRequired = checklist.filter(c => c.required).length;
  const doneRequired = checklist.filter(c => c.required && c.completed).length;
  const totalPhotos = Object.values(photoCounts).reduce((sum, c) => sum + c, 0);

  const handleSubmit = async () => {
    if (!hasAnyPhoto || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setMode('completed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submit failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadContracts = async () => {
    try {
      const res = await fetch('/api/admin/contracts');
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch (err) {
      console.error('Failed to load contracts:', err);
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setShowCreate(false);
      setCreateForm({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' });
      if (data.accessToken) setGeneratedToken(data.accessToken);
      loadContracts();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleGenerateToken = async (contractId: string) => {
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setGeneratedToken(data.accessToken);
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/bulk-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setBulkResult(data);
      loadContracts();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const copyLink = (link: string) => {
    const fullUrl = window.location.origin + link;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = (s: string) => s === 'completed' ? 'bg-green-100 text-green-800' : s === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600';

  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (mode === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t(locale, 'confirm.title')}</h1>
          <p className="text-gray-600 mb-1">{t(locale, 'confirm.subtitle')}</p>
          <p className="text-gray-500 text-sm mt-4">{t(locale, 'confirm.message')}</p>
          <p className="text-gray-400 text-xs mt-3">{t(locale, 'confirm.savedSecure')}</p>
          <div className="mt-8 p-4 bg-gray-50 rounded-xl">
            <p className="text-gray-500 text-xs">Grazie per aver scelto Hertz Malta</p>
            <p className="text-gray-400 text-xs">Thank you for choosing Hertz Malta</p>
          </div>
        </div>
      </div>
    );
  }  if (mode === 'customer') {
    return (
      <div className="min-h-screen bg-gray-50">
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFileChange} className="hidden" />

        <div className="bg-white shadow-sm border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">Hertz Malta - {t(locale, 'app.portal')}</h1>
                <p className="text-xs text-gray-500">{t(locale, 'app.title')}</p>
              </div>
              {contract && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">{t(locale, 'confirm.contract')}</p>
                  <p className="text-sm font-semibold text-gray-800">{contract.contractNumber}</p>
                </div>
              )}
            </div>
            {contract && (
              <div className="mt-3 p-3 bg-blue-50 rounded-xl grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-600 text-xs">{t(locale, 'checklist.customer')}</span>
                  <p className="font-medium text-gray-800">{contract.customerName}</p>
                </div>
                <div>
                  <span className="text-blue-600 text-xs">{t(locale, 'checklist.vehicle')}</span>
                  <p className="font-medium text-gray-800">{contract.vehicleModel}</p>
                </div>
                <div>
                  <span className="text-blue-600 text-xs">{t(locale, 'checklist.plate')}</span>
                  <p className="font-medium text-gray-800">{contract.vehiclePlate}</p>
                </div>
                {contract.vehicleColor && (
                  <div>
                    <span className="text-blue-600 text-xs">{t(locale, 'checklist.color')}</span>
                    <p className="font-medium text-gray-800">{contract.vehicleColor}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">!</span>
              <span>{error}</span>
              <button onClick={() => setError('')} className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600 font-bold">x</button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-1 text-center">{t(locale, 'landing.step2')}</h2>
            <p className="text-xs text-gray-400 text-center mb-3">Tocca un lato per scattare (max {MAX_PHOTOS_PER_ANGLE} foto per lato)</p>
            <CarDiagram onSelect={openCamera} photoCounts={photoCounts} />
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t(locale, 'checklist.requiredPhotos')}</span>
              <span className="text-sm text-gray-500">{doneRequired}/{totalRequired} {t(locale, 'checklist.photosCompleted')}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: totalRequired > 0 ? (doneRequired / totalRequired) * 100 + '%' : '0%' }} />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">{totalPhotos} foto totali caricate</p>
          </div>

          <div className="space-y-3">
            {checklist.map(item => {
              const uploadingThis = uploadingPhoto === item.key;
              const previews = localPreviews[item.key] || [];
              const count = photoCounts[item.key] || 0;
              const isFull = count >= MAX_PHOTOS_PER_ANGLE;

              return (
                <div key={item.id}
                  onClick={() => !isFull && openCamera(item.key)}
                  className={'bg-white rounded-xl p-4 border-2 cursor-pointer transition-all active:scale-[0.98] '
                    + (isFull ? 'border-red-200 bg-red-50 opacity-80' :
                       item.completed ? 'border-green-300 bg-green-50' :
                       'border-gray-200 hover:border-blue-300 hover:bg-blue-50')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={'w-10 h-10 rounded-full flex items-center justify-center text-base '
                        + (isFull ? 'bg-red-200' : item.completed ? 'bg-green-200' : 'bg-gray-100')}>
                        {uploadingThis ? (
                          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                        ) : isFull ? '\uD83D\uDD1D' : item.completed ? '\u2713' : '\uD83D\uDCF7'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-500">
                          {count}/{MAX_PHOTOS_PER_ANGLE} foto
                          {item.required && <span className="ml-1 text-orange-500">({t(locale, 'checklist.mandatory')})</span>}
                        </p>
                      </div>
                    </div>
                    <div className={'px-3 py-1 rounded-full text-xs font-medium '
                      + (isFull ? 'bg-red-100 text-red-700' :
                         uploadingThis ? 'bg-blue-100 text-blue-700' :
                         item.completed ? 'bg-green-200 text-green-800' :
                         'bg-gray-100 text-gray-500')}>
                      {isFull ? 'Completo' :
                       uploadingThis ? t(locale, 'checklist.uploading') :
                       item.completed ? t(locale, 'checklist.retake') :
                       t(locale, 'checklist.takePhoto')}
                    </div>
                  </div>
                  {item.description && !item.completed && (
                    <p className="text-xs text-gray-400 mt-2 ml-13">{item.description}</p>
                  )}
                  {previews.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {previews.map((src, idx) => (
                        <img key={idx} src={src} alt={item.label + ' ' + (idx + 1)}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-300" />
                      ))}
                      {!isFull && (
                        <div onClick={(e) => { e.stopPropagation(); openCamera(item.key); }}
                          className="w-16 h-16 rounded-lg bg-blue-50 border-2 border-dashed border-blue-300 flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-blue-100">
                          <span className="text-blue-500 text-xl">+</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasAnyPhoto && (
            <button onClick={handleSubmit} disabled={isSubmitting}
              className={'w-full py-4 rounded-xl text-white font-bold text-lg transition-all '
                + (isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-[0.98] shadow-lg shadow-green-200')}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  {t(locale, 'checklist.submitting')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {t(locale, 'checklist.submitCheckin')}
                  <span className="text-sm font-normal opacity-80">({totalPhotos} foto)</span>
                </span>
              )}
            </button>
          )}
          {!hasAnyPhoto && (
            <p className="text-center text-sm text-gray-400">{t(locale, 'checklist.completeAll')}</p>
          )}
        </div>
        <div className="h-8" />
      </div>
    );
  }

  // ADMIN RENDER
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-3 right-3 z-50">
        <select value={locale} onChange={e => setLocale(e.target.value as Locale)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shadow-sm">
          {LOCALES.map(l => (
            <option key={l.code} value={l.code}>{l.nativeName}</option>
          ))}
        </select>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t(locale, 'admin.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t(locale, 'admin.subtitle')}</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: t(locale, 'admin.totalContracts'), value: contracts.length, color: 'bg-blue-50 text-blue-700' },
            { label: t(locale, 'admin.pending'), value: contracts.filter(c => c.status === 'pending').length, color: 'bg-gray-100 text-gray-700' },
            { label: t(locale, 'admin.inProgress'), value: contracts.filter(c => c.status === 'in_progress').length, color: 'bg-yellow-50 text-yellow-700' },
            { label: t(locale, 'admin.completed'), value: contracts.filter(c => c.status === 'completed').length, color: 'bg-green-50 text-green-700' },
          ].map(s => (
            <div key={s.label} className={'rounded-xl p-4 ' + s.color}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs mt-1 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button onClick={() => setShowCreate(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + {t(locale, 'admin.newContract')}
          </button>
          <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-2">
            {uploading ? t(locale, 'admin.processing') : t(locale, 'admin.bulkUpload')}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} className="hidden" disabled={uploading} />
          </label>
          <button onClick={loadContracts}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium">
            {t(locale, 'admin.refresh')}
          </button>
        </div>

        {bulkResult && (
          <div className="bg-white rounded-xl p-4 border border-gray-100 mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">{t(locale, 'admin.uploadSuccess')}</h3>
            <p className="text-sm text-gray-600">
              {bulkResult.summary.created} {t(locale, 'admin.created')}, {bulkResult.summary.skipped} {t(locale, 'admin.skipped')}, {bulkResult.summary.errors} {t(locale, 'admin.errors')}
            </p>
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer">{t(locale, 'admin.results')}</summary>
              <div className="mt-2 max-h-40 overflow-y-auto text-xs text-gray-600 space-y-1">
                {bulkResult.results?.map((r: any, i: number) => (
                  <div key={i} className={r.status === 'error' ? 'text-red-600' : r.status === 'skipped' ? 'text-yellow-600' : 'text-green-600'}>
                    Row {r.row}: {r.contractNumber} - {r.customerName} [{r.status}] {r.token && <span>- token: {r.link}</span>} {r.error && <span>- {r.error}</span>}
                  </div>
                ))}
              </div>
            </details>
            <button onClick={() => setBulkResult(null)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4" onClick={() => setShowCreate(false)}>
            <form onSubmit={handleCreateContract} onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="font-semibold text-gray-800 mb-1 text-lg">{t(locale, 'admin.newContractTitle')}</h2>
              <p className="text-xs text-gray-500 mb-4">{t(locale, 'admin.newContractDesc')}</p>
              <div className="space-y-3">
                {[
                  { key: 'contractNumber', label: t(locale, 'admin.contractNumber'), required: true },
                  { key: 'customerName', label: t(locale, 'admin.customerName'), required: true },
                  { key: 'vehiclePlate', label: t(locale, 'admin.vehiclePlate'), required: false },
                  { key: 'vehicleModel', label: t(locale, 'admin.vehicleModel'), required: false },
                  { key: 'customerEmail', label: t(locale, 'admin.customerEmail'), required: false },
                  { key: 'customerPhone', label: t(locale, 'admin.customerPhone'), required: false },
                  { key: 'vehicleColor', label: t(locale, 'admin.vehicleColor'), required: false },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label} {f.required && '*'}</label>
                    <input type="text" value={(createForm as any)[f.key]}
                      onChange={e => setCreateForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required={f.required} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium">
                  {t(locale, 'admin.createAndGenerate')}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {(generatedToken || tokenDialog) && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
            onClick={() => { setGeneratedToken(null); setTokenDialog(null); }}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full">
              {generatedToken ? (
                <>
                  <h2 className="font-semibold text-gray-800 mb-1 text-lg">{t(locale, 'admin.linkGenerated')}</h2>
                  <p className="text-xs text-gray-500 mb-4">{t(locale, 'admin.linkGeneratedDesc')}</p>
                  <div className="bg-gray-50 rounded-xl p-3 break-all text-sm text-blue-600 font-mono mb-4">
                    {window.location.origin}{generatedToken.link}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => copyLink(generatedToken.link)}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium">
                      {copied ? t(locale, 'admin.copied') : t(locale, 'admin.copyLink')}
                    </button>
                    <button onClick={() => { setGeneratedToken(null); setTokenDialog(null); }}
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Close</button>
                  </div>
                </>
              ) : tokenDialog ? (
                <>
                  <h2 className="font-semibold text-gray-800 mb-4">{t(locale, 'admin.generateToken')}</h2>
                  <p className="text-sm text-gray-600 mb-4">{t(locale, 'admin.generateTokenDesc')}</p>
                  <button onClick={() => handleGenerateToken(tokenDialog.contractId)}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium">
                    {t(locale, 'admin.generate')}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">{t(locale, 'admin.contracts')}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t(locale, 'admin.contractsDesc')}</p>
          </div>
          {contracts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">{t(locale, 'admin.noContracts')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t(locale, 'admin.contract')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t(locale, 'admin.client')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t(locale, 'admin.vehicle')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t(locale, 'admin.status')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t(locale, 'admin.photos')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t(locale, 'admin.tokens')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t(locale, 'admin.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.contractNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{c.customerName}</div>
                        {c.customerEmail && <div className="text-xs text-gray-400">{c.customerEmail}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{c.vehicleModel}</div>
                        <div className="text-xs text-gray-400">{c.vehiclePlate}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={'inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + statusColor(c.status)}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.photosSubmitted}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {c.tokens.slice(0, 2).map((tk) => (
                            <div key={tk.id} className="flex items-center gap-1">
                              <span className={'w-1.5 h-1.5 rounded-full ' + (tk.usedAt ? 'bg-gray-300' : tk.isExpired ? 'bg-red-400' : 'bg-green-400')} />
                              <span className="text-xs text-gray-500">{tk.usedAt ? 'Used' : tk.isExpired ? 'Expired' : 'Active'}</span>
                            </div>
                          ))}
                          {c.tokens.length > 2 && <span className="text-xs text-gray-400">+{c.tokens.length - 2} more</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setTokenDialog({ contractId: c.id, contractNumber: c.contractNumber }); setGeneratedToken(null); }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          {t(locale, 'admin.generateToken')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
