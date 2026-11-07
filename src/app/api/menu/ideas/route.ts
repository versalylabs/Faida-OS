import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ValidationError, badRequest, idOf, must, num, readBody, str } from "@/lib/validate";

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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error fetching meal ideas:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch meal ideas" },
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

    const body = await readBody(req);
    const { title, mealType, description, calories, prepTime, tags } = body;

    const cleanTitle = must(str(title, { max: 200, required: true }), "Meal title is required (max 200 characters)");
    const cleanMealType = must(str(mealType, { max: 20 }), "Invalid mealType") ?? "ANY";
    const cleanDescription = must(str(description, { max: 2000 }), "Description is too long");
    const cleanCalories = must(num(calories, { min: 0, max: 20000, int: true }), "Calories must be a whole number between 0 and 20000");
    const cleanPrep = must(num(prepTime, { min: 0, max: 1440, int: true }), "Prep time must be a whole number of minutes between 0 and 1440");
    const cleanTags = must(str(tags, { max: 300 }), "Tags are too long");

    const created = await prisma.mealIdea.create({
      data: {
        userId: user.id,
        title: cleanTitle,
        mealType: cleanMealType,
        description: cleanDescription,
        calories: cleanCalories,
        prepTime: cleanPrep,
        tags: cleanTags,
      },
    });

    return NextResponse.json({ success: true, idea: created });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error creating meal idea:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create meal idea" },
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

    const body = await readBody(req);
    const { id, title, mealType, description, calories, prepTime, tags } = body;

    const ideaId = must(idOf(id), "Idea ID is required");
    const patchTitle = title !== undefined ? must(str(title, { max: 200, required: true }), "Meal title is required (max 200 characters)") : undefined;
    const patchMealType = mealType !== undefined ? must(str(mealType, { max: 20, required: true }), "Invalid mealType") : undefined;
    const patchDescription = description !== undefined ? must(str(description, { max: 2000 }), "Description is too long") : undefined;
    const patchCalories = calories !== undefined ? must(num(calories, { min: 0, max: 20000, int: true }), "Calories must be a whole number between 0 and 20000") : undefined;
    const patchPrep = prepTime !== undefined ? must(num(prepTime, { min: 0, max: 1440, int: true }), "Prep time must be a whole number of minutes between 0 and 1440") : undefined;
    const patchTags = tags !== undefined ? must(str(tags, { max: 300 }), "Tags are too long") : undefined;

    const existing = await prisma.mealIdea.findFirst({
      where: { id: ideaId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Meal idea not found" }, { status: 404 });
    }
    const updated = await prisma.mealIdea.update({
      where: { id: ideaId },
      data: {
        title: patchTitle !== undefined ? patchTitle : existing.title,
        mealType: patchMealType !== undefined ? patchMealType : existing.mealType,
        description: patchDescription !== undefined ? patchDescription : existing.description,
        calories: patchCalories !== undefined ? patchCalories : existing.calories,
        prepTime: patchPrep !== undefined ? patchPrep : existing.prepTime,
        tags: patchTags !== undefined ? patchTags : existing.tags,
      },
    });

    return NextResponse.json({ success: true, idea: updated });
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error updating meal idea:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update meal idea" },
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
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error("Error deleting meal idea:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete meal idea" },
      { status: 500 }
    );
  }
}
