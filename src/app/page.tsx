'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CarFront,
  Camera,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  KeyRound,
  ClipboardCopy,
  Plus,
  RefreshCw,
  User,
  CheckCheck,
  FileSpreadsheet,
  Download,
  Globe,
  FileUp,
  Car,
  ArrowLeft,
  ArrowRight,
  Gauge,
  Fuel,
  AlertTriangle,
  ImageIcon,
  ArrowRightToLine,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  Hash,
  FolderOpen,
  Link2,
  ClipboardCheck,
  Clock,
  BarChart3,
} from 'lucide-react'
import { t, LOCALES, type Locale } from '@/lib/i18n'

// ==================== TYPES ====================

interface PhotoChecklistItem {
  id: string; key: string; label: string; labelEn: string | null
  description: string | null; icon: string; required: boolean; completed: boolean; photoCount: number
}

interface ContractInfo {
  id: string; contractNumber: string; customerName: string
  vehiclePlate: string; vehicleModel: string; vehicleColor: string | null; status: string
}

interface BulkUploadResult {
  success: boolean
  summary: { total: number; created: number; skipped: number; errors: number }
  detectedColumns: string[]
  mappedColumns: Record<string, string>
  results: Array<{
    row: number; contractNumber: string; customerName: string
    vehiclePlate: string; vehicleModel: string
    status: 'created' | 'skipped' | 'error'
    token?: string; link?: string; error?: string
  }>
}

interface AdminContract {
  id: string; contractNumber: string; customerName: string
  customerEmail: string | null; customerPhone: string | null
  vehiclePlate: string; vehicleModel: string; vehicleColor: string | null
  status: string; createdAt: string; updatedAt: string
  tokens: Array<{ id: string; token: string; expiresAt: string; usedAt: string | null; isExpired: boolean }>
  photosSubmitted: number
}

const iconMap: Record<string, React.ElementType> = {
  CarFront, Car, ArrowLeft, ArrowRight,
}

type View = 'dashboard' | 'photo_checklist' | 'confirmation'

