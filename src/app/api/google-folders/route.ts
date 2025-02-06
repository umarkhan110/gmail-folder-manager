import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("session.accessToken: ", session)

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const gmail = google.gmail({ version: "v1", auth });

    const response = await gmail.users.labels.list({ userId: "me" });

    return NextResponse.json(response.data.labels);
  } catch (error) {
    console.error("Error fetching Gmail labels:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description } = await request.json();

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const gmail = google.gmail({ version: "v1", auth });

    // Create a new label
    const label = await gmail.users.labels.create({
      userId: "me",
      requestBody: { name },
    });

    // Validate label ID
    if (!label.data.id) {
      throw new Error('Label ID is required');
    }

    // Generate a unique ID for the folder
    const uniqueId = uuidv4();

    // Store description in database with unique ID
    try {
      await prisma.folderDescription.create({
        data: {
          id: uniqueId,
          displayName: name,
          description,
          userId: session.user?.email ?? "unknown",
          labelId: label.data.id,
        },
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      throw new Error('Failed to store label description');
    }

    return NextResponse.json({ ...label.data, uniqueId });
  } catch (error) {
    console.error("Error creating Gmail label:", error);
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("session.accessToken: ", session)


    const { labelId, description } = await request.json();

    // Find the folder description by labelId and user email
    const folderDescription = await prisma.folderDescription.findFirst({
      where: {
        labelId: labelId,
        userId: session.user.email,
      },
    });

    if (!folderDescription) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    //just a comment

    // Update description in database
    try {
      await prisma.folderDescription.update({
        where: { id: folderDescription.id },
        data: { description },
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      throw new Error('Failed to update label description');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating label:", error);
    return NextResponse.json({ error: "Failed to update label" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("session.accessToken: ", session)

    const { labelId } = await request.json();

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: "v1", auth });

    await gmail.users.labels.delete({ userId: "me", id: labelId });


    // Find the folder description by labelId and user email
    const folder = await prisma.folderDescription.findFirst({
      where: {
        labelId: labelId,
        userId: session.user.email,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    // Delete description from database
    await prisma.folderDescription.delete({
      where: { id: folder.id },
    }).catch(() => { });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Gmail label:", error);
    return NextResponse.json({ error: "Failed to delete label" }, { status: 500 });
  }
}
