import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404, headers: noCacheHeaders });
    }

    const subtasks = await prisma.subtask.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, subtasks }, { headers: noCacheHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch subtasks" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404, headers: noCacheHeaders });
    }

    const body = await req.json();
    const { title } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400, headers: noCacheHeaders });
    }

    const subtask = await prisma.subtask.create({
      data: {
        taskId: id,
        title: title.trim(),
        isDone: false,
      },
    });

    return NextResponse.json({ success: true, subtask }, { headers: noCacheHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create subtask" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404, headers: noCacheHeaders });
    }

    const body = await req.json();
    const { subtaskId, title, isDone } = body;

    if (!subtaskId) {
      return NextResponse.json({ success: false, error: "subtaskId is required" }, { status: 400, headers: noCacheHeaders });
    }

    const existingSubtask = await prisma.subtask.findFirst({
      where: { id: subtaskId, taskId: id },
    });

    if (!existingSubtask) {
      return NextResponse.json({ success: false, error: "Subtask not found" }, { status: 404, headers: noCacheHeaders });
    }

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title.trim();
    if (isDone !== undefined) dataToUpdate.isDone = Boolean(isDone);

    const updatedSubtask = await prisma.subtask.update({
      where: { id: subtaskId },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, subtask: updatedSubtask }, { headers: noCacheHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update subtask" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: noCacheHeaders });
    }

    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404, headers: noCacheHeaders });
    }

    const { searchParams } = new URL(req.url);
    let subtaskId = searchParams.get("subtaskId");

    if (!subtaskId) {
      try {
        const body = await req.json();
        subtaskId = body.subtaskId;
      } catch {}
    }

    if (!subtaskId) {
      return NextResponse.json({ success: false, error: "subtaskId is required" }, { status: 400, headers: noCacheHeaders });
    }

    const existingSubtask = await prisma.subtask.findFirst({
      where: { id: subtaskId, taskId: id },
    });

    if (!existingSubtask) {
      return NextResponse.json({ success: false, error: "Subtask not found" }, { status: 404, headers: noCacheHeaders });
    }

    await prisma.subtask.delete({
      where: { id: subtaskId },
    });

    return NextResponse.json({ success: true, message: "Subtask deleted" }, { headers: noCacheHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete subtask" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
