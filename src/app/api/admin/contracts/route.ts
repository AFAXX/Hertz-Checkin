import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

/**
 * Calculate token expiry: 4:30 AM of the next day (Malta timezone / CET)
 * If it's already past 4:30 AM today, expiry is tomorrow at 4:30 AM
 * If it's before 4:30 AM today, expiry is today at 4:30 AM
 */
function calculateTokenExpiry(): Date {
  const now = new Date()
  // Malta is CET (UTC+1) or CEST (UTC+2) - we use Europe/Malta timezone
  const maltaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Malta' }))
  
  // Set expiry to 4:30 AM
  const expiry = new Date(maltaNow)
  expiry.setHours(4, 30, 0, 0)
  
  // If it's already past 4:30 AM, set expiry to tomorrow at 4:30 AM
  if (maltaNow >= expiry) {
    expiry.setDate(expiry.getDate() + 1)
  }
  
  // Convert back to UTC by calculating the offset
  const utcOffset = now.getTime() - maltaNow.getTime()
  return new Date(expiry.getTime() + utcOffset)
}

export async function GET() {
  try {
    const contracts = await db.rentalContract.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tokens: true,
        photos: {
          include: {
            requirement: true,
          },
        },
      },
    })

    const enriched = contracts.map((c) => {
      const requirements = c.photos.map((p) => ({
        key: p.requirement.key,
        label: p.requirement.label,
        fileName: p.fileName,
        uploadedAt: p.uploadedAt,
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
    return NextResponse.json(
      { error: `Failed to fetch contracts: ${msg}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contractNumber, customerName, customerEmail, customerPhone, vehiclePlate, vehicleModel, vehicleColor } = body

    if (!contractNumber || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: contract number and customer name' },
        { status: 400 }
      )
    }

    // Check if contract number already exists
    const existing = await db.rentalContract.findUnique({
      where: { contractNumber },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Contract number already exists' },
        { status: 409 }
      )
    }

    // Create contract
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

    // Generate access token with 4:30 AM expiry
    const token = uuidv4()
    const expiresAt = calculateTokenExpiry()

    const accessToken = await db.accessToken.create({
      data: {
        token,
        contractId: contract.id,
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        customerName: contract.customerName,
      },
      accessToken: {
        token: accessToken.token,
        expiresAt: accessToken.expiresAt,
        link: `/#token=${accessToken.token}`,
      },
    })
  } catch (error) {
    console.error('Create contract error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create contract: ${msg}` },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, contractNumber, customerName, customerEmail, customerPhone, vehiclePlate, vehicleModel, vehicleColor } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing contract ID' }, { status: 400 })
    }

    const contract = await db.rentalContract.findUnique({ where: { id } })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // If contract number is changing, check it doesn't conflict
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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing contract ID' }, { status: 400 })
    }

    const contract = await db.rentalContract.findUnique({ where: { id } })
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Delete contract (cascading will delete tokens and photos)
    await db.rentalContract.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Contract deleted' })
  } catch (error) {
    console.error('Delete contract error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to delete contract: ${msg}` }, { status: 500 })
  }
}
