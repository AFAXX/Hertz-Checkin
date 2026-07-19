import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const accessToken = await db.accessToken.findUnique({
      where: { token },
      include: { rentalContract: true },
    });

    if (!accessToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const submissions = await db.photoSubmission.findMany({
      where: { rentalContractId: accessToken.rentalContractId },
      select: { id: true, photoUrl: true, photoRequirementId: true, fileName: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error('Failed to load submissions:', error);
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 });
  }
}
