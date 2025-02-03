import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// List of admin emails that can access this endpoint
const ADMIN_EMAILS = ['thomaswarner228@outlook.com', 'harrystevenson2025@outlook.com'];

function generateLicenseKey(): string {
  return `${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(4).toString('hex')}`;
}

// Generate new license keys
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('Session user:', session?.user); // Add this for debugging
    
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
      console.log('Unauthorized access attempt:', session?.user?.email); // Add this for debugging
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count = 1, expirationMinutes, maxUses } = await request.json();
    
    const keys = [];
    for (let i = 0; i < count; i++) {
      const key = generateLicenseKey();
      const expiresAt = expirationMinutes 
        ? new Date(Date.now() + expirationMinutes * 60 * 1000)
        : null;

      const license = await prisma.license.create({
        data: {
          key,
          expiresAt,
          redeemedBy: '',
          maxUses: maxUses || null,
          usedCount: 0
        },
      });
      
      keys.push(license);
    }

    return NextResponse.json({ keys });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating license keys:', { message: errorMessage });
    return NextResponse.json({ error: 'Failed to generate keys' }, { status: 500 });
  }
}

// Get all license keys
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    console.log('API Session:', session); // Add this debug log
    console.log('User email:', session?.user?.email); // Add this debug log
    
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      console.log('Unauthorized access:', session?.user?.email); // Add this debug log
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const licenses = await prisma.license.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ licenses });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching license keys:', { message: errorMessage });
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }
} 