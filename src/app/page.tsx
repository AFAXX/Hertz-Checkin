'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ──────────────────── TYPES ──────────────────── */
interface PhotoRequirement {
  id: string;
  name: string;
  description: string;
  requiredPhotos: number;
}

interface RentalContract {
  id: string;
  contractNumber: string;
  customerName: string;
  vehicleModel: string;
  licensePlate: string;
  status: string;
}

interface TokenData {
  rentalContract: RentalContract;
  photoRequirements: PhotoRequirement[];
}

/* ──────────────────── CONSTANTS ──────────────────── */
const PHOTO_CATEGORIES = [
  { key: 'front',          label: 'Front' },
  { key: 'passenger_side', label: 'Passenger Side' },
  { key: 'driver_side',    label: 'Driver Side' },
  { key: 'back',           label: 'Back' },
];

const API_BASE = '';

/* ──────────────────── SVG CAR DIAGRAM ──────────────────── */
function CarDiagram({ activeCategory, onSelect, completedCategories, photoCounts }: {
  activeCategory: string | null;
  onSelect: (key: string) => void;
  completedCategories: Set<string>;
  photoCounts: Record<string, number>;
}) {
  const zones = [
    { key: 'front',          cx: 200, cy: 40,  rx: 70, ry: 18 },
    { key: 'passenger_side', cx: 60,  cy: 140, rx: 18, ry: 55 },
    { key: 'driver_side',    cx: 340, cy: 140, rx: 18, ry: 55 },
    { key: 'back',           cx: 200, cy: 240, rx: 70, ry: 18 },
  ];

  return (
    <svg viewBox="0 0 400 280" className="w-full max-w-md mx-auto" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))' }}>
      <rect x="75" y="45" width="250" height="190" rx="50" fill="#e2e8f0" />
      <rect x="72" y="42" width="256" height="190" rx="52" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M 120 65 Q 200 45 280 65 L 270 85 Q 200 72 130 85 Z" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5" />
      <path d="M 125 210 Q 200 228 275 210 L 270 195 Q 200 208 130 195 Z" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5" />
      <rect x="95" y="90" width="18" height="70" rx="5" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1" />
      <rect x="287" y="90" width="18" height="70" rx="5" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1" />
      <circle cx="120" cy="58" r="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="280" cy="58" r="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="125" cy="218" r="7" fill="#fca5a5" stroke="#ef4444" strokeWidth="1.5" />
      <circle cx="275" cy="218" r="7" fill="#fca5a5" stroke="#ef4444" strokeWidth="1.5" />
      <ellipse cx="120" cy="245" rx="22" ry="10" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="120" cy="245" rx="10" ry="5" fill="#64748b" />
      <ellipse cx="280" cy="245" rx="22" ry="10" fill="#334155" stroke="#1e293b" strokeWidth="2" />
      <ellipse cx="280" cy="245" rx="10" ry="5" fill="#64748b" />

      {zones.map(zone => {
        const isActive = activeCategory === zone.key;
        const isCompleted = completedCategories.has(zone.key);
        const count = photoCounts[zone.key] || 0;

        return (
          <g key={zone.key} onClick={() => onSelect(zone.key)} style={{ cursor: 'pointer' }}>
            <ellipse
              cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry}
              fill={isActive ? 'rgba(59,130,246,0.25)' : isCompleted ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.1)'}
              stroke={isActive ? '#3b82f6' : isCompleted ? '#22c55e' : '#94a3b8'}
              strokeWidth={isActive ? 3 : 2}
              strokeDasharray={isCompleted ? 'none' : isActive ? 'none' : '6 3'}
            />
            {count > 0 && (
              <>
                <circle cx={zone.cx + zone.rx - 10} cy={zone.cy - zone.ry + 10} r="11" fill={isCompleted ? '#22c55e' : '#3b82f6'} />
                <text x={zone.cx + zone.rx - 10} y={zone.cy - zone.ry + 14} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{count}</text>
              </>
            )}
            {isCompleted && (
              <text x={zone.cx} y={zone.cy + 4} textAnchor="middle" fill="#22c55e" fontSize="16">&#x2713;</text>
            )}
          </g>
        );
      })}

      <text x="200" y="16" textAnchor="middle" fill="#475569" fontSize="11" fontWeight="600">FRONT</text>
      <text x="20" y="144" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="600" transform="rotate(-90, 20, 144)">PASSENGER</text>
      <text x="380" y="144" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="600" transform="rotate(90, 380, 144)">DRIVER</text>
      <text x="200" y="274" textAnchor="middle" fill="#475569" fontSize="11" fontWeight="600">BACK</text>
    </svg>
  );
}