export default function Home() {
  const [locale, setLocale] = useState<Locale>('en')
  const [view, setView] = useState<View>('dashboard')
  const [token, setToken] = useState('')
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null)
  const [checklist, setChecklist] = useState<PhotoChecklistItem[]>([])
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [adminContracts, setAdminContracts] = useState<AdminContract[]>([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [showNewContractDialog, setShowNewContractDialog] = useState(false)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [newTokenLink, setNewTokenLink] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [expandedContract, setExpandedContract] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [newContract, setNewContract] = useState({
    contractNumber: '', customerName: '', customerEmail: '',
    customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '',
  })

  // Load locale + check for token in URL hash
  useEffect(() => {
    const saved = localStorage.getItem('hertz-locale') as Locale | null
    if (saved && LOCALES.some(l => l.code === saved)) setLocale(saved)
    const hash = window.location.hash
    if (hash && hash.startsWith('#token=')) {
      const urlToken = hash.replace('#token=', '')
      setToken(urlToken)
      doValidateToken(urlToken, saved || 'en')
    } else {
      // No token in URL → load admin dashboard data
      loadAdminContracts()
    }
  }, [])

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash
      if (hash && hash.startsWith('#token=')) {
        const urlToken = hash.replace('#token=', '')
        setToken(urlToken)
        doValidateToken(urlToken)
      }
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  useEffect(() => { if (error) { const tm = setTimeout(() => setError(null), 8000); return () => clearTimeout(tm) } }, [error])
  useEffect(() => { if (successMsg) { const tm = setTimeout(() => setSuccessMsg(null), 4000); return () => clearTimeout(tm) } }, [successMsg])

  const changeLocale = useCallback((l: Locale) => {
    setLocale(l)
    localStorage.setItem('hertz-locale', l)
    document.documentElement.lang = l
  }, [])

  const loadAdminContracts = useCallback(async () => {
    setAdminLoading(true)
    try {
      // Seed photo requirements (idempotent)
      try {
        await fetch('/api/admin/seed', { method: 'POST' })
      } catch {
        // Non-blocking: seed failure shouldn't prevent loading contracts
      }
      const res = await fetch('/api/admin/contracts')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Failed to load contracts (HTTP ${res.status})`)
        return
      }
      const data = await res.json()
      setAdminContracts(data.contracts || [])
    } catch (err) {
      console.error('loadAdminContracts error:', err)
      setError(t(locale, 'landing.connectionError'))
    } finally { setAdminLoading(false) }
  }, [locale])

  const doValidateToken = useCallback(async (tk: string, loc?: Locale) => {
    setValidating(true); setError(null)
    try {
      const res = await fetch('/api/token/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tk.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid token'); return }
      setContractInfo(data.contract)
      setChecklist(data.photoChecklist)
      setView('photo_checklist')
    } catch { setError(t(loc || locale, 'landing.connectionError')) }
    finally { setValidating(false) }
  }, [locale])

  const handlePhotoCapture = useCallback(async (requirement: PhotoChecklistItem) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setUploadingKey(requirement.key); setError(null)
      const formData = new FormData()
      formData.append('photo', file); formData.append('token', token); formData.append('requirementId', requirement.id)
      try {
        const res = await fetch('/api/photos/upload', { method: 'POST', body: formData })
        let data: Record<string, unknown>
        try {
          data = await res.json()
        } catch {
          setError(`Server error (HTTP ${res.status}). Riprova.`)
          return
        }
        if (!res.ok) { setError(String(data.error || `Upload failed (${res.status})`)); return }
        // Increment photo count for this requirement
        setChecklist(prev => prev.map(item =>
          item.key === requirement.key
            ? { ...item, completed: true, photoCount: item.photoCount + 1 }
            : item
        ))
        setSuccessMsg(`${requirement.label} — photo added`)
      } catch (err) {
        console.error('Photo upload error:', err)
        setError(t(locale, 'landing.connectionError'))
      }
      finally { setUploadingKey(null) }
    }
    input.click()
  }, [token, locale])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.missingPhotos ? `${t(locale, 'checklist.missingPhotos')}: ${data.missingPhotos.map((p: { label: string }) => p.label).join(', ')}` : data.error); return }
      setView('confirmation')
    } catch { setError(t(locale, 'landing.connectionError')) }
    finally { setSubmitting(false) }
  }, [token, locale])

  const handleCreateContract = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContract),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || `Failed to create contract (HTTP ${res.status})`); return }
      setNewTokenLink(data.accessToken?.link || null)
      setNewContract({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' })
      setShowNewContractDialog(false)
      loadAdminContracts()
    } catch (err) {
      console.error('Create contract error:', err)
      setError(t(locale, 'landing.connectionError'))
    }
  }, [newContract, loadAdminContracts, locale])

  const handleGenerateToken = useCallback(async (contractId: string) => {
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setNewTokenLink(data.accessToken?.link || null)
      setShowTokenDialog(false)
      loadAdminContracts()
    } catch { setError(t(locale, 'landing.connectionError')) }
  }, [loadAdminContracts, locale])

  const handleBulkUpload = useCallback(async (file: File) => {
    setBulkUploading(true); setBulkResult(null); setError(null)
    const formData = new FormData(); formData.append('file', file)
    try {
      const res = await fetch('/api/admin/bulk-upload', { method: 'POST', body: formData })
      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        setError(`Server returned non-JSON response (HTTP ${res.status}). The file may be too large or the server may have an internal error.`)
        return
      }
      if (!res.ok) { setError(String(data.error || `Upload failed (HTTP ${res.status})`)); return }
      setBulkResult(data as BulkUploadResult)
      loadAdminContracts()
    } catch (err) {
      console.error('Bulk upload error:', err)
      setError(t(locale, 'landing.connectionError'))
    }
    finally { setBulkUploading(false) }
  }, [loadAdminContracts, locale])

  const downloadTemplate = useCallback(() => {
    const csv = 'Rental,Customer,Vehicle,Model,Email,Phone,Fuel,Days\nRES-001,John Smith,ABC 123,Toyota Yaris,john@email.com,+356 9999 0001,8,7\nRES-002,Jane Doe,XYZ 789,Fiat 500,jane@email.com,+356 9999 0002,8,4'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'hertz_checkin_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }, [])

  const copyToClipboard = useCallback((text: string, id: string) => {
    const fullUrl = text.startsWith('http') ? text : `${window.location.origin}${text}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedToken(id)
    setTimeout(() => setCopiedToken(null), 2000)
  }, [])

  const completedCount = checklist.filter(c => c.completed).length
  const totalCount = checklist.length
  const allRequiredCompleted = checklist.filter(r => r.required).every(r => r.completed)
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const filteredContracts = adminContracts.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return c.contractNumber.toLowerCase().includes(q)
      || c.customerName.toLowerCase().includes(q)
      || c.vehiclePlate.toLowerCase().includes(q)
      || c.vehicleModel.toLowerCase().includes(q)
  })

  const pendingCount = adminContracts.filter(c => c.status === 'pending').length
  const inProgressCount = adminContracts.filter(c => c.status === 'in_progress').length
  const completedCount2 = adminContracts.filter(c => c.status === 'completed').length

  // ==================== PHOTO CHECKLIST (Customer View) ====================
  if (view === 'photo_checklist' && contractInfo) {
    // Zone config for the 2D car diagram
    const zoneStatus: Record<string, { completed: boolean; count: number }> = {}
    for (const item of checklist) {
      zoneStatus[item.key] = { completed: item.completed, count: item.photoCount }
    }

    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header — customer only, no admin links */}
        <header className="w-full bg-[#FFD100] shadow-md sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                  <CarFront className="w-5 h-5 text-[#FFD100]" />
                </div>
                <span className="font-bold text-black text-sm">Hertz Malta</span>
              </div>
              <Select value={locale} onValueChange={v => changeLocale(v as Locale)}>
                <SelectTrigger className="w-[100px] h-7 text-xs border-black/20 text-black/70 bg-white/80">
                  <Globe className="w-3 h-3 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {LOCALES.map(l => <SelectItem key={l.code} value={l.code} className="text-xs">{l.nativeName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between text-xs text-black/70 mt-2 mb-1">
              <span>{completedCount}/{totalCount} zones covered</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5 bg-black/10 [&>div]:bg-black" />
          </div>
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full p-4 space-y-4 pb-28">
          {/* Contract info */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-[10px]">Contract</span><p className="font-mono font-bold text-xs">{contractInfo.contractNumber}</p></div>
                <div><span className="text-muted-foreground text-[10px]">Customer</span><p className="font-semibold text-xs">{contractInfo.customerName}</p></div>
                <div><span className="text-muted-foreground text-[10px]">Vehicle</span><p className="font-semibold text-xs">{contractInfo.vehicleModel}</p></div>
                <div><span className="text-muted-foreground text-[10px]">Plate</span><p className="font-mono font-bold text-xs">{contractInfo.vehiclePlate}</p></div>
              </div>
            </CardContent>
          </Card>

          {error && <Alert variant="destructive"><XCircle className="w-4 h-4" /><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}
          {successMsg && <Alert className="border-green-200 bg-green-50 text-green-800"><CheckCircle2 className="w-4 h-4" /><AlertDescription className="text-xs">{successMsg}</AlertDescription></Alert>}

          {/* 2D Car Diagram */}
          <div className="flex justify-center">
            <svg viewBox="0 0 240 440" className="w-56 sm:w-64" xmlns="http://www.w3.org/2000/svg">
              {/* Shadow */}
              <ellipse cx="120" cy="225" rx="88" ry="190" fill="rgba(0,0,0,0.04)"/>
              {/* Car body */}
              <path d="M 80 38 Q 120 18 160 38 L 176 62 L 204 118 L 208 220 L 204 340 L 176 392 L 160 415 Q 120 435 80 415 L 64 392 L 36 340 L 32 220 L 36 118 L 64 62 Z"
                fill="#f0f0f0" stroke="#666" strokeWidth="2.5" strokeLinejoin="round"/>
              {/* Windshield */}
              <path d="M 85 66 L 155 66 L 170 96 L 70 96 Z" fill="#a8d4f0" stroke="#888" strokeWidth="0.8" opacity="0.7"/>
              {/* Rear window */}
              <path d="M 70 356 L 170 356 L 155 388 L 85 388 Z" fill="#a8d4f0" stroke="#888" strokeWidth="0.8" opacity="0.7"/>
              {/* Headlights */}
              <ellipse cx="82" cy="38" rx="10" ry="5" fill="#FFD100" stroke="#CCA800" strokeWidth="0.5"/>
              <ellipse cx="158" cy="38" rx="10" ry="5" fill="#FFD100" stroke="#CCA800" strokeWidth="0.5"/>
              {/* Tail lights */}
              <ellipse cx="82" cy="412" rx="9" ry="4" fill="#e53e3e" stroke="#c53030" strokeWidth="0.5"/>
              <ellipse cx="158" cy="412" rx="9" ry="4" fill="#e53e3e" stroke="#c53030" strokeWidth="0.5"/>
              {/* Wheels */}
              <rect x="20" y="128" width="20" height="42" rx="6" fill="#444" stroke="#333" strokeWidth="1"/>
              <rect x="200" y="128" width="20" height="42" rx="6" fill="#444" stroke="#333" strokeWidth="1"/>
              <rect x="20" y="270" width="20" height="42" rx="6" fill="#444" stroke="#333" strokeWidth="1"/>
              <rect x="200" y="270" width="20" height="42" rx="6" fill="#444" stroke="#333" strokeWidth="1"/>

              {/* === CLICKABLE ZONES === */}

              {/* FRONT zone */}
              <path
                d="M 80 38 Q 120 18 160 38 L 176 62 L 64 62 Z"
                fill={zoneStatus.front?.completed ? '#22c55e' : '#FFD100'}
                opacity="0.35"
                className="cursor-pointer transition-opacity hover:opacity-60"
                onClick={() => { const r = checklist.find(c => c.key === 'front'); if (r) handlePhotoCapture(r) }}
              />
              {/* Front label */}
              <text x="120" y="50" textAnchor="middle" className="text-[9px] font-bold fill-gray-700 pointer-events-none select-none">FRONT</text>
              {zoneStatus.front?.completed && <text x="120" y="60" textAnchor="middle" className="text-[8px] fill-green-700 font-semibold pointer-events-none select-none">{zoneStatus.front.count} photo{zoneStatus.front.count > 1 ? 's' : ''}</text>}

              {/* BACK zone */}
              <path
                d="M 64 392 L 176 392 L 160 415 Q 120 435 80 415 Z"
                fill={zoneStatus.back?.completed ? '#22c55e' : '#FFD100'}
                opacity="0.35"
                className="cursor-pointer transition-opacity hover:opacity-60"
                onClick={() => { const r = checklist.find(c => c.key === 'back'); if (r) handlePhotoCapture(r) }}
              />
              <text x="120" y="408" textAnchor="middle" className="text-[9px] font-bold fill-gray-700 pointer-events-none select-none">BACK</text>
              {zoneStatus.back?.completed && <text x="120" y="420" textAnchor="middle" className="text-[8px] fill-green-700 font-semibold pointer-events-none select-none">{zoneStatus.back.count} photo{zoneStatus.back.count > 1 ? 's' : ''}</text>}

              {/* PASSENGER SIDE zone (right) */}
              <path
                d="M 176 62 L 204 118 L 208 220 L 204 340 L 176 392 L 170 356 L 170 96 Z"
                fill={zoneStatus.passenger_side?.completed ? '#22c55e' : '#3b82f6'}
                opacity="0.2"
                className="cursor-pointer transition-opacity hover:opacity-45"
                onClick={() => { const r = checklist.find(c => c.key === 'passenger_side'); if (r) handlePhotoCapture(r) }}
              />
              <text x="192" y="225" textAnchor="middle" className="text-[7px] font-bold fill-gray-600 pointer-events-none select-none" transform="rotate(90 192 225)">PASSENGER</text>
              {zoneStatus.passenger_side?.completed && <text x="192" y="240" textAnchor="middle" className="text-[7px] fill-green-700 font-semibold pointer-events-none select-none" transform="rotate(90 192 240)">{zoneStatus.passenger_side.count} photo{zoneStatus.passenger_side.count > 1 ? 's' : ''}</text>}

              {/* DRIVER SIDE zone (left) */}
              <path
                d="M 64 62 L 36 118 L 32 220 L 36 340 L 64 392 L 70 356 L 70 96 Z"
                fill={zoneStatus.driver_side?.completed ? '#22c55e' : '#3b82f6'}
                opacity="0.2"
                className="cursor-pointer transition-opacity hover:opacity-45"
                onClick={() => { const r = checklist.find(c => c.key === 'driver_side'); if (r) handlePhotoCapture(r) }}
              />
              <text x="48" y="225" textAnchor="middle" className="text-[7px] font-bold fill-gray-600 pointer-events-none select-none" transform="rotate(-90 48 225)">DRIVER</text>
              {zoneStatus.driver_side?.completed && <text x="48" y="240" textAnchor="middle" className="text-[7px] fill-green-700 font-semibold pointer-events-none select-none" transform="rotate(-90 48 240)">{zoneStatus.driver_side.count} photo{zoneStatus.driver_side.count > 1 ? 's' : ''}</text>}

              {/* Zone status indicators */}
              {zoneStatus.front?.completed && <circle cx="120" cy="22" r="5" fill="#22c55e" stroke="white" strokeWidth="1.5"/>}
              {zoneStatus.back?.completed && <circle cx="120" cy="428" r="5" fill="#22c55e" stroke="white" strokeWidth="1.5"/>}
              {zoneStatus.passenger_side?.completed && <circle cx="214" cy="220" r="5" fill="#22c55e" stroke="white" strokeWidth="1.5"/>}
              {zoneStatus.driver_side?.completed && <circle cx="26" cy="220" r="5" fill="#22c55e" stroke="white" strokeWidth="1.5"/>}
            </svg>
          </div>

          {/* Photo zone cards — 2x2 grid */}
          <div className="grid grid-cols-2 gap-3">
            {checklist.map(item => {
              const IconComp = iconMap[item.icon] || Camera
              const isUploading = uploadingKey === item.key
              const zoneColor = (item.key === 'front' || item.key === 'back') ? 'bg-[#FFD100]/15' : 'bg-blue-50'
              return (
                <Card key={item.id} className={`border-0 shadow-sm ${item.completed ? 'bg-green-50 ring-2 ring-green-300' : `${zoneColor} ring-1 ring-black/5`}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.completed ? 'bg-green-200 text-green-700' : 'bg-white text-black'}`}>
                          {item.completed ? <CheckCircle2 className="w-4 h-4" /> : <IconComp className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="font-bold text-xs">{item.label}</span>
                          {item.photoCount > 0 && (
                            <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 text-green-700 border-green-300 bg-green-50">{item.photoCount}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={item.completed ? 'outline' : 'default'}
                      className={`w-full h-9 text-xs ${item.completed ? 'border-green-300 text-green-700 hover:bg-green-100' : 'bg-black hover:bg-black/90 text-[#FFD100]'}`}
                      onClick={() => handlePhotoCapture(item)}
                      disabled={isUploading}
                    >
                      {isUploading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Uploading...</> : item.completed ? <><Plus className="w-3 h-3 mr-1" />Add another photo</> : <><Camera className="w-3 h-3 mr-1" />Take photo</>}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </main>

        {/* Submit bar */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/90 backdrop-blur-sm border-t z-10">
          <div className="max-w-lg mx-auto">
            <Button
              className="w-full h-12 text-base font-bold shadow-xl rounded-xl bg-black hover:bg-black/90 text-[#FFD100] disabled:opacity-40"
              disabled={!allRequiredCompleted || submitting}
              onClick={handleSubmit}
            >
              {submitting
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Submitting...</>
                : !allRequiredCompleted
                  ? <><Camera className="w-5 h-5 mr-2" />{completedCount}/{totalCount} zones covered</>
                  : <><Upload className="w-5 h-5 mr-2" />Submit Check-in</>
              }
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ==================== CONFIRMATION (Customer View — Token Expired) ====================
  if (view === 'confirmation' && contractInfo) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="w-full bg-green-600 text-white shadow-md">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <CheckCheck className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-bold">Check-in Complete</h1>
              <p className="text-green-100 text-xs">Vehicle photo inspection submitted successfully</p>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-green-800">Thank you, {contractInfo.customerName}!</h2>
              <p className="text-sm text-muted-foreground">Your vehicle photo check-in has been submitted successfully. The Hertz staff has been notified and will review the photos.</p>
              <div className="bg-gray-50 rounded-lg p-3 text-left text-sm space-y-1.5 border">
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">Contract</span><span className="font-mono font-semibold text-xs">{contractInfo.contractNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">Vehicle</span><span className="font-semibold text-xs">{contractInfo.vehicleModel}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">Plate</span><span className="font-mono font-bold text-xs">{contractInfo.vehiclePlate}</span></div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-red-500" />
                  <span className="font-semibold text-sm text-red-700">Link Expired</span>
                </div>
                <p className="text-[11px] text-red-600">This token has been used and can no longer be accessed. Please contact Hertz staff if you need assistance.</p>
              </div>
            </CardContent>
          </Card>
        </main>
        <footer className="py-3 text-center text-[10px] text-muted-foreground">
          Hertz Malta &copy; {new Date().getFullYear()}
        </footer>
      </div>
    )
  }

  // ==================== ADMIN DASHBOARD (Main View — Desktop-first) ====================
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ── Header ── */}
      <header className="w-full bg-[#FFD100] shadow-md sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                <CarFront className="w-6 h-6 text-[#FFD100]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-black leading-tight">Hertz Malta</h1>
                <p className="text-xs text-black/60 font-medium">{t(locale, 'admin.title')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Quick Token Access — desktop only */}
              <div className="hidden md:flex items-center gap-2">
                <Input
                  placeholder="Enter token code..."
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doValidateToken(token)}
                  className="w-48 h-8 text-xs font-mono bg-white/80 border-black/10"
                />
                <Button onClick={() => doValidateToken(token)} disabled={validating || !token.trim()} className="h-8 bg-black hover:bg-black/90 text-[#FFD100] px-3" size="sm">
                  {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightToLine className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <Select value={locale} onValueChange={v => changeLocale(v as Locale)}>
                <SelectTrigger className="w-[110px] h-8 text-xs border-black/15 text-black/70 bg-white/80">
                  <Globe className="w-3.5 h-3.5 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {LOCALES.map(l => <SelectItem key={l.code} value={l.code} className="text-xs">{l.nativeName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full p-4 sm:p-6">
        {error && <Alert variant="destructive" className="mb-4"><XCircle className="w-4 h-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {successMsg && <Alert className="border-green-200 bg-green-50 text-green-800 mb-4"><CheckCircle2 className="w-4 h-4" /><AlertDescription>{successMsg}</AlertDescription></Alert>}

        {/* ── Desktop: Two-column layout | Mobile: Stacked ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* ========== LEFT SIDEBAR ========== */}
          <div className="space-y-4 order-2 lg:order-1">
            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-2">
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-3 text-center">
                  <p className="text-3xl font-bold text-gray-900">{adminContracts.length}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">Total</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-3 text-center">
                  <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{t(locale, 'admin.pending')}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-3 text-center">
                  <p className="text-3xl font-bold text-blue-600">{inProgressCount}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{t(locale, 'admin.inProgress')}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-3 text-center">
                  <p className="text-3xl font-bold text-green-600">{completedCount2}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{t(locale, 'admin.completed')}</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Bulk Upload ── */}
            <Card className="border-0 shadow-sm bg-white ring-1 ring-[#FFD100]/30">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#FFD100]" />
                  {t(locale, 'admin.bulkUpload')}
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Upload checkout report to generate tokens
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${dragOver ? 'border-[#FFD100] bg-yellow-50' : 'border-gray-200 hover:border-[#FFD100]/50'}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleBulkUpload(f) }}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'; input.accept = '.xlsx,.xls,.csv'
                    input.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleBulkUpload(f) }
                    input.click()
                  }}
                >
                  {bulkUploading ? (
                    <div className="space-y-1"><Loader2 className="w-7 h-7 mx-auto text-[#FFD100] animate-spin" /><p className="text-xs text-muted-foreground">{t(locale, 'admin.processing')}</p></div>
                  ) : (
                    <div className="space-y-1"><FileUp className="w-7 h-7 mx-auto text-gray-300" /><p className="text-xs text-muted-foreground">{t(locale, 'admin.dragDrop')}</p><p className="text-[10px] text-muted-foreground">{t(locale, 'admin.supportedFormats')}</p></div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Rental *</Badge>
                  <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Customer *</Badge>
                  <Badge variant="outline" className="text-[9px] bg-gray-50 text-gray-600 border-gray-200">Vehicle</Badge>
                  <Badge variant="outline" className="text-[9px] bg-gray-50 text-gray-600 border-gray-200">Model</Badge>
                </div>

                <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs h-7 w-full">
                  <Download className="w-3 h-3 mr-1" />{t(locale, 'admin.downloadTemplate')}
                </Button>

                {/* Bulk results */}
                {bulkResult && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                      <p className="font-semibold text-green-800 text-xs mb-1">{t(locale, 'admin.uploadSuccess')}</p>
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-700">{bulkResult.summary.created} {t(locale, 'admin.created')}</span>
                        <span className="text-amber-700">{bulkResult.summary.skipped} {t(locale, 'admin.skipped')}</span>
                        {bulkResult.summary.errors > 0 && <span className="text-red-700">{bulkResult.summary.errors} {t(locale, 'admin.errors')}</span>}
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] h-7">{t(locale, 'admin.contract')}</TableHead>
                            <TableHead className="text-[10px]">{t(locale, 'admin.client')}</TableHead>
                            <TableHead className="text-[10px]">{t(locale, 'admin.tokenLink')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkResult.results.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs py-1">{r.contractNumber}</TableCell>
                              <TableCell className="text-xs py-1 max-w-[80px] truncate">{r.customerName}</TableCell>
                              <TableCell className="py-1">
                                {r.link ? (
                                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => copyToClipboard(r.link!, r.token || '')}>
                                    {copiedToken === r.token ? <CheckCircle2 className="w-3 h-3 text-green-600 mr-0.5" /> : <ClipboardCopy className="w-3 h-3 mr-0.5" />}
                                    {copiedToken === r.token ? t(locale, 'admin.copied') : t(locale, 'admin.copyLink')}
                                  </Button>
                                ) : <span className="text-[10px] text-red-500">{r.error}</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Quick Token Access — mobile only ── */}
            <Card className="border-0 shadow-sm bg-white md:hidden">
              <CardContent className="p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ArrowRightToLine className="w-3.5 h-3.5" />Quick Token Access
                </p>
                <div className="flex gap-2">
                  <Input placeholder="Enter token code..." value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && doValidateToken(token)} className="flex-1 font-mono text-sm h-9" />
                  <Button onClick={() => doValidateToken(token)} disabled={validating || !token.trim()} className="bg-black hover:bg-black/90 text-[#FFD100] px-4 h-9">
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightToLine className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========== RIGHT: CONTRACTS TABLE ========== */}
          <div className="space-y-4 order-1 lg:order-2">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by contract, name, plate, model..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-white border-0 shadow-sm"
                />
              </div>
              <Button onClick={() => setShowNewContractDialog(true)} className="bg-black hover:bg-black/90 text-[#FFD100] font-semibold h-9 rounded-lg shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">{t(locale, 'admin.newContract')}</span><span className="sm:hidden">New</span>
              </Button>
              <Button variant="outline" onClick={loadAdminContracts} disabled={adminLoading} className="h-9 w-9 rounded-lg border-gray-200 p-0">
                <RefreshCw className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* ── Contracts ── */}
            {adminContracts.length === 0 && !adminLoading ? (
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <FolderOpen className="w-14 h-14 mx-auto mb-3 opacity-15" />
                  <p className="text-base font-medium">{t(locale, 'admin.noContracts')}</p>
                  <p className="text-sm mt-1 text-muted-foreground/70">Create a new contract or upload a checkout report to get started</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                        <TableHead className="text-xs font-semibold h-9">Contract</TableHead>
                        <TableHead className="text-xs font-semibold">Customer</TableHead>
                        <TableHead className="text-xs font-semibold hidden sm:table-cell">Vehicle</TableHead>
                        <TableHead className="text-xs font-semibold hidden md:table-cell">Plate</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Photos</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                        <TableHead className="text-xs font-semibold hidden lg:table-cell">Tokens</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContracts.map(contract => {
                        const activeToken = contract.tokens.find(tk => !tk.usedAt && !tk.isExpired)
                        const isExpanded = expandedContract === contract.id
                        return (
                          <React.Fragment key={contract.id}>
                            <TableRow className="group hover:bg-gray-50/50">
                              <TableCell className="font-mono font-bold text-sm py-2.5">
                                {contract.contractNumber}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <div>
                                  <p className="font-medium text-sm">{contract.customerName}</p>
                                  {contract.customerEmail && <p className="text-[10px] text-muted-foreground hidden xl:block">{contract.customerEmail}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm py-2.5 hidden sm:table-cell">{contract.vehicleModel}</TableCell>
                              <TableCell className="font-mono text-sm py-2.5 hidden md:table-cell">{contract.vehiclePlate}</TableCell>
                              <TableCell className="text-center py-2.5">
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {contract.photosSubmitted}/7
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center py-2.5">
                                <Badge className={`text-[10px] px-2 py-0.5 ${contract.status === 'completed' ? 'bg-green-100 text-green-800' : contract.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {contract.status === 'completed' ? t(locale, 'admin.completed') : contract.status === 'in_progress' ? t(locale, 'admin.inProgress') : t(locale, 'admin.pending')}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5 hidden lg:table-cell">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium">{contract.tokens.length}</span>
                                  {activeToken && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200">active</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {activeToken && (
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5 text-blue-600 hover:text-blue-800" onClick={() => copyToClipboard(`/#token=${activeToken.token}`, activeToken.token)}>
                                      {copiedToken === activeToken.token ? <CheckCircle2 className="w-3 h-3 mr-0.5" /> : <Link2 className="w-3 h-3 mr-0.5" />}
                                      <span className="hidden xl:inline">{copiedToken === activeToken.token ? t(locale, 'admin.copied') : 'Link'}</span>
                                    </Button>
                                  )}
                                  {contract.status !== 'completed' && (
                                    <Button size="sm" className="h-7 text-[10px] px-2 bg-[#FFD100] hover:bg-[#E6BC00] text-black border-0 shadow-none" onClick={() => { setSelectedContractId(contract.id); setShowTokenDialog(true) }}>
                                      <KeyRound className="w-3 h-3 mr-0.5" />Token
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpandedContract(isExpanded ? null : contract.id)}>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {/* Expanded token details */}
                            {isExpanded && (
                              <TableRow className="bg-gray-50/50">
                                <TableCell colSpan={8} className="p-0">
                                  <div className="px-4 py-3 space-y-1.5">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Access Tokens</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {contract.tokens.map(tk => (
                                        <div key={tk.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                                          <code className="text-[11px] font-mono text-gray-600 flex-1 truncate">
                                            {tk.token.substring(0, 8)}...{tk.token.substring(tk.token.length - 4)}
                                          </code>
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToClipboard(`/#token=${tk.token}`, tk.token)}>
                                            {copiedToken === tk.token ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <ClipboardCopy className="w-3 h-3 text-gray-400" />}
                                          </Button>
                                          <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${tk.usedAt ? 'bg-red-50 text-red-600' : tk.isExpired ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'}`}>
                                            {tk.usedAt ? 'Used' : tk.isExpired ? 'Expired' : 'Active'}
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Mobile-only extra info */}
                                    <div className="sm:hidden mt-2 text-xs text-muted-foreground">
                                      {contract.vehicleModel} &bull; {contract.vehiclePlate}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {adminLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[#FFD100]" />
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* ── New Contract Dialog ── */}
      <Dialog open={showNewContractDialog} onOpenChange={setShowNewContractDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t(locale, 'admin.newContractTitle')}</DialogTitle>
            <DialogDescription className="text-xs">{t(locale, 'admin.newContractDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t(locale, 'admin.contractNumber')} *</Label>
                <Input className="h-9 text-sm" placeholder="RES-69714" value={newContract.contractNumber} onChange={e => setNewContract(p => ({ ...p, contractNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t(locale, 'admin.customerName')} *</Label>
                <Input className="h-9 text-sm" placeholder="Full Name" value={newContract.customerName} onChange={e => setNewContract(p => ({ ...p, customerName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t(locale, 'admin.vehiclePlate')}</Label>
                <Input className="h-9 text-sm" placeholder="SQZ138" value={newContract.vehiclePlate} onChange={e => setNewContract(p => ({ ...p, vehiclePlate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t(locale, 'admin.vehicleModel')}</Label>
                <Input className="h-9 text-sm" placeholder="Picanto" value={newContract.vehicleModel} onChange={e => setNewContract(p => ({ ...p, vehicleModel: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t(locale, 'admin.customerEmail')}</Label>
                <Input type="email" className="h-9 text-sm" placeholder="email@example.com" value={newContract.customerEmail} onChange={e => setNewContract(p => ({ ...p, customerEmail: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t(locale, 'admin.customerPhone')}</Label>
                <Input className="h-9 text-sm" placeholder="+356 9999 0000" value={newContract.customerPhone} onChange={e => setNewContract(p => ({ ...p, customerPhone: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full bg-black hover:bg-black/90 text-[#FFD100] font-semibold h-10 rounded-lg" onClick={handleCreateContract} disabled={!newContract.contractNumber || !newContract.customerName}>
              <Plus className="w-4 h-4 mr-2" />{t(locale, 'admin.createAndGenerate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Generate Token Dialog ── */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t(locale, 'admin.generateToken')}</DialogTitle>
            <DialogDescription className="text-xs">{t(locale, 'admin.generateTokenDesc')}</DialogDescription>
          </DialogHeader>
          <Button className="w-full bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold h-10 rounded-lg" onClick={() => { if (selectedContractId) handleGenerateToken(selectedContractId) }}>
            <KeyRound className="w-4 h-4 mr-2" />{t(locale, 'admin.generate')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Token Link Dialog ── */}
      <Dialog open={!!newTokenLink} onOpenChange={() => setNewTokenLink(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {t(locale, 'admin.linkGenerated')}
            </DialogTitle>
            <DialogDescription className="text-xs">{t(locale, 'admin.linkGeneratedDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs break-all border">
              {typeof window !== 'undefined' ? `${window.location.origin}${newTokenLink}` : newTokenLink}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 bg-black hover:bg-black/90 text-[#FFD100] h-10 rounded-lg" onClick={() => { copyToClipboard(newTokenLink!, newTokenLink!); }}>
                {copiedToken === newTokenLink ? <><CheckCircle2 className="w-4 h-4 mr-2" />{t(locale, 'admin.copied')}</> : <><ClipboardCopy className="w-4 h-4 mr-2" />{t(locale, 'admin.copyLink')}</>}
              </Button>
              {newTokenLink && (
                <Button variant="outline" className="h-10 rounded-lg" onClick={() => { window.open(newTokenLink, '_blank') }}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Footer ── */}
      <footer className="w-full bg-black/5 py-3 text-center text-[10px] text-muted-foreground mt-auto">
        Hertz Malta &copy; {new Date().getFullYear()} &mdash; Vehicle Photo Check-in Portal
      </footer>
    </div>
  )
}
