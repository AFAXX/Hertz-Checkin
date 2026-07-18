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
  Car,
  ArrowLeft,
  ArrowRight,
  Gauge,
  Fuel,
  AlertTriangle,
  Camera,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  ShieldCheck,
  ArrowRightToLine,
  KeyRound,
  ClipboardCopy,
  Plus,
  RefreshCw,
  Settings,
  User,
  Clock,
  CheckCheck,
  ImageIcon,
  FileSpreadsheet,
  Download,
  Globe,
  FileUp,
  AlertCircle,
} from 'lucide-react'
import { t, LOCALES, type Locale } from '@/lib/i18n'

// ==================== TYPES ====================

interface PhotoChecklistItem {
  id: string
  key: string
  label: string
  labelEn: string | null
  description: string | null
  icon: string
  required: boolean
  completed: boolean
}

interface ContractInfo {
  id: string
  contractNumber: string
  customerName: string
  vehiclePlate: string
  vehicleModel: string
  vehicleColor: string | null
  status: string
}

interface BulkUploadResult {
  success: boolean
  summary: { total: number; created: number; skipped: number; errors: number }
  detectedColumns: string[]
  mappedColumns: Record<string, string>
  results: Array<{
    row: number
    contractNumber: string
    customerName: string
    status: 'created' | 'skipped' | 'error'
    token?: string
    link?: string
    error?: string
  }>
}

interface AdminContract {
  id: string
  contractNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  vehiclePlate: string
  vehicleModel: string
  vehicleColor: string | null
  status: string
  createdAt: string
  updatedAt: string
  tokens: Array<{
    id: string
    token: string
    expiresAt: string
    usedAt: string | null
    isExpired: boolean
  }>
  photosSubmitted: number
}

// ==================== ICON MAP ====================

const iconMap: Record<string, React.ElementType> = {
  CarFront, Car, ArrowLeft, ArrowRight, Gauge, Fuel, AlertTriangle,
}

// ==================== VIEWS ====================

type View = 'landing' | 'photo_checklist' | 'confirmation' | 'admin'

// ==================== MAIN APP ====================

