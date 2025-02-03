import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  
      // Store description in database
      await prisma.folderDescription.create({
        data: {
          id: label.data.id!,
          displayName: name,
          description,
          userId: session.user?.email ?? "unknown",
        },
      });
  
      return NextResponse.json(label.data);
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
  
      const { id, description } = await request.json();
  
      // Update description in database
      await prisma.folderDescription.upsert({
        where: { id },
        update: { description },
        create: {
          id,
          displayName: "Unknown",
          description,
          userId: session.user.email,
        },
      });
  
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
  
      const { id } = await request.json();
  
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: session.accessToken });
  
      const gmail = google.gmail({ version: "v1", auth });
  
      await gmail.users.labels.delete({ userId: "me", id });
  
      // Delete description from database
      await prisma.folderDescription.delete({
        where: { id },
      }).catch(() => {});
  
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting Gmail label:", error);
      return NextResponse.json({ error: "Failed to delete label" }, { status: 500 });
    }
  }
  