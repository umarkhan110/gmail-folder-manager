import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAILS = ['thomaswarner228@outlook.com', 'harrystevenson2025@outlook.com'];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { licenseId, extensionMinutes } = await request.json();

    // Get the current license
    const license = await prisma.license.findUnique({
      where: { id: licenseId }
    });

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // Calculate new expiration time from current time
    const newExpiresAt = new Date(Date.now() + extensionMinutes * 60 * 1000);

    // Update the license
    const updatedLicense = await prisma.license.update({
      where: { id: licenseId },
      data: {
        expiresAt: newExpiresAt,
      },
    });

    // Also update any user subscriptions using this key
    await prisma.userSubscription.updateMany({
      where: { licenseKey: license.key },
      data: {
        licenseExpiresAt: newExpiresAt,
      },
    });

    return NextResponse.json({ success: true, license: updatedLicense });
  } catch (error) {
    console.error('Error extending license:', error);
    return NextResponse.json({ error: 'Failed to extend license' }, { status: 500 });
  }
}