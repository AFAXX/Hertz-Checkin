import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

/**
 * Auto-archive logic — revised per Hertz Malta workday rules.
 *
 * Workday = 08:00 AM → 04:00 AM next day (Malta time).
 * At 04:00 AM Malta time, the workday ends. ALL active (non-archived) contracts
 * created BEFORE today's 04:00 AM must be moved to the archive, regardless of status
 * (pending / in_progress / completed).
 *
 * This function is idempotent: running it multiple times produces the same result,
 * because already-archived contracts (archivedAt != null) are excluded by the WHERE clause.
 *
 * It is called from two places:
 *   1. On every GET /api/admin/contracts (on-demand, when admin loads the dashboard)
 *   2. By the Vercel cron job at /api/admin/cron/auto-archive (scheduled, reliable)
 *
 * Malta timezone: Europe/Malta (UTC+1 standard, UTC+2 DST). We compute Malta time
 * via Intl to remain correct regardless of the server's TZ.
 */
export async function autoArchiveExpiredContracts() {
  const now = new Date()
  const maltaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Malta' }))

  // Today's 04:00 AM Malta time
  const todayDeadline = new Date(maltaNow)
  todayDeadline.setHours(4, 0, 0, 0)

  // If we haven't reached today's 04:00 AM yet, nothing to archive
  // (yesterday's batch was already handled by previous runs)
  if (maltaNow < todayDeadline) {
    return { archived: 0, skipped: 'before-deadline' as 'before-deadline' }
  }

  // Convert Malta deadline to UTC for DB comparison
  const utcOffset = now.getTime() - maltaNow.getTime()
  const utcTodayDeadline = new Date(todayDeadline.getTime() + utcOffset)

  // Archive ALL active contracts created before today's 04:00 AM Malta time.
  // This includes pending, in_progress AND completed contracts — the home page
  // must start fresh every morning at 04:00 AM.
  const result = await db.rentalContract.updateMany({
    where: {
      createdAt: { lt: utcTodayDeadline },
      archivedAt: null,
      status: { in: ['pending', 'in_progress', 'completed'] },
    },
    data: {
      status: 'archived',
      archivedAt: now,
    },
  })

  return { archived: result.count, skipped: null as null }
}

function calculateTokenExpiry(): Date {
  const now = new Date()
  const maltaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Malta' }))
  // Token expires at 04:30 AM next day Malta time (30 min grace after workday end)
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

    // Auto-archive expired contracts on each GET (idempotent + safe)
    try {
      await autoArchiveExpiredContracts()
    } catch (archiveErr) {
      // Don't block the contracts list if the auto-archive fails
      // (e.g. transient DB issue) — log and continue.
      console.error('Auto-archive error (non-fatal):', archiveErr)
    }

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

    // Detect the specific archivedAt schema mismatch and return a helpful message
    if (msg.includes('archivedAt') && msg.includes('does not exist')) {
      return NextResponse.json({
        error: 'Database migration missing. The "archivedAt" column does not exist on RentalContract. Run `npx prisma migrate deploy` (or apply prisma/migrations/20260721_add_geo_and_auth/migration.sql directly on Neon) to fix this.',
        migrationRequired: true,
      }, { status: 500 })
    }

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

    if (msg.includes('archivedAt') && msg.includes('does not exist')) {
      return NextResponse.json({
        error: 'Database migration missing. The "archivedAt" column does not exist on RentalContract. Run `npx prisma migrate deploy` (or apply prisma/migrations/20260721_add_geo_and_auth/migration.sql directly on Neon) to fix this.',
        migrationRequired: true,
      }, { status: 500 })
    }

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
