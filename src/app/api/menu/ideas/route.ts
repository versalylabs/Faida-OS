import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_IDEAS = [
  {
    mealType: "BREAKFAST",
    title: "Spanish Omelette",
    description: "Whisked eggs with onions, tomatoes, coriander, served with toasted bread.",
    prepTime: 15,
    calories: 420,
    tags: "High Protein, Quick",
  },
  {
    mealType: "BREAKFAST",
    title: "Oatmeal with Bananas",
    description: "Rolled oats simmered in milk, topped with sliced fruit and chia seeds.",
    prepTime: 10,
    calories: 380,
    tags: "Fiber Rich, Energizing",
  },
  {
    mealType: "LUNCH",
    title: "Chicken Curry with Basmati Rice",
    description: "Spiced chicken breast stewed in tomato gravy with steamed greens.",
    prepTime: 30,
    calories: 620,
    tags: "High Protein, Balanced",
  },
  {
    mealType: "LUNCH",
    title: "Beef Stir-Fry Noodles with Veggies",
    description: "Egg noodles tossed with lean strips of beef, soy sauce, and bell peppers.",
    prepTime: 25,
    calories: 580,
    tags: "Fast, Savory",
  },
  {
    mealType: "SUPPER",
    title: "Ugali with Sukuma Wiki",
    description: "Hot cornmeal ugali served with sautéed greens and tender braised beef.",
    prepTime: 35,
    calories: 680,
    tags: "Kenyan Classic, Filling",
  },
  {
    mealType: "SUPPER",
    title: "Chapati with Ndengu Stew",
    description: "Flaky handmade chapati paired with green grams stew and ripe avocado.",
    prepTime: 40,
    calories: 640,
    tags: "Plant Protein, Comfort",
  },
  {
    mealType: "SUPPER",
    title: "Ugali with Fried Tilapia",
    description: "Crispy whole tilapia paired with fresh tomato-onion-coriander kachumbari.",
    prepTime: 35,
    calories: 720,
    tags: "Lakeside Classic, High Protein",
  },
];

// GET /api/menu/ideas - List all quick meal ideas
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let ideas = await prisma.mealIdea.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    // Auto-seed defaults if empty
    if (ideas.length === 0) {
      for (const d of DEFAULT_IDEAS) {
        await prisma.mealIdea.create({
          data: {
            userId: user.id,
            ...d,
          },
        });
      }
      ideas = await prisma.mealIdea.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({ success: true, ideas });
  } catch (error: any) {
    console.error("Error fetching meal ideas:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch meal ideas" },
      { status: 500 }
    );
  }
}

// POST /api/menu/ideas - Create new quick meal idea or reset
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    if (searchParams.get("action") === "reset") {
      await prisma.mealIdea.deleteMany({ where: { userId: user.id } });
      for (const d of DEFAULT_IDEAS) {
        await prisma.mealIdea.create({
          data: {
            userId: user.id,
            ...d,
          },
        });
      }
      const reseeded = await prisma.mealIdea.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ success: true, ideas: reseeded, message: "Reset to default ideas" });
    }

    const body = await req.json();
    const { title, mealType, description, calories, prepTime, tags } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Meal title is required" }, { status: 400 });
    }

    const created = await prisma.mealIdea.create({
      data: {
        userId: user.id,
        title: title.trim(),
        mealType: mealType || "ANY",
        description: description ? description.trim() : null,
        calories: calories ? parseInt(calories.toString(), 10) : null,
        prepTime: prepTime ? parseInt(prepTime.toString(), 10) : null,
        tags: tags ? tags.trim() : null,
      },
    });

    return NextResponse.json({ success: true, idea: created });
  } catch (error: any) {
    console.error("Error creating meal idea:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create meal idea" },
      { status: 500 }
    );
  }
}

// PATCH /api/menu/ideas - Edit existing quick meal idea
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, mealType, description, calories, prepTime, tags } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Idea ID is required" }, { status: 400 });
    }

    const existing = await prisma.mealIdea.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Meal idea not found" }, { status: 404 });
    }

    const updated = await prisma.mealIdea.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        mealType: mealType !== undefined ? mealType : existing.mealType,
        description: description !== undefined ? description?.trim() || null : existing.description,
        calories: calories !== undefined ? (calories ? parseInt(calories.toString(), 10) : null) : existing.calories,
        prepTime: prepTime !== undefined ? (prepTime ? parseInt(prepTime.toString(), 10) : null) : existing.prepTime,
        tags: tags !== undefined ? tags?.trim() || null : existing.tags,
      },
    });

    return NextResponse.json({ success: true, idea: updated });
  } catch (error: any) {
    console.error("Error updating meal idea:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update meal idea" },
      { status: 500 }
    );
  }
}

// DELETE /api/menu/ideas - Remove a quick meal idea
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Idea ID required" }, { status: 400 });
    }

    const existing = await prisma.mealIdea.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Meal idea not found" }, { status: 404 });
    }

    await prisma.mealIdea.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting meal idea:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete meal idea" },
      { status: 500 }
    );
  }
}
