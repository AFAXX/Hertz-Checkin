import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/admin/photos?contractId=xxx
 * Returns all photos for a contract with full details for gallery view.
 * Includes SharePoint URL if available, or local API URL.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const contractId = request.nextUrl.searchParams.get('contractId')
    if (!contractId) {
      return NextResponse.json({ error: 'Missing contractId' }, { status: 400 })
    }

    const contract = await db.rentalContract.findUnique({
      where: { id: contractId },
      include: {
        photos: { include: { requirement: true }, orderBy: { uploadedAt: 'asc' } },
      },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const photos = contract.photos.map((p) => {
      // Build the photo URL: SharePoint URL or local API endpoint
      let photoUrl: string
      if (p.localPath && p.localPath.startsWith('https://')) {
        // SharePoint/OneDrive URL
        photoUrl = p.localPath
      } else if (p.localPath) {
        // Local storage — serve via API
        photoUrl = `/api/photos/${p.id}`
      } else {
        photoUrl = ''
      }

      return {
        id: p.id,
        fileName: p.fileName,
        fileSize: p.fileSize,
        mimeType: p.mimeType,
        photoUrl,
        requirementKey: p.requirement.key,
        requirementLabel: p.requirement.label,
        capturedAt: p.capturedAt,
        latitude: p.latitude,
        longitude: p.longitude,
        uploadedAt: p.uploadedAt,
        graphItemId: p.graphItemId,
      }
    })

    return NextResponse.json({
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        customerName: contract.customerName,
        vehiclePlate: contract.vehiclePlate,
        vehicleModel: contract.vehicleModel,
        vehicleColor: contract.vehicleColor,
        status: contract.status,
      },
      photos,
    })
  } catch (error) {
    console.error('Get contract photos error:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}
