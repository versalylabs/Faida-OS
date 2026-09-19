import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { classifyUniversalInput } from "@/lib/ai/classifier";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { input } = body;

    if (!input || typeof input !== "string" || input.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Input text is required" },
        { status: 400 }
      );
    }

    // 1. Classify and extract intent via AI / Heuristic engine
    const parsed = await classifyUniversalInput(input);

    // 2. Persist to Unified Entity Graph
    const entity = await prisma.entity.create({
      data: {
        userId: user.id,
        type: parsed.type,
        title: parsed.title,
        content: parsed.details || input,
        status: "ACTIVE",
        priority: parsed.priority || "MEDIUM",
        metadata: JSON.stringify(parsed),
      },
    });

    // 3. Persist domain-specific records based on classified type
    if (parsed.type === "TASK") {
      let projectId: string | undefined;

      // Find or link project if projectHint provided (scoped to user)
      if (parsed.projectHint) {
        let proj = await prisma.project.findFirst({
          where: {
            userId: user.id,
            name: { contains: parsed.projectHint },
          },
        });
        if (!proj) {
          proj = await prisma.project.create({
            data: {
              userId: user.id,
              name: parsed.projectHint,
              description: `Project auto-created from capture: ${parsed.projectHint}`,
            },
          });
        }
        projectId = proj.id;
      }

      await prisma.task.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          title: parsed.title,
          description: parsed.details,
          priority: parsed.priority || "MEDIUM",
          dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
          estimatedMinutes: parsed.estimatedMinutes || 30,
          projectId,
        },
      });
    } else if (parsed.type === "REMINDER") {
      await prisma.reminder.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          title: parsed.title,
          description: parsed.details,
          dueAt: parsed.dueDate ? new Date(parsed.dueDate) : new Date(Date.now() + 86400000),
          escalationState: "UPCOMING",
        },
      });
    } else if (parsed.type === "EVENT") {
      const start = parsed.startTime ? new Date(parsed.startTime) : new Date(Date.now() + 3600000);
      const end = parsed.endTime ? new Date(parsed.endTime) : new Date(start.getTime() + 3600000);

      await prisma.calendarEvent.create({
        data: {
          userId: user.id,
          title: parsed.title,
          description: parsed.details,
          startTime: start,
          endTime: end,
        },
      });
    } else if (parsed.type === "SHOPPING") {
      const items = parsed.shoppingItems && parsed.shoppingItems.length > 0
        ? parsed.shoppingItems
        : [parsed.title];

      for (const itemName of items) {
        await prisma.shoppingItem.create({
          data: {
            userId: user.id,
            name: itemName,
            category: parsed.category || "General",
            estimatedPrice: parsed.amount || null,
          },
        });
      }
    } else if (parsed.type === "NOTE" || parsed.type === "KNOWLEDGE") {
      await prisma.note.create({
        data: {
          userId: user.id,
          entityId: entity.id,
          title: parsed.title,
          content: parsed.details || input,
          category: parsed.category || "General",
          tags: parsed.tags ? parsed.tags.join(", ") : undefined,
        },
      });
    } else if (parsed.type === "FINANCE") {
      await prisma.financeTransaction.create({
        data: {
          userId: user.id,
          description: parsed.title,
          amount: parsed.amount ? (parsed.transactionType === "EXPENSE" ? -Math.abs(parsed.amount) : Math.abs(parsed.amount)) : 0,
          type: parsed.transactionType || "EXPENSE",
          category: parsed.category || "General",
        },
      });
    }

    // 4. Record Activity Log for Auto Work Journal & Analytics
    await prisma.activityLog.create({
      data: {
        entityId: entity.id,
        action: "CAPTURED",
        details: `Universal capture [${parsed.type}]: ${parsed.title}`,
      },
    });

    return NextResponse.json({
      success: true,
      parsed,
      entityId: entity.id,
    });
  } catch (error: any) {
    console.error("Error processing universal capture:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
