import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadToSharePoint, isGraphConfigured } from '@/lib/graph-api';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const file = formData.get('photo') as File | null;
    const requirementId = formData.get('requirementId') as string;

    if (!token || !file || !requirementId) {
      return NextResponse.json(
        { error: 'Missing required fields: token, photo, requirementId' },
        { status: 400 }
      );
    }

    const accessToken = await db.accessToken.findUnique({
      where: { token },
      include: {
        rentalContract: {
          include: { photoRequirements: true },
        },
      },
    });

    if (!accessToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (accessToken.used) {
      return NextResponse.json(
        { error: 'This token has already been used' },
        { status: 403 }
      );
    }

    if (new Date(accessToken.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 403 }
      );
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 10MB` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop() || 'jpg';
    const uniqueId = crypto.randomUUID();
    const fileName = `${accessToken.rentalContract.contractNumber}_${requirementId}_${uniqueId}.${ext}`;

    const isVercel = !!process.env.VERCEL;
    const baseDir = isVercel
      ? '/tmp/uploads'
      : path.join(process.cwd(), 'uploads');
    const contractDir = path.join(baseDir, accessToken.rentalContract.contractNumber);

    await mkdir(contractDir, { recursive: true });

    let photoUrl = '';
    let storageType: 'sharepoint' | 'local' = 'local';

    if (isGraphConfigured()) {
      try {
        photoUrl = await uploadToSharePoint(buffer, fileName, accessToken.rentalContract.contractNumber);
        storageType = 'sharepoint';
      } catch (graphError) {
        console.error('Graph API upload failed, falling back to local:', graphError);
      }
    }

    if (!photoUrl) {
      const filePath = path.join(contractDir, fileName);
      await writeFile(filePath, buffer);
      photoUrl = `/uploads/${accessToken.rentalContract.contractNumber}/${fileName}`;
      storageType = 'local';
    }

    const submission = await db.photoSubmission.create({
      data: {
        rentalContractId: accessToken.rentalContract.id,
        photoRequirementId: requirementId,
        photoUrl,
        storageType,
        fileName,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date(),
      },
    });

    await db.rentalContract.update({
      where: { id: accessToken.rentalContract.id },
      data: { status: 'in_progress' },
    });

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        photoUrl,
        storageType,
        fileName: submission.fileName,
      },
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo. Please try again.' },
      { status: 500 }
    );
  }
}
