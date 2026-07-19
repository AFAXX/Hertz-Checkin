import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DEFAULT_REQUIREMENTS = [
  {
    key: 'front',
    label: 'Front',
    labelEn: 'Front',
    description: 'Fotografare la parte anteriore del veicolo, inclusa la targa anteriore. Puoi scattare più foto.',
    orderIndex: 1,
    required: true,
    icon: 'CarFront',
  },
  {
    key: 'passenger_side',
    label: 'Passenger Side',
    labelEn: 'Passenger Side',
    description: 'Fotografare il lato passeggero del veicolo per intero. Puoi scattare più foto.',
    orderIndex: 2,
    required: true,
    icon: 'ArrowRight',
  },
  {
    key: 'driver_side',
    label: 'Driver Side',
    labelEn: 'Driver Side',
    description: 'Fotografare il lato conducente del veicolo per intero. Puoi scattare più foto.',
    orderIndex: 3,
    required: true,
    icon: 'ArrowLeft',
  },
  {
    key: 'back',
    label: 'Back',
    labelEn: 'Back',
    description: 'Fotografare la parte posteriore del veicolo, inclusa la targa posteriore. Puoi scattare più foto.',
    orderIndex: 4,
    required: true,
    icon: 'Car',
  },
]

export async function POST() {
  try {
    let created = 0
    let skipped = 0

    for (const req of DEFAULT_REQUIREMENTS) {
      const existing = await db.photoRequirement.findUnique({
        where: { key: req.key },
      })

      if (existing) {
        skipped++
        continue
      }

      await db.photoRequirement.create({ data: req })
      created++
    }

    return NextResponse.json({
      success: true,
      message: `Photo requirements initialized: ${created} created, ${skipped} already exist`,
      total: DEFAULT_REQUIREMENTS.length,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Error initializing photo requirements' },
      { status: 500 }
    )
  }
}