export default function Home() {
  // Language state - default to English, save to localStorage
  const [locale, setLocale] = useState<Locale>('en')
  const [view, setView] = useState<View>('landing')
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

  // Bulk upload state
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // New contract form
  const [newContract, setNewContract] = useState({
    contractNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    vehiclePlate: '',
    vehicleModel: '',
    vehicleColor: '',
  })

  // Load locale from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('hertz-locale') as Locale | null
    if (saved && LOCALES.some(l => l.code === saved)) {
      setLocale(saved)
    }
    // Extract token from URL hash
    const hash = window.location.hash
    if (hash && hash.startsWith('#token=')) {
      const urlToken = hash.replace('#token=', '')
      setToken(urlToken)
      handleValidateToken(urlToken, saved || 'en')
    }
  }, [])

  // Reset error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Reset success after 3 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMsg])

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale)
    localStorage.setItem('hertz-locale', newLocale)
    // Update page title and html lang attribute
    document.title = `Hertz Malta — ${t(newLocale, 'app.title')}`
    document.documentElement.lang = newLocale
  }, [])

  const handleValidateToken = useCallback(async (tokenValue?: string, overrideLocale?: Locale) => {
    const tk = tokenValue || token
    if (!tk.trim()) {
      setError(t(overrideLocale || locale, 'landing.invalidToken'))
      return
    }
    setValidating(true)
    setError(null)
    try {
      const res = await fetch('/api/token/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tk.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        const loc = overrideLocale || locale
        if (data.error?.includes('già utilizzato') || data.error?.includes('already')) {
          setError(t(loc, 'landing.tokenUsed'))
        } else if (data.error?.includes('scaduto') || data.error?.includes('expired')) {
          setError(t(loc, 'landing.tokenExpired'))
        } else if (data.error?.includes('già completato') || data.error?.includes('already completed')) {
          setError(t(loc, 'landing.alreadyCompleted'))
        } else if (data.error?.includes('non trovato') || data.error?.includes('not found')) {
          setError(t(loc, 'landing.tokenNotFound'))
        } else {
          setError(data.error)
        }
        return
      }
      setContractInfo(data.contract)
      setChecklist(data.photoChecklist)
      setView('photo_checklist')
    } catch {
      setError(t(overrideLocale || locale, 'landing.connectionError'))
    } finally {
      setValidating(false)
    }
  }, [token, locale])

  const handlePhotoCapture = useCallback(async (requirement: PhotoChecklistItem) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setUploadingKey(requirement.key)
      setError(null)
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('token', token)
      formData.append('requirementId', requirement.id)
      try {
        const res = await fetch('/api/photos/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || t(locale, 'checklist.uploadError'))
          return
        }
        setChecklist(prev => prev.map(item => item.key === requirement.key ? { ...item, completed: true } : item))
        setSuccessMsg(t(locale, 'checklist.photoSuccess'))
      } catch {
        setError(t(locale, 'landing.connectionError'))
      } finally {
        setUploadingKey(null)
      }
    }
    input.click()
  }, [token, locale])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.missingPhotos) {
          setError(`${t(locale, 'checklist.missingPhotos')}: ${data.missingPhotos.map((p: { label: string }) => p.label).join(', ')}`)
        } else {
          setError(data.error)
        }
        return
      }
      setView('confirmation')
    } catch {
      setError(t(locale, 'landing.connectionError'))
    } finally {
      setSubmitting(false)
    }
  }, [token, locale])

  const loadAdminContracts = useCallback(async () => {
    setAdminLoading(true)
    try {
      await fetch('/api/admin/seed', { method: 'POST' })
      const res = await fetch('/api/admin/contracts')
      const data = await res.json()
      if (res.ok) setAdminContracts(data.contracts)
    } catch { /* ignore */ } finally {
      setAdminLoading(false)
    }
  }, [])

  const handleCreateContract = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContract),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setNewTokenLink(data.accessToken.link)
      setNewContract({ contractNumber: '', customerName: '', customerEmail: '', customerPhone: '', vehiclePlate: '', vehicleModel: '', vehicleColor: '' })
      loadAdminContracts()
    } catch { setError(t(locale, 'landing.connectionError')) }
  }, [newContract, loadAdminContracts, locale])

  const handleGenerateToken = useCallback(async (contractId: string) => {
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setNewTokenLink(data.accessToken.link)
      loadAdminContracts()
    } catch { setError(t(locale, 'landing.connectionError')) }
  }, [loadAdminContracts, locale])

  const handleBulkUpload = useCallback(async (file: File) => {
    setBulkUploading(true)
    setBulkResult(null)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
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
    const csv = 'Contract Number,Customer Name,Vehicle Plate,Vehicle Model,Email,Phone,Color\nHZ-2024-001,John Smith,ABC 123,Toyota Yaris,john@email.com,+356 9999 0001,White\nHZ-2024-002,Jane Doe,XYZ 789,Fiat 500,jane@email.com,+356 9999 0002,Red'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hertz_checkin_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const completedCount = checklist.filter(c => c.completed).length
  const totalCount = checklist.length
  const allRequiredCompleted = checklist.filter(r => r.required).every(r => r.completed)
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // ==================== LANGUAGE SELECTOR ====================
  const LanguageSelector = ({ variant = 'default' }: { variant?: 'default' | 'dark' }) => (
    <Select value={locale} onValueChange={(v) => changeLocale(v as Locale)}>
      <SelectTrigger className={`w-[140px] h-8 text-xs ${variant === 'dark' ? 'border-white/20 text-white/80 bg-white/5' : 'border-black/20 text-black/70 bg-white/80'}`}>
        <Globe className="w-3 h-3 mr-1" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {LOCALES.map(l => (
          <SelectItem key={l.code} value={l.code} className="text-sm">
            {l.nativeName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  // ==================== LANDING PAGE ====================
  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-yellow-50 to-white">
        <header className="w-full bg-[#FFD100] shadow-md">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <CarFront className="w-6 h-6 text-[#FFD100]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-black">{t(locale, 'app.subtitle')}</h1>
                <p className="text-xs text-black/70">{t(locale, 'app.title')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <Button variant="ghost" size="sm" onClick={() => { loadAdminContracts(); setView('admin') }} className="text-black/70 hover:text-black hover:bg-black/10">
                <Settings className="w-4 h-4 mr-1" />
                Admin
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#FFD100] rounded-full flex items-center justify-center">
                <Camera className="w-10 h-10 text-black" />
              </div>
              <CardTitle className="text-2xl">{t(locale, 'landing.title')}</CardTitle>
              <CardDescription className="text-base">
                {t(locale, 'landing.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">{t(locale, 'landing.howItWorks')}</p>
                <ol className="list-decimal list-inside space-y-1 text-amber-700">
                  <li>{t(locale, 'landing.step1')}</li>
                  <li>{t(locale, 'landing.step2')}</li>
                  <li>{t(locale, 'landing.step3')}</li>
                </ol>
              </div>

              {error && (
                <Alert variant="destructive">
                  <XCircle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Label htmlFor="token-input" className="text-sm font-medium">
                  {t(locale, 'landing.accessCode')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="token-input"
                    placeholder={t(locale, 'landing.enterCode')}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleValidateToken()}
                    className="flex-1 text-center text-lg font-mono tracking-wide"
                  />
                  <Button onClick={() => handleValidateToken()} disabled={validating || !token.trim()} className="bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold px-6">
                    {validating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRightToLine className="w-5 h-5" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <ShieldCheck className="w-4 h-4" />
                <span>{t(locale, 'landing.secureNote')}</span>
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="w-full bg-black/5 py-3 text-center text-xs text-muted-foreground">
          Hertz Malta &copy; {new Date().getFullYear()} — {t(locale, 'app.title')}
        </footer>
      </div>
    )
  }

  // ==================== PHOTO CHECKLIST ====================
  if (view === 'photo_checklist' && contractInfo) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-yellow-50 to-white">
        <header className="w-full bg-[#FFD100] shadow-md sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                  <CarFront className="w-5 h-5 text-[#FFD100]" />
                </div>
                <span className="font-bold text-black text-sm">{t(locale, 'app.subtitle')}</span>
              </div>
              <div className="flex items-center gap-2">
                <LanguageSelector />
                <Badge variant="outline" className="bg-white/80 text-black border-black/20">
                  {contractInfo.contractNumber}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-black/70">
                <span>{completedCount} {t(locale, 'checklist.photosCompleted')} {totalCount}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2 bg-black/10 [&>div]:bg-black" />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t(locale, 'checklist.customer')}</span>
                  <p className="font-semibold">{contractInfo.customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t(locale, 'checklist.vehicle')}</span>
                  <p className="font-semibold">{contractInfo.vehicleModel}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t(locale, 'checklist.plate')}</span>
                  <p className="font-semibold font-mono">{contractInfo.vehiclePlate}</p>
                </div>
                {contractInfo.vehicleColor && (
                  <div>
                    <span className="text-muted-foreground">{t(locale, 'checklist.color')}</span>
                    <p className="font-semibold">{contractInfo.vehicleColor}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <XCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {t(locale, 'checklist.requiredPhotos')}
            </h2>
            {checklist.map((item) => {
              const IconComp = iconMap[item.icon] || Camera
              const isUploading = uploadingKey === item.key
              return (
                <Card key={item.id} className={`border-0 shadow-sm transition-all ${item.completed ? 'bg-green-50 ring-1 ring-green-200' : 'bg-white ring-1 ring-black/5'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.completed ? 'bg-green-200 text-green-700' : 'bg-[#FFD100]/20 text-black'}`}>
                        {item.completed ? <CheckCircle2 className="w-6 h-6" /> : <IconComp className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{t(locale, `photo.${item.key}` as keyof typeof item)}</h3>
                          {item.required && !item.completed && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800">
                              {t(locale, 'checklist.mandatory')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{t(locale, `photo.${item.key}.desc` as keyof typeof item)}</p>
                        <Button size="sm" variant={item.completed ? 'outline' : 'default'} className={`mt-2 ${item.completed ? 'border-green-300 text-green-700 hover:bg-green-100' : 'bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold'}`} onClick={() => handlePhotoCapture(item)} disabled={isUploading}>
                          {isUploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t(locale, 'checklist.uploading')}</> : item.completed ? <><RefreshCw className="w-4 h-4 mr-1" />{t(locale, 'checklist.retake')}</> : <><Camera className="w-4 h-4 mr-1" />{t(locale, 'checklist.takePhoto')}</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="sticky bottom-4 z-10">
            <Button className="w-full h-14 text-lg font-bold shadow-xl rounded-xl disabled:opacity-50 bg-black hover:bg-black/90 text-[#FFD100]" disabled={!allRequiredCompleted || submitting} onClick={handleSubmit}>
              {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{t(locale, 'checklist.submitting')}</> : !allRequiredCompleted ? <><ImageIcon className="w-5 h-5 mr-2" />{t(locale, 'checklist.completeAll')} ({completedCount}/{totalCount})</> : <><Upload className="w-5 h-5 mr-2" />{t(locale, 'checklist.submitCheckin')}</>}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // ==================== CONFIRMATION ====================
  if (view === 'confirmation' && contractInfo) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 to-white">
        <header className="w-full bg-green-600 text-white shadow-md">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCheck className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">{t(locale, 'confirm.title')}</h1>
                <p className="text-green-100 text-sm">{t(locale, 'confirm.subtitle')}</p>
              </div>
            </div>
            <LanguageSelector variant="dark" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-14 h-14 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-800">{t(locale, 'confirm.thanks')}</h2>
                <p className="text-muted-foreground mt-2">{t(locale, 'confirm.message')}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-left text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t(locale, 'confirm.contract')}</span>
                  <span className="font-mono font-semibold">{contractInfo.contractNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t(locale, 'checklist.customer')}</span>
                  <span className="font-semibold">{contractInfo.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t(locale, 'checklist.vehicle')}</span>
                  <span className="font-semibold">{contractInfo.vehicleModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t(locale, 'checklist.plate')}</span>
                  <span className="font-mono font-semibold">{contractInfo.vehiclePlate}</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                {t(locale, 'confirm.savedSecure')}
              </div>
              <Button variant="outline" onClick={() => { setView('landing'); setToken(''); setContractInfo(null); setChecklist([]); setError(null) }}>
                {t(locale, 'confirm.backHome')}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // ==================== ADMIN PANEL ====================
  if (view === 'admin') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="w-full bg-black text-white shadow-md">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#FFD100] rounded-lg flex items-center justify-center">
                <CarFront className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{t(locale, 'app.subtitle')} — {t(locale, 'admin.title')}</h1>
                <p className="text-xs text-gray-400">{t(locale, 'admin.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector variant="dark" />
              <Button variant="ghost" size="sm" onClick={() => setView('landing')} className="text-gray-400 hover:text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t(locale, 'app.portal')}
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full p-4 space-y-6">
          {error && (
            <Alert variant="destructive">
              <XCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ════════════════ BULK UPLOAD SECTION ════════════════ */}
          <Card className="border-0 shadow-sm border-l-4 border-l-[#FFD100]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#FFD100]" />
                {t(locale, 'admin.bulkUpload')}
              </CardTitle>
              <CardDescription>{t(locale, 'admin.bulkUploadDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag & drop area */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragOver ? 'border-[#FFD100] bg-yellow-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handleBulkUpload(file)
                }}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.xlsx,.xls,.csv'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) handleBulkUpload(file)
                  }
                  input.click()
                }}
              >
                {bulkUploading ? (
                  <div className="space-y-2">
                    <Loader2 className="w-10 h-10 mx-auto text-[#FFD100] animate-spin" />
                    <p className="text-sm text-muted-foreground">{t(locale, 'admin.processing')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileUp className="w-10 h-10 mx-auto text-gray-400" />
                    <p className="text-sm text-muted-foreground">{t(locale, 'admin.dragDrop')}</p>
                    <p className="text-xs text-muted-foreground">{t(locale, 'admin.supportedFormats')}</p>
                  </div>
                )}
              </div>

              {/* Required columns info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-semibold mb-1">{t(locale, 'admin.requiredColumns')}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">{t(locale, 'admin.columnContract')} *</Badge>
                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">{t(locale, 'admin.columnName')} *</Badge>
                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">{t(locale, 'admin.columnPlate')} *</Badge>
                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">{t(locale, 'admin.columnModel')} *</Badge>
                </div>
                <p className="text-xs mt-1 text-blue-600">{t(locale, 'admin.optionalColumns')}</p>
              </div>

              {/* Download template */}
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                {t(locale, 'admin.downloadTemplate')}
              </Button>

              {/* Bulk upload results */}
              {bulkResult && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-semibold text-green-800 mb-2">{t(locale, 'admin.uploadSuccess')}</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-700">{bulkResult.summary.created} {t(locale, 'admin.created')}</span>
                      <span className="text-amber-700">{bulkResult.summary.skipped} {t(locale, 'admin.skipped')}</span>
                      {bulkResult.summary.errors > 0 && <span className="text-red-700">{bulkResult.summary.errors} {t(locale, 'admin.errors')}</span>}
                    </div>
                  </div>

                  {/* Results table with token links */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t(locale, 'admin.contract')}</TableHead>
                          <TableHead>{t(locale, 'admin.client')}</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>{t(locale, 'admin.tokenLink')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkResult.results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">{r.contractNumber}</TableCell>
                            <TableCell>{r.customerName}</TableCell>
                            <TableCell>
                              <Badge className={r.status === 'created' ? 'bg-green-100 text-green-800' : r.status === 'skipped' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}>
                                {r.status === 'created' ? t(locale, 'admin.created') : r.status === 'skipped' ? t(locale, 'admin.skipped') : t(locale, 'admin.errors')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {r.link ? (
                                <div className="flex items-center gap-1">
                                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded break-all max-w-[200px]">
                                    {typeof window !== 'undefined' ? `${window.location.origin}${r.link}` : r.link}
                                  </code>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}${r.link}`)
                                    setCopiedToken(r.token || '')
                                    setTimeout(() => setCopiedToken(null), 2000)
                                  }}>
                                    {copiedToken === r.token ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <ClipboardCopy className="w-3 h-3" />}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-red-500">{r.error}</span>
                              )}
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

          {/* ════════════════ ACTION BAR ════════════════ */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setShowNewContractDialog(true)} className="bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold">
              <Plus className="w-4 h-4 mr-2" />{t(locale, 'admin.newContract')}
            </Button>
            <Button variant="outline" onClick={loadAdminContracts} disabled={adminLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${adminLoading ? 'animate-spin' : ''}`} />{t(locale, 'admin.refresh')}
            </Button>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{adminContracts.length}</p>
                <p className="text-xs text-muted-foreground">{t(locale, 'admin.totalContracts')}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{adminContracts.filter(c => c.status === 'pending').length}</p>
                <p className="text-xs text-muted-foreground">{t(locale, 'admin.pending')}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{adminContracts.filter(c => c.status === 'in_progress').length}</p>
                <p className="text-xs text-muted-foreground">{t(locale, 'admin.inProgress')}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{adminContracts.filter(c => c.status === 'completed').length}</p>
                <p className="text-xs text-muted-foreground">{t(locale, 'admin.completed')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Contracts table */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">{t(locale, 'admin.contracts')}</CardTitle>
              <CardDescription>{t(locale, 'admin.contractsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {adminContracts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t(locale, 'admin.noContracts')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t(locale, 'admin.contract')}</TableHead>
                        <TableHead>{t(locale, 'admin.client')}</TableHead>
                        <TableHead>{t(locale, 'admin.vehicle')}</TableHead>
                        <TableHead>{t(locale, 'admin.status')}</TableHead>
                        <TableHead>{t(locale, 'admin.photos')}</TableHead>
                        <TableHead className="text-right">{t(locale, 'admin.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminContracts.map(contract => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-mono font-semibold">{contract.contractNumber}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{contract.customerName}</p>
                              {contract.customerEmail && <p className="text-xs text-muted-foreground">{contract.customerEmail}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{contract.vehicleModel}</p>
                              <p className="text-xs text-muted-foreground font-mono">{contract.vehiclePlate}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={contract.status === 'completed' ? 'bg-green-100 text-green-800' : contract.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}>
                              {contract.status === 'completed' ? t(locale, 'admin.completed') : contract.status === 'in_progress' ? t(locale, 'admin.inProgress') : t(locale, 'admin.pending')}
                            </Badge>
                          </TableCell>
                          <TableCell>{contract.photosSubmitted}/7</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {contract.status !== 'completed' && (
                                <Button size="sm" variant="outline" onClick={() => { setSelectedContractId(contract.id); setShowTokenDialog(true) }}>
                                  <KeyRound className="w-3 h-3 mr-1" />{t(locale, 'admin.token')}
                                </Button>
                              )}
                              {contract.tokens.length > 0 && (
                                <span className="text-xs text-muted-foreground"><Clock className="w-3 h-3 inline mr-1" />{contract.tokens.length} {t(locale, 'admin.tokens')}</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* New Contract Dialog */}
        <Dialog open={showNewContractDialog} onOpenChange={setShowNewContractDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t(locale, 'admin.newContractTitle')}</DialogTitle>
              <DialogDescription>{t(locale, 'admin.newContractDesc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t(locale, 'admin.contractNumber')} *</Label>
                  <Input placeholder="e.g. HZ-2024-001" value={newContract.contractNumber} onChange={e => setNewContract(p => ({ ...p, contractNumber: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t(locale, 'admin.customerName')} *</Label>
                  <Input placeholder="Full Name" value={newContract.customerName} onChange={e => setNewContract(p => ({ ...p, customerName: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t(locale, 'admin.vehiclePlate')} *</Label>
                  <Input placeholder="e.g. ABC 123" value={newContract.vehiclePlate} onChange={e => setNewContract(p => ({ ...p, vehiclePlate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t(locale, 'admin.vehicleModel')} *</Label>
                  <Input placeholder="e.g. Toyota Yaris" value={newContract.vehicleModel} onChange={e => setNewContract(p => ({ ...p, vehicleModel: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t(locale, 'admin.customerEmail')}</Label>
                  <Input type="email" placeholder="customer@email.com" value={newContract.customerEmail} onChange={e => setNewContract(p => ({ ...p, customerEmail: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t(locale, 'admin.customerPhone')}</Label>
                  <Input placeholder="+356 9999 9999" value={newContract.customerPhone} onChange={e => setNewContract(p => ({ ...p, customerPhone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t(locale, 'admin.vehicleColor')}</Label>
                <Input placeholder="e.g. White" value={newContract.vehicleColor} onChange={e => setNewContract(p => ({ ...p, vehicleColor: e.target.value }))} />
              </div>
              <Button className="w-full bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold" onClick={handleCreateContract} disabled={!newContract.contractNumber || !newContract.customerName || !newContract.vehiclePlate || !newContract.vehicleModel}>
                <Plus className="w-4 h-4 mr-2" />{t(locale, 'admin.createAndGenerate')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Generate Token Dialog */}
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t(locale, 'admin.generateToken')}</DialogTitle>
              <DialogDescription>{t(locale, 'admin.generateTokenDesc')}</DialogDescription>
            </DialogHeader>
            <Button className="w-full bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold" onClick={() => { if (selectedContractId) handleGenerateToken(selectedContractId) }}>
              <KeyRound className="w-4 h-4 mr-2" />{t(locale, 'admin.generate')}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Token Link Dialog */}
        <Dialog open={!!newTokenLink} onOpenChange={() => setNewTokenLink(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t(locale, 'admin.linkGenerated')}</DialogTitle>
              <DialogDescription>{t(locale, 'admin.linkGeneratedDesc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}${newTokenLink}` : newTokenLink}
              </div>
              <Button className="w-full" variant="outline" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}${newTokenLink}`)
                setCopiedToken(newTokenLink)
                setTimeout(() => setCopiedToken(null), 2000)
              }}>
                {copiedToken === newTokenLink ? <><CheckCircle2 className="w-4 h-4 mr-2" />{t(locale, 'admin.copied')}</> : <><ClipboardCopy className="w-4 h-4 mr-2" />{t(locale, 'admin.copyLink')}</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <footer className="w-full bg-black/5 py-3 text-center text-xs text-muted-foreground">
          Hertz Malta &copy; {new Date().getFullYear()} — {t(locale, 'admin.title')}
        </footer>
      </div>
    )
  }

  return null
}