/* ──────────────────── MAIN PAGE ──────────────────── */
export default function Home() {
  const [mode, setMode] = useState<'loading' | 'admin' | 'customer' | 'completed'>('loading');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  /* Admin State */
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ customerName: '', vehicleModel: '', licensePlate: '', contractNumber: '' });
  const [uploading, setUploading] = useState(false);

  /* Customer State */
  const [contractData, setContractData] = useState<TokenData | null>(null);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      const t = hash.replace('#token=', '');
      setToken(t);
      setMode('customer');
      validateAndLoad(t);
    } else {
      setMode('admin');
      loadAdminContracts();
    }
  }, []);

  /* ──────────── CUSTOMER ──────────── */

  const validateAndLoad = async (t: string) => {
    try {
      setError('');
      const res = await fetch(`${API_BASE}/api/token/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid token');
      setContractData(data);

      const subRes = await fetch(`${API_BASE}/api/token/submissions?token=${t}`);
      if (subRes.ok) {
        const subData = await subRes.json();
        const grouped: Record<string, string[]> = {};
        (subData.submissions || []).forEach((s: { photoRequirementId: string; photoUrl: string }) => {
          if (!grouped[s.photoRequirementId]) grouped[s.photoRequirementId] = [];
          grouped[s.photoRequirementId].push(s.photoUrl);
        });
        setPhotos(grouped);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to validate token';
      setError(msg);
      if (msg.includes('expired') || msg.includes('used')) {
        setMode('completed');
      }
    }
  };

  const handleCategorySelect = (key: string) => {
    setActiveCategory(key);
    setError('');
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeCategory || !contractData) return;

    const cat = PHOTO_CATEGORIES.find(c => c.key === activeCategory);
    if (!cat) return;

    const requirement = contractData.photoRequirements?.find(
      (r: PhotoRequirement) => r.name.toLowerCase().includes(cat.key.replace('_', ' '))
    );
    const requirementId = requirement?.id || cat.key;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('token', token);
        formData.append('photo', file);
        formData.append('requirementId', requirementId);

        const res = await fetch(`${API_BASE}/api/photos/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        setPhotos(prev => ({
          ...prev,
          [activeCategory]: [...(prev[activeCategory] || []), data.submission.photoUrl],
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to upload photo';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const completedCategories = new Set(
    PHOTO_CATEGORIES.filter(c => (photos[c.key]?.length || 0) > 0).map(c => c.key)
  );
  const allCategoriesCompleted = PHOTO_CATEGORIES.every(c => (photos[c.key]?.length || 0) > 0);

  const handleSubmit = async () => {
    if (!allCategoriesCompleted || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setMode('completed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ──────────── ADMIN ──────────── */

  const loadAdminContracts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/contracts`);
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
      const res = await fetch(`${API_BASE}/api/admin/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create contract');
      setShowCreate(false);
      setCreateForm({ customerName: '', vehicleModel: '', licensePlate: '', contractNumber: '' });
      loadAdminContracts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed';
      alert('Error: ' + msg);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/admin/bulk-upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      alert('Imported ' + (data.imported || 0) + ' contracts');
      loadAdminContracts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      alert('Error: ' + msg);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  /* ──────────── RENDER: LOADING ──────────── */
  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  /* ──────────── RENDER: COMPLETED / EXPIRED ──────────── */
  if (mode === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check-in Completato</h1>
          <p className="text-gray-600 mb-1">Vehicle Inspection Submitted</p>
          <p className="text-gray-400 text-sm mt-4">Il token e stato utilizzato e non puo essere riutilizzato.</p>
          <p className="text-gray-400 text-sm">This token has been used and cannot be reused.</p>
          {error && (error.includes('expired') || error.includes('scaduto')) && (
            <p className="text-amber-600 text-sm mt-3">Questo token e scaduto. / This token has expired.</p>
          )}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl">
            <p className="text-gray-500 text-xs">Grazie per aver scelto Hertz Malta</p>
            <p className="text-gray-400 text-xs">Thank you for choosing Hertz Malta</p>
          </div>
        </div>
      </div>
    );
  }

  /* ──────────── RENDER: CUSTOMER ──────────── */
  if (mode === 'customer') {
    return (
      <div className="min-h-screen bg-gray-50">
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFileChange} className="hidden" />

        <div className="bg-white shadow-sm border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">Hertz Malta</h1>
                <p className="text-xs text-gray-500">Vehicle Check-in</p>
              </div>
              {contractData && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Contratto</p>
                  <p className="text-sm font-semibold text-gray-800">{contractData.rentalContract.contractNumber}</p>
                </div>
              )}
            </div>
            {contractData && (
              <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-600 text-xs">Cliente / Customer</span>
                    <p className="font-medium text-gray-800">{contractData.rentalContract.customerName}</p>
                  </div>
                  <div>
                    <span className="text-blue-600 text-xs">Veicolo / Vehicle</span>
                    <p className="font-medium text-gray-800">{contractData.rentalContract.vehicleModel}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Targa / Plate: <span className="font-medium text-gray-700">{contractData.rentalContract.licensePlate}</span></p>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {error && !error.includes('expired') && !error.includes('used') && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 text-center">Tocca una zona per scattare la foto / Tap a zone to take photo</h2>
            <CarDiagram
              activeCategory={activeCategory}
              onSelect={handleCategorySelect}
              completedCategories={completedCategories}
              photoCounts={Object.fromEntries(PHOTO_CATEGORIES.map(c => [c.key, photos[c.key]?.length || 0]))}
            />
          </div>

          <div className="space-y-3">
            {PHOTO_CATEGORIES.map(cat => {
              const catPhotos = photos[cat.key] || [];
              const isDone = catPhotos.length > 0;
              return (
                <div key={cat.key} onClick={() => handleCategorySelect(cat.key)} className={'bg-white rounded-xl p-4 border-2 cursor-pointer transition-all active:scale-[0.98] ' + (isDone ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={'w-10 h-10 rounded-full flex items-center justify-center text-lg ' + (isDone ? 'bg-green-200' : 'bg-gray-100')}>
                        {isDone ? '\u2713' : '\uD83D\uDCF7'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{cat.label}</p>
                        <p className="text-xs text-gray-500">{catPhotos.length} photo{catPhotos.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className={'px-3 py-1 rounded-full text-xs font-medium ' + (isDone ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500')}>
                      {isDone ? 'Done' : 'Tap to start'}
                    </div>
                  </div>
                  {catPhotos.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {catPhotos.map((url, idx) => (
                        <div key={idx} className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-300">
                          <img src={url} alt={cat.label + ' ' + (idx + 1)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                      ))}
                      <div onClick={(e) => { e.stopPropagation(); handleCategorySelect(cat.key); }} className="w-16 h-16 rounded-lg bg-blue-50 border-2 border-dashed border-blue-300 flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-blue-100">
                        <span className="text-blue-500 text-xl">+</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="text-sm text-gray-600">Uploading...</span>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-500">{completedCategories.size}/{PHOTO_CATEGORIES.length} angles</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: (completedCategories.size / PHOTO_CATEGORIES.length) * 100 + '%' }} />
            </div>
          </div>

          {allCategoriesCompleted && (
            <button onClick={handleSubmit} disabled={isSubmitting} className={'w-full py-4 rounded-xl text-white font-bold text-lg transition-all ' + (isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-[0.98] shadow-lg shadow-green-200')}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Submitting...
                </span>
              ) : (
                '\u2713 Complete Check-in'
              )}
            </button>
          )}

          {!allCategoriesCompleted && (
            <p className="text-center text-sm text-gray-400">Scatta almeno una foto per ogni angolazione per completare il check-in</p>
          )}
        </div>
      </div>
    );
  }

  /* ──────────── RENDER: ADMIN ──────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hertz Malta - Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Vehicle Check-in Management</p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-2">
              {uploading ? 'Uploading...' : 'Import Excel'}
              <input type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" disabled={uploading} />
            </label>
            <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">+ New Contract</button>
          </div>
        </div>

        {showCreate && (
          <form onSubmit={handleCreateContract} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">New Rental Contract</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Contract Number</label>
                <input type="text" value={createForm.contractNumber} onChange={e => setCreateForm(f => ({ ...f, contractNumber: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Customer Name</label>
                <input type="text" value={createForm.customerName} onChange={e => setCreateForm(f => ({ ...f, customerName: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Vehicle Model</label>
                <input type="text" value={createForm.vehicleModel} onChange={e => setCreateForm(f => ({ ...f, vehicleModel: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">License Plate</label>
                <input type="text" value={createForm.licensePlate} onChange={e => setCreateForm(f => ({ ...f, licensePlate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">Create and Generate Token</button>
              <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Daily View - Contracts</h2>
          </div>
          {contracts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No contracts found. Create one or import an Excel file.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Contract</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Plate</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-800">{c.contractNumber}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{c.customerName}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{c.vehicleModel}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{c.licensePlate}</td>
                      <td className="px-6 py-3">
                        <span className={'inline-flex px-2.5 py-1 rounded-full text-xs font-medium ' + (c.status === 'completed' ? 'bg-green-100 text-green-800' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600')}>
                          {c.status}
                        </span>
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
}1
