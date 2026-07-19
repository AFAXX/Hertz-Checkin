import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadToSharePoint } from '@/lib/graph-api'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'

// Allow up to 30 seconds for upload (photo + Graph API)
export const maxDuration = 30

const UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || './uploads'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('photo') as File | null
    const token = formData.get('token') as string | null
    const requirementId = formData.get('requirementId') as string | null

    // Validate inputs
    if (!file) {
      return NextResponse.json({ error: 'Nessuna foto selezionata' }, { status: 400 })
    }

    if (!token) {
      return NextResponse.json({ error: 'Token mancante' }, { status: 400 })
    }

    if (!requirementId) {
      return NextResponse.json({ error: 'Requirement ID mancante' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      return NextResponse.json(
        { error: 'Formato non supportato. Usa JPG, PNG o WebP.' },
        { status: 400 }
      )
    }

    // Validate file size (max 20MB)
    const MAX_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Foto troppo grande. Dimensione massima: 20MB.' },
        { status: 400 }
      )
    }

    // Validate token and get contract info
    const accessToken = await db.accessToken.findUnique({
      where: { token },
      include: { contract: true },
    })

    if (!accessToken) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 404 })
    }

    if (accessToken.usedAt) {
      return NextResponse.json({ error: 'Token già utilizzato' }, { status: 410 })
    }

    if (new Date() > accessToken.expiresAt) {
      return NextResponse.json({ error: 'Token scaduto. Contattare il personale Hertz.' }, { status: 410 })
    }

    // Validate requirement exists
    const requirement = await db.photoRequirement.findUnique({
      where: { id: requirementId },
    })

    if (!requirement) {
      return NextResponse.json({ error: 'Requisito foto non trovato' }, { status: 404 })
    }

    // Check if this photo was already submitted
    const existingSubmission = await db.photoSubmission.findUnique({
      where: {
        contractId_requirementId: {
          contractId: accessToken.contractId,
          requirementId: requirementId,
        },
      },
    })

    if (existingSubmission) {
      // Allow re-upload: delete the old one and create a new one
      await db.photoSubmission.delete({
        where: { id: existingSubmission.id },
      })
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Generate a unique file name
    const ext = file.name.split('.').pop() || 'jpg'
    const uniqueFileName = `${requirement.key}_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`

    // Try Microsoft Graph API upload first (SharePoint/OneDrive)
    const graphResult = await uploadToSharePoint(
      uniqueFileName,
      buffer,
      accessToken.contract.contractNumber
    )

    let localPath: string | null = null
    let graphItemId: string | null = null
    let graphDriveId: string | null = null

    if (graphResult) {
      // Successfully uploaded to SharePoint
      graphItemId = graphResult.graphItemId
      graphDriveId = graphResult.graphDriveId
      console.log(
        `[PhotoUpload] Uploaded to SharePoint: ${graphResult.webUrl}`
      )
    } else {
      // Fallback to local storage
      console.log('[PhotoUpload] Graph API not available, using local storage')
      const contractDir = join(UPLOAD_DIR, accessToken.contract.contractNumber)
      if (!existsSync(contractDir)) {
        await mkdir(contractDir, { recursive: true })
      }
      localPath = join(contractDir, uniqueFileName)
      await writeFile(localPath, buffer)
    }

    // Update contract status to in_progress if it was pending
    if (accessToken.contract.status === 'pending') {
      await db.rentalContract.update({
        where: { id: accessToken.contractId },
        data: { status: 'in_progress' },
      })
    }

    // Save submission to database
    const submission = await db.photoSubmission.create({
      data: {
        contractId: accessToken.contractId,
        requirementId: requirementId,
        fileName: uniqueFileName,
        fileSize: file.size,
        mimeType: file.type,
        localPath,
        graphItemId,
        graphDriveId,
      },
    })

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        fileName: submission.fileName,
        storedIn: graphResult ? 'sharepoint' : 'local',
      },
    })
  } catch (error) {
    console.error('Photo upload error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Errore durante il caricamento: ${msg}` },
      { status: 500 }
    )
  }
}