import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// The ONLY categories that should exist. Anything else in the database
// (old duplicates like "Vista posteriore", "Fiancata sinistra", etc.)
// gets deleted automatically when this runs.
const DEFAULT_REQUIREMENTS = [
  { key: 'front', label: 'Fronte', labelEn: 'Front', description: 'Fotografare la parte anteriore del veicolo.', orderIndex: 1, required: true, icon: 'CarFront' },
  { key: 'passenger_side', label: 'Lato Passeggero', labelEn: 'Passenger Side', description: 'Fotografare il lato passeggero del veicolo.', orderIndex: 2, required: true, icon: 'ArrowRight' },
  { key: 'back', label: 'Retro', labelEn: 'Back', description: 'Fotografare la parte posteriore del veicolo.', orderIndex: 3, required: true, icon: 'Car' },
  { key: 'driver_side', label: 'Lato Guidatore', labelEn: 'Driver Side', description: 'Fotografare il lato conducente del veicolo.', orderIndex: 4, required: true, icon: 'ArrowLeft' },
  { key: 'interior', label: 'Interno', labelEn: 'Interior', description: 'Fotografare cruscotto, contachilometri e sedili.', orderIndex: 5, required: true, icon: 'Armchair' },
]

const ALLOWED_KEYS = DEFAULT_REQUIREMENTS.map(r => r.key)

export async function POST() {
  try {
    let created = 0, updated = 0, deleted = 0

    // Remove ANY category that is not in the allowed list above
    // (covers old duplicates seeded in Italian only, dashboard/fuel/damage, etc.)
    const existingAll = await db.photoRequirement.findMany()
    for (const row of existingAll) {
      if (!ALLOWED_KEYS.includes(row.key)) {
        await db.photoRequirement.delete({ where: { key: row.key } })
        deleted++
      }
    }

    // Create or update the 5 required categories
    for (const req of DEFAULT_REQUIREMENTS) {
      const existing = await db.photoRequirement.findUnique({ where: { key: req.key } })
      if (existing) {
        await db.photoRequirement.update({ where: { key: req.key }, data: req })
        updated++
      } else {
        await db.photoRequirement.create({ data: req })
        created++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${created} created, ${updated} updated, ${deleted} removed`,
      total: DEFAULT_REQUIREMENTS.length
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Seed error' }, { status: 500 })
  }
}
