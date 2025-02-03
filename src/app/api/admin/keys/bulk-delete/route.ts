import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAILS = ['thomaswarner228@outlook.com', 'harrystevenson2025@outlook.com'];

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keys } = await request.json();
    
    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ error: 'No keys provided' }, { status: 400 });
    }

    // First, get the license keys that are being deleted
    const licensesToDelete = await prisma.license.findMany({
      where: {
        id: { in: keys }
      }
    });

    // Update any user subscriptions using these keys
    await prisma.userSubscription.updateMany({
      where: {
        licenseKey: {
          in: licensesToDelete.map(license => license.key)
        }
      },
      data: {
        isSubscribed: false,
        licenseKey: null,
        licenseExpiresAt: null
      }
    });

    // Delete the licenses
    const result = await prisma.license.deleteMany({
      where: {
        id: { in: keys }
      }
    });

    return NextResponse.json({ 
      deleted: result.count
    });
  } catch (error) {
    console.error('Error deleting license keys:', error);
    return NextResponse.json({ error: 'Failed to delete keys' }, { status: 500 });
  }
} 