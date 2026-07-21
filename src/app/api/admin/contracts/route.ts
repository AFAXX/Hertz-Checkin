import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

/**
 * Auto-archive logic:
 * Active window: 08:00 AM to 04:00 AM next day (Malta time).
 * After 04:00 AM, any contract created the previous day that is still pending/in_progress
 * gets auto-archived (status = 'archived', archivedAt = now).
 * Completed contracts are also archived after 04:00 AM of the next day.
 */
async function autoArchiveExpiredContracts() {
  const now = new Date()
  const maltaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Malta' }))
  const maltaHour = maltaNow.getHours()

  // Only run archival check between 04:00 and 08:00 Malta time
  // (After 04:00 AM, yesterday's contracts should be archived)
  if (maltaHour >= 4 && maltaHour < 8) {
    // Get start of yesterday at 08:00 AM Malta time
    const yesterdayStart = new Date(maltaNow)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    yesterdayStart.setHours(8, 0, 0, 0)

    // Get today at 04:00 AM Malta time
    const todayDeadline = new Date(maltaNow)
    todayDeadline.setHours(4, 0, 0, 0)

    // Convert Malta times to UTC for DB comparison
    const utcOffset = now.getTime() - maltaNow.getTime()
    const utcYesterdayStart = new Date(yesterdayStart.getTime() + utcOffset)
    const utcTodayDeadline = new Date(todayDeadline.getTime() + utcOffset)

    // Archive contracts created between yesterday 08:00 and today 04:00 that are not yet archived
    await db.rentalContract.updateMany({
      where: {
        createdAt: {
          gte: utcYesterdayStart,
          lt: utcTodayDeadline,
        },
        archivedAt: null,
        status: { in: ['pending', 'in_progress', 'completed'] },
      },
      data: {
        status: 'archived',
        archivedAt: now,
      },
    })
  }
}

function calculateTokenExpiry(): Date {
  const now = new Date()
  const maltaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Malta' }))
  // Token expires at 04:00 AM next day Malta time
  const expiry = new Date(maltaNow)
  expiry.setHours(4, 30, 0, 0)
  if (maltaNow >= expiry) {
    expiry.setDate(expiry.getDate() + 1)
  }
  const utcOffset = now.getTime() - maltaNow.getTime()
  return new Date(expiry.getTime() + utcOffset)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Auto-archive expired contracts on each GET
    await autoArchiveExpiredContracts()

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'active' // 'active' or 'archived'

    const where = view === 'archived'
      ? { archivedAt: { not: null } }
      : { archivedAt: null }

    const contracts = await db.rentalContract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tokens: true,
        photos: { include: { requirement: true } },
      },
    })
    const enriched = contracts.map((c) => {
      const requirements = c.photos.map((p) => ({
        key: p.requirement.key,
        label: p.requirement.label,
        fileName: p.fileName,
        uploadedAt: p.uploadedAt,
        capturedAt: p.capturedAt,
        latitude: p.latitude,
        longitude: p.longitude,
        localPath: p.localPath,
        graphItemId: p.graphItemId,
      }))
      return {
        id: c.id,
        contractNumber: c.contractNumber,
        customerName: c.customerName,
        customerEmail: c.customerEmail,
        customerPhone: c.customerPhone,
        vehiclePlate: c.vehiclePlate,
        vehicleModel: c.vehicleModel,
        vehicleColor: c.vehicleColor,
        status: c.status,
        archivedAt: c.archivedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        tokens: c.tokens.map((t) => ({
          id: t.id,
          token: t.token,
          expiresAt: t.expiresAt,
          usedAt: t.usedAt,
          isExpired: new Date() > t.expiresAt,
        })),
        photosSubmitted: c.photos.length,
        photos: requirements,
      }
    })
    return NextResponse.json({ contracts: enriched })
  } catch (error) {
    console.error('List contracts error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to fetch contracts: ${msg}` }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { contractNumber, customerName, customerEmail, customerPhone, vehiclePlate, vehicleModel, vehicleColor } = body
    if (!contractNumber || !customerName) {
      return NextResponse.json({ error: 'Missing required fields: contract number and customer name' }, { status: 400 })
    }
    const existing = await db.rentalContract.findUnique({ where: { contractNumber } })
    if (existing) {
      return NextResponse.json({ error: 'Contract number already exists' }, { status: 409 })
    }
    const contract = await db.rentalContract.create({
      data: {
        contractNumber,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        vehiclePlate: vehiclePlate || 'N/A',
        vehicleModel: vehicleModel || 'N/A',
        vehicleColor: vehicleColor || null,
      },
    })
    const token = uuidv4()
    const expiresAt = calculateTokenExpiry()
    const accessToken = await db.accessToken.create({
      data: { token, contractId: contract.id, expiresAt },
    })
    return NextResponse.json({
      success: true,
      contract: { id: contract.id, contractNumber: contract.contractNumber, customerName: contract.customerName },
      accessToken: { token: accessToken.token, expiresAt: accessToken.expiresAt, link: `/#token=${accessToken.token}` },
    })
  } catch (error) {
    console.error('Create contract error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to create contract: ${msg}` }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { id, contractNumber, customerName, customerEmail, customerPhone, vehiclePlate, vehicleModel, vehicleColor, status } = body
    if (!id) {
      return NextResponse.json({ error: 'Missing contract ID' }, { status: 400 })
    }
    const contract = await db.rentalContract.findUnique({ where: { id } })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    if (contractNumber && contractNumber !== contract.contractNumber) {
      const duplicate = await db.rentalContract.findUnique({ where: { contractNumber } })
      if (duplicate) {
        return NextResponse.json({ error: 'Contract number already exists' }, { status: 409 })
      }
    }
    const updated = await db.rentalContract.update({
      where: { id },
      data: {
        ...(contractNumber && { contractNumber }),
        ...(customerName && { customerName }),
        customerEmail: customerEmail !== undefined ? customerEmail || null : undefined,
        customerPhone: customerPhone !== undefined ? customerPhone || null : undefined,
        ...(vehiclePlate && { vehiclePlate }),
        ...(vehicleModel && { vehicleModel }),
        vehicleColor: vehicleColor !== undefined ? vehicleColor || null : undefined,
        ...(status && { status }),
      },
    })
    return NextResponse.json({ success: true, contract: updated })
  } catch (error) {
    console.error('Update contract error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to update contract: ${msg}` }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing contract ID' }, { status: 400 })
    }

    const contract = await db.rentalContract.findUnique({ where: { id } })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    await db.photoSubmission.deleteMany({
      where: { contractId: id }
    })

    await db.accessToken.deleteMany({
      where: { contractId: id }
    })

    await db.rentalContract.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Contract deleted successfully' })
  } catch (error) {
    console.error('Delete contract error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to delete contract: ${msg}` }, { status: 500 })
  }
}
