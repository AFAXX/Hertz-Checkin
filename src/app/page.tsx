'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  QrCode,
  Plus,
  RefreshCw,
  Eye,
  ChevronRight,
  Settings,
  User,
  Clock,
  CheckCheck,
  ImageIcon,
} from 'lucide-react'

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

interface TokenValidationResult {
  valid: boolean
  contract: ContractInfo
  photoChecklist: PhotoChecklistItem[]
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
  photos: Array<{
    key: string
    label: string
    fileName: string
    uploadedAt: string
  }>
}

// ==================== ICON MAP ====================

const iconMap: Record<string, React.ElementType> = {
  CarFront,
  Car,
  ArrowLeft,
  ArrowRight,
  Gauge,
  Fuel,
  AlertTriangle,
}

// ==================== VIEWS ====================

type View = 'landing' | 'token_entry' | 'photo_checklist' | 'confirmation' | 'admin'

// ==================== MAIN APP ====================

export default function Home() {
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

  // Extract token from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.startsWith('#token=')) {
      const urlToken = hash.replace('#token=', '')
      setToken(urlToken)
      handleValidateToken(urlToken)
    }
  }, [])

  // Reset error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleValidateToken = useCallback(async (tokenValue?: string) => {
    const t = tokenValue || token
    if (!t.trim()) {
      setError('Inserisci un token di accesso valido')
      return
    }
    setValidating(true)
    setError(null)
    try {
      const res = await fetch('/api/token/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Errore di validazione')
        return
      }
      setContractInfo(data.contract)
      setChecklist(data.photoChecklist)
      setView('photo_checklist')
    } catch {
      setError('Errore di connessione al server')
    } finally {
      setValidating(false)
    }
  }, [token])

  const handlePhotoCapture = useCallback(async (requirement: PhotoChecklistItem) => {
    // Create file input
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Prefer rear camera on mobile
    
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
        const res = await fetch('/api/photos/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Errore nel caricamento della foto')
          return
        }
        setChecklist((prev) =>
          prev.map((item) =>
            item.key === requirement.key ? { ...item, completed: true } : item
          )
        )
        setSuccessMsg(`Foto "${requirement.label}" caricata con successo`)
        setTimeout(() => setSuccessMsg(null), 3000)
      } catch {
        setError('Errore di connessione durante il caricamento')
      } finally {
        setUploadingKey(null)
      }
    }

    input.click()
  }, [token])

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
          setError(`Foto mancanti: ${data.missingPhotos.map((p: { label: string }) => p.label).join(', ')}`)
        } else {
          setError(data.error || 'Errore nella sottomissione')
        }
        return
      }
      setView('confirmation')
    } catch {
      setError('Errore di connessione durante la sottomissione')
    } finally {
      setSubmitting(false)
    }
  }, [token])

  const loadAdminContracts = useCallback(async () => {
    setAdminLoading(true)
    try {
      // Seed requirements first
      await fetch('/api/admin/seed', { method: 'POST' })
      const res = await fetch('/api/admin/contracts')
      const data = await res.json()
      if (res.ok) {
        setAdminContracts(data.contracts)
      }
    } catch {
      setError('Errore nel caricamento dei contratti')
    } finally {
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
      if (!res.ok) {
        setError(data.error || 'Errore nella creazione del contratto')
        return
      }
      setNewTokenLink(data.accessToken.link)
      setNewContract({
        contractNumber: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        vehiclePlate: '',
        vehicleModel: '',
        vehicleColor: '',
      })
      loadAdminContracts()
    } catch {
      setError('Errore di connessione')
    }
  }, [newContract, loadAdminContracts])

  const handleGenerateToken = useCallback(async (contractId: string) => {
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Errore nella generazione del token')
        return
      }
      setNewTokenLink(data.accessToken.link)
      loadAdminContracts()
    } catch {
      setError('Errore di connessione')
    }
  }, [loadAdminContracts])

  const completedCount = checklist.filter((c) => c.completed).length
  const totalCount = checklist.length
  const allRequiredCompleted = checklist.filter((r) => r.required).every((r) => r.completed)
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // ==================== LANDING PAGE ====================
  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-yellow-50 to-white">
        {/* Header */}
        <header className="w-full bg-[#FFD100] shadow-md">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <CarFront className="w-6 h-6 text-[#FFD100]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-black">Hertz Malta</h1>
                <p className="text-xs text-black/70">Vehicle Check-in Portal</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                loadAdminContracts()
                setView('admin')
              }}
              className="text-black/70 hover:text-black hover:bg-black/10"
            >
              <Settings className="w-4 h-4 mr-1" />
              Admin
            </Button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#FFD100] rounded-full flex items-center justify-center">
                <Camera className="w-10 h-10 text-black" />
              </div>
              <CardTitle className="text-2xl">Check-in Fotografico</CardTitle>
              <CardDescription className="text-base">
                Fotografa il tuo veicolo al momento del ritiro per una documentazione completa e senza dispute.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">Come funziona:</p>
                <ol className="list-decimal list-inside space-y-1 text-amber-700">
                  <li>Inserisci il codice ricevuto via SMS o email</li>
                  <li>Fotografa ogni parte del veicolo come indicato</li>
                  <li>Invia le foto per completare il check-in</li>
                </ol>
              </div>

              <div className="space-y-3">
                <Label htmlFor="token-input" className="text-sm font-medium">
                  Codice di accesso
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="token-input"
                    placeholder="Inserisci il tuo codice..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleValidateToken()}
                    className="flex-1 text-center text-lg font-mono tracking-wide"
                  />
                  <Button
                    onClick={() => handleValidateToken()}
                    disabled={validating || !token.trim()}
                    className="bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold px-6"
                  >
                    {validating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ArrowRightToLine className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Error alert */}
              {error && (
                <Alert variant="destructive">
                  <XCircle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <ShieldCheck className="w-4 h-4" />
                <span>Link sicuro e monouso — le foto vengono salvate direttamente su SharePoint</span>
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="w-full bg-black/5 py-3 text-center text-xs text-muted-foreground">
          Hertz Malta &copy; {new Date().getFullYear()} — Portale Check-in Veicoli
        </footer>
      </div>
    )
  }

  // ==================== PHOTO CHECKLIST ====================
  if (view === 'photo_checklist' && contractInfo) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-yellow-50 to-white">
        {/* Header */}
        <header className="w-full bg-[#FFD100] shadow-md sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                  <CarFront className="w-5 h-5 text-[#FFD100]" />
                </div>
                <span className="font-bold text-black text-sm">Hertz Malta</span>
              </div>
              <Badge variant="outline" className="bg-white/80 text-black border-black/20">
                {contractInfo.contractNumber}
              </Badge>
            </div>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-black/70">
                <span>{completedCount} di {totalCount} foto completate</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2 bg-black/10 [&>div]:bg-black" />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 space-y-4">
          {/* Vehicle info card */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Cliente</span>
                  <p className="font-semibold">{contractInfo.customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Veicolo</span>
                  <p className="font-semibold">{contractInfo.vehicleModel}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Targa</span>
                  <p className="font-semibold font-mono">{contractInfo.vehiclePlate}</p>
                </div>
                {contractInfo.vehicleColor && (
                  <div>
                    <span className="text-muted-foreground">Colore</span>
                    <p className="font-semibold">{contractInfo.vehicleColor}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error alert */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success toast */}
          {successMsg && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* Photo checklist */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Foto richieste
            </h2>
            {checklist.map((item) => {
              const IconComp = iconMap[item.icon] || Camera
              const isUploading = uploadingKey === item.key
              return (
                <Card
                  key={item.id}
                  className={`border-0 shadow-sm transition-all ${
                    item.completed
                      ? 'bg-green-50 ring-1 ring-green-200'
                      : 'bg-white ring-1 ring-black/5'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          item.completed
                            ? 'bg-green-200 text-green-700'
                            : 'bg-[#FFD100]/20 text-black'
                        }`}
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <IconComp className="w-6 h-6" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{item.label}</h3>
                          {item.labelEn && (
                            <span className="text-xs text-muted-foreground">({item.labelEn})</span>
                          )}
                          {item.required && !item.completed && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800">
                              Obbligatoria
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        )}
                        <Button
                          size="sm"
                          variant={item.completed ? 'outline' : 'default'}
                          className={`mt-2 ${
                            item.completed
                              ? 'border-green-300 text-green-700 hover:bg-green-100'
                              : 'bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold'
                          }`}
                          onClick={() => handlePhotoCapture(item)}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Caricamento...
                            </>
                          ) : item.completed ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Rifai foto
                            </>
                          ) : (
                            <>
                              <Camera className="w-4 h-4 mr-1" />
                              Scatta foto
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Submit button */}
          <div className="sticky bottom-4 z-10">
            <Button
              className="w-full h-14 text-lg font-bold shadow-xl rounded-xl disabled:opacity-50 bg-black hover:bg-black/90 text-[#FFD100]"
              disabled={!allRequiredCompleted || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Invio in corso...
                </>
              ) : !allRequiredCompleted ? (
                <>
                  <ImageIcon className="w-5 h-5 mr-2" />
                  Completa tutte le foto per inviare ({completedCount}/{totalCount})
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Invia check-in fotografico
                </>
              )}
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
                <h1 className="text-xl font-bold">Check-in Completato!</h1>
                <p className="text-green-100 text-sm">Documentazione fotografica registrata con successo</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-14 h-14 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-800">Grazie!</h2>
                <p className="text-muted-foreground mt-2">
                  Il check-in fotografico per il veicolo è stato completato e tutte le foto sono state salvate.
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-left text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contratto</span>
                  <span className="font-mono font-semibold">{contractInfo.contractNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold">{contractInfo.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Veicolo</span>
                  <span className="font-semibold">{contractInfo.vehicleModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Targa</span>
                  <span className="font-mono font-semibold">{contractInfo.vehiclePlate}</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <p>Le foto sono state salvate in modo sicuro su SharePoint aziendale. Questo link non è più utilizzabile.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setView('landing')
                  setToken('')
                  setContractInfo(null)
                  setChecklist([])
                  setError(null)
                }}
              >
                Torna alla homepage
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
                <h1 className="text-lg font-bold">Hertz Malta — Admin</h1>
                <p className="text-xs text-gray-400">Gestione contratti e token</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('landing')}
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Portale
            </Button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full p-4 space-y-6">
          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setShowNewContractDialog(true)
              }}
              className="bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Contratto
            </Button>
            <Button
              variant="outline"
              onClick={loadAdminContracts}
              disabled={adminLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${adminLoading ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{adminContracts.length}</p>
                <p className="text-xs text-muted-foreground">Totale Contratti</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">
                  {adminContracts.filter((c) => c.status === 'pending').length}
                </p>
                <p className="text-xs text-muted-foreground">In Attesa</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {adminContracts.filter((c) => c.status === 'in_progress').length}
                </p>
                <p className="text-xs text-muted-foreground">In Corso</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-green-600">
                  {adminContracts.filter((c) => c.status === 'completed').length}
                </p>
                <p className="text-xs text-muted-foreground">Completati</p>
              </CardContent>
            </Card>
          </div>

          {/* Contracts table */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Contratti di Noleggio</CardTitle>
              <CardDescription>Gestisci i contratti e genera link di accesso per i clienti</CardDescription>
            </CardHeader>
            <CardContent>
              {adminContracts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nessun contratto trovato. Crea il primo contratto per iniziare.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contratto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Veicolo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Foto</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminContracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-mono font-semibold">
                            {contract.contractNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{contract.customerName}</p>
                              {contract.customerEmail && (
                                <p className="text-xs text-muted-foreground">{contract.customerEmail}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{contract.vehicleModel}</p>
                              <p className="text-xs text-muted-foreground font-mono">{contract.vehiclePlate}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                contract.status === 'completed'
                                  ? 'default'
                                  : contract.status === 'in_progress'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className={
                                contract.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : contract.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }
                            >
                              {contract.status === 'completed'
                                ? 'Completato'
                                : contract.status === 'in_progress'
                                ? 'In Corso'
                                : 'In Attesa'}
                            </Badge>
                          </TableCell>
                          <TableCell>{contract.photosSubmitted}/7</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {contract.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedContractId(contract.id)
                                    setShowTokenDialog(true)
                                  }}
                                >
                                  <KeyRound className="w-3 h-3 mr-1" />
                                  Token
                                </Button>
                              )}
                              {contract.tokens.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {contract.tokens.length} token
                                </div>
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
              <DialogTitle>Nuovo Contratto di Noleggio</DialogTitle>
              <DialogDescription>
                Inserisci i dati del contratto per generare un link di accesso per il cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="contractNumber">N. Contratto *</Label>
                  <Input
                    id="contractNumber"
                    placeholder="ES: HZ-2024-001"
                    value={newContract.contractNumber}
                    onChange={(e) =>
                      setNewContract((prev) => ({ ...prev, contractNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customerName">Cliente *</Label>
                  <Input
                    id="customerName"
                    placeholder="Nome e Cognome"
                    value={newContract.customerName}
                    onChange={(e) =>
                      setNewContract((prev) => ({ ...prev, customerName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="vehiclePlate">Targa *</Label>
                  <Input
                    id="vehiclePlate"
                    placeholder="ES: ABC 123"
                    value={newContract.vehiclePlate}
                    onChange={(e) =>
                      setNewContract((prev) => ({ ...prev, vehiclePlate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vehicleModel">Modello *</Label>
                  <Input
                    id="vehicleModel"
                    placeholder="ES: Toyota Yaris"
                    value={newContract.vehicleModel}
                    onChange={(e) =>
                      setNewContract((prev) => ({ ...prev, vehicleModel: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="cliente@email.com"
                    value={newContract.customerEmail}
                    onChange={(e) =>
                      setNewContract((prev) => ({ ...prev, customerEmail: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customerPhone">Telefono</Label>
                  <Input
                    id="customerPhone"
                    placeholder="+356 9999 9999"
                    value={newContract.customerPhone}
                    onChange={(e) =>
                      setNewContract((prev) => ({ ...prev, customerPhone: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="vehicleColor">Colore veicolo</Label>
                <Input
                  id="vehicleColor"
                  placeholder="ES: Bianco"
                  value={newContract.vehicleColor}
                  onChange={(e) =>
                    setNewContract((prev) => ({ ...prev, vehicleColor: e.target.value }))
                  }
                />
              </div>
              <Button
                className="w-full bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold"
                onClick={handleCreateContract}
                disabled={
                  !newContract.contractNumber ||
                  !newContract.customerName ||
                  !newContract.vehiclePlate ||
                  !newContract.vehicleModel
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Crea Contratto e Genera Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Generate Token Dialog */}
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Genera Nuovo Token</DialogTitle>
              <DialogDescription>
                Genera un nuovo link di accesso monouso per il cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Button
                className="w-full bg-[#FFD100] hover:bg-[#E6BC00] text-black font-semibold"
                onClick={() => {
                  if (selectedContractId) {
                    handleGenerateToken(selectedContractId)
                  }
                }}
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Genera Token
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Token Link Dialog */}
        <Dialog open={!!newTokenLink} onOpenChange={() => setNewTokenLink(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Generato!</DialogTitle>
              <DialogDescription>
                Invia questo link al cliente via SMS o email. Il link è monouso e scade dopo 6 ore.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}${newTokenLink}` : newTokenLink}
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  const fullLink = `${window.location.origin}${newTokenLink}`
                  navigator.clipboard.writeText(fullLink)
                  setCopiedToken(newTokenLink)
                  setTimeout(() => setCopiedToken(null), 2000)
                }}
              >
                {copiedToken === newTokenLink ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Copiato!
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="w-4 h-4 mr-2" />
                    Copia Link
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <footer className="w-full bg-black/5 py-3 text-center text-xs text-muted-foreground">
          Hertz Malta &copy; {new Date().getFullYear()} — Admin Panel
        </footer>
      </div>
    )
  }

  return null
}
