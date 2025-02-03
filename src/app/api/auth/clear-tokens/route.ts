import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Clear global token
    await prisma.token.deleteMany({
      where: {
        id: 'global'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing tokens:', error);
    return NextResponse.json({ error: 'Failed to clear tokens' }, { status: 500 });
  }
} 