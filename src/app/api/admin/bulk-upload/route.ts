import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'

interface RowData {
  contractNumber?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  vehiclePlate?: string
  vehicleModel?: string
  vehicleColor?: string
  [key: string]: string | undefined
}

// Map possible column names to our fields
const columnMap: Record<string, keyof RowData> = {
  // Contract number
  'contract': 'contractNumber',
  'contractnumber': 'contractNumber',
  'contract_number': 'contractNumber',
  'contract no': 'contractNumber',
  'contractno': 'contractNumber',
  'agreement': 'contractNumber',
  'agreementno': 'contractNumber',
  'ra': 'contractNumber',
  'rano': 'contractNumber',
  'reservation': 'contractNumber',

  // Customer name
  'name': 'customerName',
  'customername': 'customerName',
  'customer_name': 'customerName',
  'customer': 'customerName',
  'clientname': 'customerName',
  'client': 'customerName',
  'driver': 'customerName',
  'drivername': 'customerName',
  'fullname': 'customerName',
  'full_name': 'customerName',
  'surname': 'customerName',

  // Email
  'email': 'customerEmail',
  'customeremail': 'customerEmail',
  'customer_email': 'customerEmail',
  'e-mail': 'customerEmail',
  'mail': 'customerEmail',

  // Phone
  'phone': 'customerPhone',
  'customerphone': 'customerPhone',
  'customer_phone': 'customerPhone',
  'mobile': 'customerPhone',
  'tel': 'customerPhone',
  'telephone': 'customerPhone',
  'cell': 'customerPhone',

  // Plate
  'plate': 'vehiclePlate',
  'vehicleplate': 'vehiclePlate',
  'vehicle_plate': 'vehiclePlate',
  'licenseplate': 'vehiclePlate',
  'license_plate': 'vehiclePlate',
  'registration': 'vehiclePlate',
  'reg': 'vehiclePlate',
  'tag': 'vehiclePlate',
  'numberplate': 'vehiclePlate',
  'targa': 'vehiclePlate',

  // Model
  'model': 'vehicleModel',
  'vehiclemodel': 'vehicleModel',
  'vehicle_model': 'vehicleModel',
  'carmodel': 'vehicleModel',
  'car': 'vehicleModel',
  'vehicle': 'vehicleModel',
  'make': 'vehicleModel',
  'make/model': 'vehicleModel',
  'tipo': 'vehicleModel',

  // Color
  'color': 'vehicleColor',
  'vehiclecolor': 'vehicleColor',
  'vehicle_color': 'vehicleColor',
  'colour': 'vehicleColor',
  'colore': 'vehicleColor',
}

function normalizeColumnName(col: string): keyof RowData | null {
  const normalized = col.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  return columnMap[normalized] || null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Parse the Excel/CSV file
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Use first sheet
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'The file is empty or has no data rows' },
        { status: 400 }
      )
    }

    // Map columns from the first row's headers
    const headers = Object.keys(rows[0])
    const fieldMapping: Record<string, keyof RowData> = {}

    for (const header of headers) {
      const mapped = normalizeColumnName(header)
      if (mapped) {
        fieldMapping[header] = mapped
      }
    }

    // Check we have at least the required fields
    const mappedFields = new Set(Object.values(fieldMapping))
    const requiredFields: (keyof RowData)[] = ['contractNumber', 'customerName', 'vehiclePlate', 'vehicleModel']
    const missingFields = requiredFields.filter(f => !mappedFields.has(f))

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: `Could not map required columns: ${missingFields.join(', ')}. Please ensure your file has columns for: Contract Number, Customer Name, Vehicle Plate, Vehicle Model.`,
        detectedColumns: headers,
        mappedColumns: fieldMapping,
      }, { status: 400 })
    }

    // Process each row
    const results: Array<{
      row: number
      contractNumber: string
      customerName: string
      status: 'created' | 'skipped' | 'error'
      token?: string
      link?: string
      error?: string
    }> = []

    const expirationHours = parseInt(process.env.TOKEN_EXPIRATION_HOURS || '6', 10)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      // Map row data
      const data: RowData = {}
      for (const [header, field] of Object.entries(fieldMapping)) {
        data[field] = String(row[header] || '').trim()
      }

      if (!data.contractNumber || !data.customerName || !data.vehiclePlate || !data.vehicleModel) {
        results.push({
          row: i + 2, // +2 because row 1 is header
          contractNumber: data.contractNumber || '(empty)',
          customerName: data.customerName || '(empty)',
          status: 'error',
          error: 'Missing required fields',
        })
        continue
      }

      // Check if contract already exists
      const existing = await db.rentalContract.findUnique({
        where: { contractNumber: data.contractNumber },
      })

      if (existing) {
        // Generate a new token for the existing contract
        const token = uuidv4()
        await db.accessToken.create({
          data: {
            token,
            contractId: existing.id,
            expiresAt: new Date(Date.now() + expirationHours * 60 * 60 * 1000),
          },
        })
        results.push({
          row: i + 2,
          contractNumber: data.contractNumber,
          customerName: data.customerName,
          status: 'skipped',
          token,
          link: `/#token=${token}`,
          error: 'Contract already existed — new token generated',
        })
        continue
      }

      // Create contract + token
      const contract = await db.rentalContract.create({
        data: {
          contractNumber: data.contractNumber,
          customerName: data.customerName,
          customerEmail: data.customerEmail || null,
          customerPhone: data.customerPhone || null,
          vehiclePlate: data.vehiclePlate,
          vehicleModel: data.vehicleModel,
          vehicleColor: data.vehicleColor || null,
        },
      })

      const token = uuidv4()
      await db.accessToken.create({
        data: {
          token,
          contractId: contract.id,
          expiresAt: new Date(Date.now() + expirationHours * 60 * 60 * 1000),
        },
      })

      results.push({
        row: i + 2,
        contractNumber: data.contractNumber,
        customerName: data.customerName,
        status: 'created',
        token,
        link: `/#token=${token}`,
      })
    }

    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        created,
        skipped,
        errors,
      },
      detectedColumns: headers,
      mappedColumns: fieldMapping,
      results,
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process the uploaded file' },
      { status: 500 }
    )
  }
}
