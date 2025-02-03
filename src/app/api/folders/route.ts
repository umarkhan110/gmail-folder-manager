// src/app/api/folders/route.ts
import { NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface GraphFolder {
  id: string;
  displayName: string;
}

interface GraphError {
  code: string;
  message: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = Client.init({
      authProvider: (done) => {
        done(null, session.accessToken ?? null);
      }
    });

    // Get all folders with a larger page size
    const response = await client
      .api('/me/mailFolders')
      .select('id,displayName')
      .top(999) // Request maximum number of folders
      .get();

    console.log('Total folders returned:', response.value.length);

    // Get descriptions from SQLite
    const descriptions = await prisma.folderDescription.findMany({
      where: {
        userId: session.user?.email ?? 'unknown',
      },
    });

    // Merge folder data with descriptions
    const foldersWithDescriptions = response.value.map((folder: GraphFolder) => ({
      ...folder,
      description: descriptions.find(d => d.id === folder.id)?.description || '',
    }));

    return NextResponse.json(foldersWithDescriptions);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await request.json();

    const client = Client.init({
      authProvider: (done) => {
        done(null, session.accessToken ?? null);
      }
    });

    // Create folder in Outlook
    const folder = await client
      .api('/me/mailFolders')
      .post({
        displayName: name
      });

    // Store description in SQLite using Prisma
    await prisma.folderDescription.create({
      data: {
        id: folder.id,
        displayName: name,
        description,
        userId: session.user?.email ?? 'unknown',
      },
    });

    return NextResponse.json(folder);
  } catch (error: unknown) {
    const graphError = error as GraphError;
    console.error('Error creating folder:', graphError);
    return NextResponse.json({ 
      error: 'Failed to create folder',
      details: graphError.message 
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, description } = await request.json();

    // Update or create the description
    await prisma.folderDescription.upsert({
      where: { id },
      update: { description },
      create: {
        id,
        displayName: 'Unknown', // We'll update this in a moment
        description,
        userId: session.user.email,
      },
    });

    // Get the folder name from Microsoft Graph
    const client = Client.init({
      authProvider: (done) => {
        done(null, session.accessToken ?? null);
      }
    });

    const folder = await client.api(`/me/mailFolders/${id}`).get();
    
    // Update the display name if it was a new description
    await prisma.folderDescription.update({
      where: { id },
      data: { displayName: folder.displayName },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating folder description:', error);
    return NextResponse.json({ 
      error: 'Failed to update folder description',
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;  // Get the ID from the request body

    const client = Client.init({
      authProvider: (done) => {
        done(null, session.accessToken ?? null);
      }
    });

    try {
      await client.api(`/me/mailFolders/${id}`).delete();
    } catch (error: any) {
      if (error.code === 'ErrorDeleteDistinguishedFolder') {
        return NextResponse.json({ 
          error: 'This is a default Outlook folder and cannot be deleted.',
          code: 'ErrorDeleteDistinguishedFolder'
        }, { status: 400 });
      }
      throw error; // Re-throw other errors
    }

    // Delete description from database if it exists
    await prisma.folderDescription.delete({
      where: { id },
    }).catch(() => {
      // Ignore if description doesn't exist
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting folder:', error.message);
    return NextResponse.json({ 
      error: 'Failed to delete folder',
      details: error.message 
    }, { status: 500 });
  }
}