import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DEFAULT_REQUIREMENTS = [
  { key: 'front', label: 'Front', labelEn: 'Front', description: 'Fotografare la parte anteriore del veicolo.', orderIndex: 1, required: true, icon: 'CarFront' },
  { key: 'passenger_side', label: 'Passenger Side', labelEn: 'Passenger Side', description: 'Fotografare il lato passeggero del veicolo.', orderIndex: 2, required: true, icon: 'ArrowRight' },
  { key: 'driver_side', label: 'Driver Side', labelEn: 'Driver Side', description: 'Fotografare il lato conducente del veicolo.', orderIndex: 3, required: true, icon: 'ArrowLeft' },
  { key: 'back', label: 'Back', labelEn: 'Back', description: 'Fotografare la parte posteriore del veicolo.', orderIndex: 4, required: true, icon: 'Car' },
  { key: 'interior', label: 'Interior', labelEn: 'Interior', description: 'Fotografare l\'interno del veicolo: cruscotto, sedili.', orderIndex: 5, required: false, icon: 'Armchair' },
]

export async function POST() {
  try {
    let created = 0, skipped = 0
    for (const req of DEFAULT_REQUIREMENTS) {
      const existing = await db.photoRequirement.findUnique({ where: { key: req.key } })
      if (existing) { skipped++; continue }
      await db.photoRequirement.create({ data: req })
      created++
    }
    return NextResponse.json({ success: true, message: created + ' created, ' + skipped + ' existing', total: DEFAULT_REQUIREMENTS.length })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Seed error' }, { status: 500 })
  }
}
