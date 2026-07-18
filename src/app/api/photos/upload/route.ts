import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadToSharePoint } from '@/lib/graph-api'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { tmpdir } from 'os'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('photo') as File | null
    const token = formData.get('token') as string | null
    const requirementId = formData.get('requirementId') as string | null

    if (!file || !token || !requirementId) {
      return NextResponse.json(
        { error: 'Dati mancanti: foto, token e requisito sono obbligatori' },
        { status: 400 }
      )
    }

    // Validate token
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
      return NextResponse.json({ error: 'Token scaduto' }, { status: 410 })
    }

    if (accessToken.contract.status === 'completed') {
      return NextResponse.json({ error: 'Contratto già completato' }, { status: 410 })
    }

    // Validate requirement exists
    const requirement = await db.photoRequirement.findUnique({
      where: { id: requirementId },
    })

    if (!requirement) {
      return NextResponse.json({ error: 'Requisito foto non trovato' }, { status: 404 })
    }

    // Read file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${accessToken.contract.contractNumber}_${requirement.key}_${Date.now()}.jpg`

    // Update contract status to in_progress
    if (accessToken.contract.status === 'pending') {
      await db.rentalContract.update({
        where: { id: accessToken.contractId },
        data: { status: 'in_progress' },
      })
    }

    // Try uploading to SharePoint (primary storage)
    const graphResult = await uploadToSharePoint(
      fileName,
      fileBuffer,
      accessToken.contract.contractNumber
    )

    // Local fallback: save to /tmp on serverless, or local uploads/ dir in dev
    let localPath: string | null = null
    try {
      const isVercel = !!process.env.VERCEL
      const uploadsDir = isVercel
        ? path.join(tmpdir(), 'hertz-checkin', accessToken.contract.contractNumber)
        : path.join(process.cwd(), 'uploads', accessToken.contract.contractNumber)
      await mkdir(uploadsDir, { recursive: true })
      localPath = path.join(uploadsDir, fileName)
      await writeFile(localPath, fileBuffer)
    } catch (fsError) {
      console.warn('[Upload] Could not save local fallback:', fsError)
      localPath = null
    }

    // Upsert photo submission
    const submission = await db.photoSubmission.upsert({
      where: {
        contractId_requirementId: {
          contractId: accessToken.contractId,
          requirementId: requirementId,
        },
      },
      create: {
        contractId: accessToken.contractId,
        requirementId: requirementId,
        fileName,
        fileSize: fileBuffer.length,
        mimeType: file.type || 'image/jpeg',
        localPath,
        graphItemId: graphResult?.graphItemId,
        graphDriveId: graphResult?.graphDriveId,
      },
      update: {
        fileName,
        fileSize: fileBuffer.length,
        mimeType: file.type || 'image/jpeg',
        localPath,
        graphItemId: graphResult?.graphItemId,
        graphDriveId: graphResult?.graphDriveId,
        uploadedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        requirementKey: requirement.key,
        fileName: submission.fileName,
        uploadedToSharePoint: !!graphResult,
      },
    })
  } catch (error) {
    console.error('Photo upload error:', error)
    return NextResponse.json(
      { error: 'Errore durante il caricamento della foto' },
      { status: 500 }
    )
  }
}
