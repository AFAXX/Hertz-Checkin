'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
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
  Clock,
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
  ShieldCheck,
  ImageIcon,
  ArrowRightToLine,
  Settings,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import { t, LOCALES, type Locale } from '@/lib/i18n'

// ==================== TYPES ====================

interface PhotoChecklistItem {
  id: string; key: string; label: string; labelEn: string | null
  description: string | null; icon: string; required: boolean; completed: boolean
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
  CarFront, Car, ArrowLeft, ArrowRight, Gauge, Fuel, AlertTriangle,
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
  const [showTokenInput, setShowTokenInput] = useState(false)

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
    }
    loadAdminContracts()
  }, [])

  useEffect(() => { if (error) { const t = setTimeout(() => setError(null), 8000); return () => clearTimeout(t) } }, [error])
  useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(null), 3000); return () => clearTimeout(t) } }, [successMsg])

  const changeLocale = useCallback((l: Locale) => {
    setLocale(l)
    localStorage.setItem('hertz-locale', l)
    document.title = `Hertz Malta — ${t(l, 'app.title')}`
    document.documentElement.lang = l
  }, [])

  const loadAdminContracts = useCallback(async () => {
    setAdminLoading(true)
    try {
      await fetch('/api/admin/seed', { method: 'POST' })
      const res = await fetch('/api/admin/contracts')
      const data = await res.json()
      if (res.ok) setAdminContracts(data.contracts)
    } catch { } finally { setAdminLoading(false) }
  }, [])

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
        const data = await res.json()
        if (!res.ok) { setError(data.error); return }
        setChecklist(prev => prev.map(item => item.key === requirement.key ? { ...item, completed: true } : item))
        setSuccessMsg(t(locale, 'checklist.photoSuccess'))
      } catch { setError(t(locale, 'landing.connectionError')) }
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
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContract),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setNewTokenLink(data.accessToken?.link || null)
      setNewContract({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' })
      setShowNewContractDialog(false)
      loadAdminContracts()
    } catch { setError(t(locale, 'landing.connectionError')) }
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
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setBulkResult(data)
      loadAdminContracts()
    } catch { setError(t(locale, 'landing.connectionError')) }
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

  // ==================== PHOTO CHECKLIST ====================
  if (view === 'photo_checklist' && contractInfo) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="w-full bg-[#FFD100] shadow-md sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                  <CarFront className="w-5 h-5 text-[#FFD100]" />
                </div>
                <span className="font-bold text-black text-sm">Hertz Malta</span>
              </div>
              <Select value={locale} onValueChange={v => changeLocale(v as Locale)}>
                <SelectTrigger className="w-[110px] h-7 text-xs border-black/20 text-black/70 bg-white/80">
                  <Globe className="w-3 h-3 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {LOCALES.map(l => <SelectItem key={l.code} value={l.code} className="text-xs">{l.nativeName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between text-xs text-black/70 mb-1">
              <span>{completedCount}/{totalCount} {t(locale, 'checklist.photosCompleted')}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-black/10 [&>div]:bg-black" />
          </div>
        </header>
        <main className="flex-1 max-w-lg mx-auto w-full p-4 space-y-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">{t(locale, 'checklist.customer')}</span><p className="font-semibold">{contractInfo.customerName}</p></div>
                <div><span className="text-muted-foreground text-xs">{t(locale, 'checklist.vehicle')}</span><p className="font-semibold">{contractInfo.vehicleModel}</p></div>
                <div><span className="text-muted-foreground text-xs">{t(locale, 'checklist.plate')}</span><p className="font-semibold font-mono">{contractInfo.vehiclePlate}</p></div>
                {contractInfo.vehicleColor && <div><span className="text-muted-foreground text-xs">{t(locale, 'checklist.color')}</span><p className="font-semibold">{contractInfo.vehicleColor}</p></div>}
              </div>
            </CardContent>
          </Card>
          {error && <Alert variant="destructive"><XCircle className="w-4 h-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          {successMsg && <Alert className="border-green-200 bg-green-50 text-green-800"><CheckCircle2 className="w-4 h-4" /><AlertDescription>{successMsg}</AlertDescription></Alert>}
          <h2 className="font-semibold flex items-center gap-2"><Camera className="w-4 h-4" />{t(locale, 'checklist.requiredPhotos')}</h2>
          {checklist.map(item => {
            const IconComp = iconMap[item.icon] || Camera
            const isUploading = uploadingKey === item.key
            return (
              <Card key={item.id} className={`border-0 shadow-sm ${item.completed ? 'bg-green-50 ring-1 ring-green-200' : 'bg-white ring-1 ring-black/5'}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.completed ? 'bg-green-200 text-green-700' : 'bg-[#FFD100]/20 text-black'}`}>
                      {item.completed ? <CheckCircle2 className="w-5 h-5" /> : <IconComp className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-sm">{t(locale, `photo.${item.key}` as never)}</span>
                        {item.required && !item.completed && <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800">{t(locale, 'checklist.mandatory')}</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t(locale, `photo.${item.key}.desc` as never)}</p>
                    </div>
                    <Button size="sm" variant={item.completed ? 'outline' : 'default'} className={`shrink-0 h-8 text-xs ${item.completed ? 'border-green-300 text-green-700' : 'bg-[#FFD100] hover:bg-[#E6BC00] text-black'}`} onClick={() => handlePhotoCapture(item)} disabled={isUploading}>
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : item.completed ? <RefreshCw className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          <div className="sticky bottom-4 z-10">
            <Button className="w-full h-12 text-base font-bold shadow-xl rounded-xl bg-black hover:bg-black/90 text-[#FFD100] disabled:opacity-50" disabled={!allRequiredCompleted || submitting} onClick={handleSubmit}>
              {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{t(locale, 'checklist.submitting')}</> : !allRequiredCompleted ? <><ImageIcon className="w-5 h-5 mr-2" />{completedCount}/{totalCount}</> : <><Upload className="w-5 h-5 mr-2" />{t(locale, 'checklist.submitCheckin')}</>}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // ==================== CONFIRMATION ====================
  if (view === 'confirmation' && contractInfo) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="w-full bg-green-600 text-white shadow-md">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
            <CheckCheck className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-bold">{t(locale, 'confirm.title')}</h1>
              <p className="text-green-100 text-xs">{t(locale, 'confirm.subtitle')}</p>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm shadow-xl border-0">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-green-800">{t(locale, 'confirm.thanks')}</h2>
              <p className="text-sm text-muted-foreground">{t(locale, 'confirm.message')}</p>
              <div className="bg-green-50 rounded-lg p-3 text-left text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">{t(locale, 'confirm.contract')}</span><span className="font-mono font-semibold">{contractInfo.contractNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">{t(locale, 'checklist.customer')}</span><span className="font-semibold">{contractInfo.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">{t(locale, 'checklist.plate')}</span><span className="font-mono font-semibold">{contractInfo.vehiclePlate}</span></div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-800">{t(locale, 'confirm.savedSecure')}</div>
              <Button variant="outline" onClick={() => { setView('dashboard'); setToken(''); setContractInfo(null); setChecklist([]); setError(null) }}>{t(locale, 'confirm.backHome')}</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // ==================== DASHBOARD (MAIN VIEW) ====================
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="w-full bg-black text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FFD100] rounded-lg flex items-center justify-center">
              <CarFront className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Hertz Malta</h1>
              <p className="text-[10px] text-gray-400">{t(locale, 'admin.title')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={locale} onValueChange={v => changeLocale(v as Locale)}>
              <SelectTrigger className="w-[100px] h-7 text-xs border-white/20 text-white/80 bg-white/5">
                <Globe className="w-3 h-3 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {LOCALES.map(l => <SelectItem key={l.code} value={l.code} className="text-xs">{l.nativeName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-4">
        {error && <Alert variant="destructive"><XCircle className="w-4 h-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {successMsg && <Alert className="border-green-200 bg-green-50 text-green-800"><CheckCircle2 className="w-4 h-4" /><AlertDescription>{successMsg}</AlertDescription></Alert>}

        {/* ── Quick Token Access ── */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <Button variant="ghost" className="w-full justify-between p-0 h-auto" onClick={() => setShowTokenInput(!showTokenInput)}>
              <span className="text-sm font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4 text-[#FFD100]" />Customer Token Access</span>
              {showTokenInput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {showTokenInput && (
              <div className="mt-3 flex gap-2">
                <Input placeholder={t(locale, 'landing.enterCode')} value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && doValidateToken(token)} className="flex-1 font-mono text-sm" />
                <Button onClick={() => doValidateToken(token)} disabled={validating || !token.trim()} className="bg-[#FFD100] hover:bg-[#E6BC00] text-black px-4">
                  {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightToLine className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="border-0 shadow-sm"><CardContent className="p-2 text-center"><p className="text-xl font-bold">{adminContracts.length}</p><p className="text-[10px] text-muted-foreground">Total</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-2 text-center"><p className="text-xl font-bold text-amber-600">{adminContracts.filter(c => c.status === 'pending').length}</p><p className="text-[10px] text-muted-foreground">{t(locale, 'admin.pending')}</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-2 text-center"><p className="text-xl font-bold text-blue-600">{adminContracts.filter(c => c.status === 'in_progress').length}</p><p className="text-[10px] text-muted-foreground">{t(locale, 'admin.inProgress')}</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-2 text-center"><p className="text-xl font-bold text-green-600">{adminContracts.filter(c => c.status === 'completed').length}</p><p className="text-[10px] text-muted-foreground">{t(locale, 'admin.completed')}</p></CardContent></Card>
        </div>

        {/* ── Bulk Upload ── */}
        <Card className="border-0 shadow-sm ring-1 ring-[#FFD100]/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#FFD100]" />
              {t(locale, 'admin.bulkUpload')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${dragOver ? 'border-[#FFD100] bg-yellow-50' : 'border-gray-200 hover:border-gray-300'}`}
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
                <div className="space-y-1"><Loader2 className="w-8 h-8 mx-auto text-[#FFD100] animate-spin" /><p className="text-xs text-muted-foreground">{t(locale, 'admin.processing')}</p></div>
              ) : (
                <div className="space-y-1"><FileUp className="w-8 h-8 mx-auto text-gray-300" /><p className="text-xs text-muted-foreground">{t(locale, 'admin.dragDrop')}</p><p className="text-[10px] text-muted-foreground">{t(locale, 'admin.supportedFormats')}</p></div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground">{t(locale, 'admin.requiredColumns')}</span>
              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Rental *</Badge>
              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Customer *</Badge>
              <Badge variant="outline" className="text-[9px] bg-gray-50 text-gray-600 border-gray-200">Vehicle</Badge>
              <Badge variant="outline" className="text-[9px] bg-gray-50 text-gray-600 border-gray-200">Model</Badge>
            </div>

            <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs h-7">
              <Download className="w-3 h-3 mr-1" />{t(locale, 'admin.downloadTemplate')}
            </Button>

            {/* Bulk results */}
            {bulkResult && (
              <div className="space-y-2">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="font-semibold text-green-800 text-xs mb-1">{t(locale, 'admin.uploadSuccess')}</p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-green-700">{bulkResult.summary.created} {t(locale, 'admin.created')}</span>
                    <span className="text-amber-700">{bulkResult.summary.skipped} {t(locale, 'admin.skipped')}</span>
                    {bulkResult.summary.errors > 0 && <span className="text-red-700">{bulkResult.summary.errors} {t(locale, 'admin.errors')}</span>}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] h-8">{t(locale, 'admin.contract')}</TableHead>
                        <TableHead className="text-[10px]">{t(locale, 'admin.client')}</TableHead>
                        <TableHead className="text-[10px]">{t(locale, 'admin.tokenLink')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkResult.results.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs py-1.5">{r.contractNumber}</TableCell>
                          <TableCell className="text-xs py-1.5 max-w-[100px] truncate">{r.customerName}</TableCell>
                          <TableCell className="py-1.5">
                            {r.link ? (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1" onClick={() => copyToClipboard(r.link!, r.token || '')}>
                                {copiedToken === r.token ? <CheckCircle2 className="w-3 h-3 text-green-600 mr-1" /> : <ClipboardCopy className="w-3 h-3 mr-1" />}
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

        {/* ── Action Bar ── */}
        <div className="flex gap-2">
          <Button onClick={() => setShowNewContractDialog(true)} className="flex-1 bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold h-10">
            <Plus className="w-4 h-4 mr-1" />{t(locale, 'admin.newContract')}
          </Button>
          <Button variant="outline" onClick={loadAdminContracts} disabled={adminLoading} className="h-10">
            <RefreshCw className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* ── Contracts List (mobile-friendly cards) ── */}
        <div className="space-y-2">
          {adminContracts.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-8 text-center text-muted-foreground">
                <User className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{t(locale, 'admin.noContracts')}</p>
              </CardContent>
            </Card>
          ) : (
            adminContracts.map(contract => (
              <Card key={contract.id} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm">{contract.contractNumber}</span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${contract.status === 'completed' ? 'bg-green-100 text-green-800' : contract.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                          {contract.status === 'completed' ? t(locale, 'admin.completed') : contract.status === 'in_progress' ? t(locale, 'admin.inProgress') : t(locale, 'admin.pending')}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{contract.customerName}</p>
                      <p className="text-xs text-muted-foreground">{contract.vehicleModel} • {contract.vehiclePlate}</p>
                      <p className="text-[10px] text-muted-foreground">{contract.photosSubmitted}/7 photos • {contract.tokens.length} token(s)</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {contract.status !== 'completed' && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => { setSelectedContractId(contract.id); setShowTokenDialog(true) }}>
                          <KeyRound className="w-3 h-3 mr-1" />Token
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setExpandedContract(expandedContract === contract.id ? null : contract.id)}>
                        {expandedContract === contract.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                  {/* Expanded details with token links */}
                  {expandedContract === contract.id && contract.tokens.length > 0 && (
                    <div className="mt-2 pt-2 border-t space-y-1">
                      {contract.tokens.map(tk => (
                        <div key={tk.id} className="flex items-center gap-2">
                          <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded flex-1 truncate">
                            {window.location.origin}/#token={tk.token.substring(0, 8)}...
                          </code>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToClipboard(`/#token=${tk.token}`, tk.token)}>
                            {copiedToken === tk.token ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <ClipboardCopy className="w-3 h-3" />}
                          </Button>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${tk.usedAt ? 'bg-red-50 text-red-600' : tk.isExpired ? 'bg-gray-50 text-gray-500' : 'bg-green-50 text-green-600'}`}>
                            {tk.usedAt ? 'Used' : tk.isExpired ? 'Expired' : 'Active'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* New Contract Dialog */}
      <Dialog open={showNewContractDialog} onOpenChange={setShowNewContractDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t(locale, 'admin.newContractTitle')}</DialogTitle>
            <DialogDescription className="text-xs">{t(locale, 'admin.newContractDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">{t(locale, 'admin.contractNumber')} *</Label><Input className="h-8 text-sm" placeholder="RES-69714" value={newContract.contractNumber} onChange={e => setNewContract(p => ({ ...p, contractNumber: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">{t(locale, 'admin.customerName')} *</Label><Input className="h-8 text-sm" placeholder="Full Name" value={newContract.customerName} onChange={e => setNewContract(p => ({ ...p, customerName: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">{t(locale, 'admin.vehiclePlate')}</Label><Input className="h-8 text-sm" placeholder="SQZ138" value={newContract.vehiclePlate} onChange={e => setNewContract(p => ({ ...p, vehiclePlate: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">{t(locale, 'admin.vehicleModel')}</Label><Input className="h-8 text-sm" placeholder="Picanto" value={newContract.vehicleModel} onChange={e => setNewContract(p => ({ ...p, vehicleModel: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">{t(locale, 'admin.customerEmail')}</Label><Input type="email" className="h-8 text-sm" placeholder="email@example.com" value={newContract.customerEmail} onChange={e => setNewContract(p => ({ ...p, customerEmail: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">{t(locale, 'admin.customerPhone')}</Label><Input className="h-8 text-sm" placeholder="+356 9999 0000" value={newContract.customerPhone} onChange={e => setNewContract(p => ({ ...p, customerPhone: e.target.value }))} /></div>
            </div>
            <Button className="w-full bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold h-10" onClick={handleCreateContract} disabled={!newContract.contractNumber || !newContract.customerName}>
              <Plus className="w-4 h-4 mr-1" />{t(locale, 'admin.createAndGenerate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Token Dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t(locale, 'admin.generateToken')}</DialogTitle>
            <DialogDescription className="text-xs">{t(locale, 'admin.generateTokenDesc')}</DialogDescription>
          </DialogHeader>
          <Button className="w-full bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold h-10" onClick={() => { if (selectedContractId) handleGenerateToken(selectedContractId) }}>
            <KeyRound className="w-4 h-4 mr-2" />{t(locale, 'admin.generate')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Token Link Dialog */}
      <Dialog open={!!newTokenLink} onOpenChange={() => setNewTokenLink(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t(locale, 'admin.linkGenerated')}</DialogTitle>
            <DialogDescription className="text-xs">{t(locale, 'admin.linkGeneratedDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-gray-100 rounded-lg p-3 font-mono text-xs break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}${newTokenLink}` : newTokenLink}
            </div>
            <Button className="w-full" variant="outline" onClick={() => { copyToClipboard(newTokenLink!, newTokenLink!); }}>
              {copiedToken === newTokenLink ? <><CheckCircle2 className="w-4 h-4 mr-2" />{t(locale, 'admin.copied')}</> : <><ClipboardCopy className="w-4 h-4 mr-2" />{t(locale, 'admin.copyLink')}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="w-full bg-black/5 py-2 text-center text-[10px] text-muted-foreground">
        Hertz Malta &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
