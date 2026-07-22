import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadToSharePoint, deleteFromSharePoint, isGraphConfigured } from '@/lib/graph-api';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const maxDuration = 60; // Increased to handle chunked uploads
const MAX_PHOTOS_PER_REQUIREMENT = 10;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const file = formData.get('photo') as File | null;
    const requirementId = formData.get('requirementId') as string;

    const latitudeStr = formData.get('latitude') as string | null;
    const longitudeStr = formData.get('longitude') as string | null;
    const latitude = latitudeStr ? parseFloat(latitudeStr) : null;
    const longitude = longitudeStr ? parseFloat(longitudeStr) : null;

    const validLat = (latitude !== null && !isNaN(latitude) && latitude >= -90 && latitude <= 90) ? latitude : null;
    const validLng = (longitude !== null && !isNaN(longitude) && longitude >= -180 && longitude <= 180) ? longitude : null;

    if (!token || !file || !requirementId) {
      return NextResponse.json({ error: 'Missing required fields: token, photo, requirementId' }, { status: 400 });
    }

    const accessToken = await db.accessToken.findUnique({ where: { token }, include: { contract: true } });
    if (!accessToken) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (accessToken.usedAt) return NextResponse.json({ error: 'Token already used' }, { status: 403 });
    if (new Date(accessToken.expiresAt) < new Date()) return NextResponse.json({ error: 'Token expired' }, { status: 403 });

    const existingCount = await db.photoSubmission.count({ where: { contractId: accessToken.contractId, requirementId } });
    if (existingCount >= MAX_PHOTOS_PER_REQUIREMENT) {
      return NextResponse.json({ error: 'Maximum ' + MAX_PHOTOS_PER_REQUIREMENT + ' photos for this angle.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop() || 'jpg';
    const uniqueId = crypto.randomUUID();
    const fileName = accessToken.contract.contractNumber + '_' + requirementId + '_' + uniqueId + '.' + ext;

    const isVercel = !!process.env.VERCEL;
    const isGraphReady = await isGraphConfigured();

    let localPath = '';
    let graphItemId: string | null = null;
    let graphDriveId: string | null = null;

    if (isGraphReady) {
      try {
        // Non catturiamo l'errore silenziosamente. Se Graph fallisce, deve bloccarsi.
        const result = await uploadToSharePoint(fileName, buffer, accessToken.contract.contractNumber);
        graphItemId = result.graphItemId;
        graphDriveId = result.graphDriveId;
        localPath = result.webUrl; // Salva l'URL web di SharePoint nel DB
      } catch (graphError: any) {
        console.error('Graph API upload failed critically:', graphError.message);
        // Su Vercel NON facciamo fallback locale, perché i file verrebbero persi al riavvio della funzione.
        if (isVercel) {
          return NextResponse.json({ 
            error: 'Upload to Microsoft failed: ' + graphError.message + '. Please try again.' 
          }, { status: 503 });
        }
        // In locale/dev, usiamo il fallback
        console.log('Falling back to local storage (dev mode)...');
      }
    }

    // Se non abbiamo graphItemId (o graph non configurato o fallback in dev), salva localmente
    if (!graphItemId) {
      const baseDir = path.join(process.cwd(), 'uploads');
      const contractDir = path.join(baseDir, accessToken.contract.contractNumber);
      await mkdir(contractDir, { recursive: true });
      await writeFile(path.join(contractDir, fileName), buffer);
      localPath = '/uploads/' + accessToken.contract.contractNumber + '/' + fileName;
    }

    const capturedAt = new Date();

    try {
      const submission = await db.photoSubmission.create({
        data: {
          contractId: accessToken.contractId,
          requirementId,
          fileName,
          fileSize: file.size,
          mimeType: file.type,
          localPath,
          graphItemId,
          graphDriveId,
          capturedAt,
          latitude: validLat,
          longitude: validLng,
        },
      });

      await db.rentalContract.update({ where: { id: accessToken.contractId }, data: { status: 'in_progress' } });

      return NextResponse.json({
        success: true,
        submission: {
          id: submission.id,
          fileName: submission.fileName,
          localPath: submission.localPath,
          capturedAt: submission.capturedAt.toISOString(),
          latitude: submission.latitude,
          longitude: submission.longitude,
        },
        photoCount: existingCount + 1,
      });
    } catch (dbError: any) {
      // Rollback di sicurezza: se il DB fallisce, elimina il file appena caricato su SharePoint
      if (graphItemId) {
        console.error('DB save failed, rolling back SharePoint upload...', dbError.message);
        await deleteFromSharePoint(graphItemId, graphDriveId || '');
      }
      throw dbError;
    }

  } catch (error) {
    console.error('Photo upload error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to upload photo: ' + msg }, { status: 500 });
  }
}
