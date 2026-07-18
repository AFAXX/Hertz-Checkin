import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { contractId } = await request.json()

    if (!contractId) {
      return NextResponse.json(
        { error: 'ID contratto mancante' },
        { status: 400 }
      )
    }

    const contract = await db.rentalContract.findUnique({
      where: { id: contractId },
    })

    if (!contract) {
      return NextResponse.json(
        { error: 'Contratto non trovato' },
        { status: 404 }
      )
    }

    if (contract.status === 'completed') {
      return NextResponse.json(
        { error: 'Impossibile generare un token per un contratto già completato' },
        { status: 400 }
      )
    }

    const expirationHours = parseInt(process.env.TOKEN_EXPIRATION_HOURS || '6', 10)
    const token = uuidv4()

    const accessToken = await db.accessToken.create({
      data: {
        token,
        contractId: contract.id,
        expiresAt: new Date(Date.now() + expirationHours * 60 * 60 * 1000),
      },
    })

    return NextResponse.json({
      success: true,
      accessToken: {
        id: accessToken.id,
        token: accessToken.token,
        expiresAt: accessToken.expiresAt,
        link: `/#token=${accessToken.token}`,
      },
    })
  } catch (error) {
    console.error('Generate token error:', error)
    return NextResponse.json(
      { error: 'Errore nella generazione del token' },
      { status: 500 }
    )
  }
}
