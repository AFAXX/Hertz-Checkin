import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadToSharePoint, isGraphConfigured } from '@/lib/graph-api'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('photo') as File | null
    const token = formData.get('token') as string | null
    const requirementId = formData.get('requirementId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Nessuna foto ricevuta' }, { status: 400 })
    }
    if (!token || !requirementId) {
      return NextResponse.json({ error: 'Dati mancanti (token o requisito foto)' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Il file deve essere un\'immagine' }, { status: 400 })
    }

    // Validate token (same checks as /api/token/validate and /api/submit)
    const accessToken = await db.accessToken.findUnique({
      where: { token },
      include: { contract: true },
    })

    if (!accessToken) {
      return NextResponse.json({ error: 'Token non trovato' }, { status: 404 })
    }
    if (accessToken.usedAt) {
      return NextResponse.json({ error: 'Token già utilizzato' }, { status: 410 })
    }
    if (new Date() > accessToken.expiresAt) {
      return NextResponse.json({ error: 'Token scaduto' }, { status: 410 })
    }

    const requirement = await db.photoRequirement.findUnique({
      where: { id: requirementId },
    })
    if (!requirement) {
      return NextResponse.json({ error: 'Requisito foto non valido' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${requirement.key}_${Date.now()}.${ext}`

    // Try SharePoint first; if Graph API isn't configured (or the call fails),
    // we still record the submission so the checklist can progress —
    // uploadToSharePoint() already returns null in both of those cases.
    let graphItemId: string | null = null
    let graphDriveId: string | null = null

    if (await isGraphConfigured()) {
      const uploadResult = await uploadToSharePoint(
        fileName,
        buffer,
        accessToken.contract.contractNumber
      )
      if (uploadResult) {
        graphItemId = uploadResult.graphItemId
        graphDriveId = uploadResult.graphDriveId
      }
    }

    // One photo per requirement per contract — upsert so retakes overwrite
    // the previous submission instead of failing on the unique constraint.
    const submission = await db.photoSubmission.upsert({
      where: {
        contractId_requirementId: {
          contractId: accessToken.contractId,
          requirementId: requirement.id,
        },
      },
      update: {
        fileName,
        fileSize: file.size,
        mimeType: file.type,
        graphItemId,
        graphDriveId,
        uploadedAt: new Date(),
      },
      create: {
        contractId: accessToken.contractId,
        requirementId: requirement.id,
        fileName,
        fileSize: file.size,
        mimeType: file.type,
        graphItemId,
        graphDriveId,
      },
    })

    if (accessToken.contract.status === 'pending') {
      await db.rentalContract.update({
        where: { id: accessToken.contractId },
        data: { status: 'in_progress' },
      })
    }

    return NextResponse.json({
      success: true,
      photo: {
        id: submission.id,
        fileName: submission.fileName,
        savedToSharePoint: !!graphItemId,
      },
    })
  } catch (error) {
    console.error('Photo upload error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Caricamento foto fallito: ${msg}` },
      { status: 500 }
    )
  }
}
