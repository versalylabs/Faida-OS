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

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const DEFAULT_WEEKLY_MEALS = [
  // Monday
  {
    dayOfWeek: "MONDAY",
    mealType: "BREAKFAST",
    title: "Oatmeal with Sliced Bananas, Chia Seeds & Honey",
    description: "Rolled oats cooked in warm milk, topped with sliced bananas, chia seeds, and pure honey.",
    calories: 380,
    prepTime: 12,
    tags: "High Fiber, Quick Prep, Energizing",
  },
  {
    dayOfWeek: "MONDAY",
    mealType: "LUNCH",
    title: "Chicken Curry with Steamed Basmati Rice & Broccoli",
    description: "Tender chicken breast in rich onion-tomato curry sauce, served with basmati rice and steamed greens.",
    calories: 620,
    prepTime: 30,
    tags: "High Protein, Balanced, Savory",
  },
  {
    dayOfWeek: "MONDAY",
    mealType: "SUPPER",
    title: "Ugali with Sautéed Sukuma Wiki & Pan-Seared Beef",
    description: "Traditional cornmeal ugali served with fresh collard greens and tender seasoned beef strips.",
    calories: 680,
    prepTime: 35,
    tags: "Kenyan Classic, Filling, Iron Rich",
  },

  // Tuesday
  {
    dayOfWeek: "TUESDAY",
    mealType: "BREAKFAST",
    title: "Spanish Omelette, Toasted Brown Bread & Spiced Chai",
    description: "Two eggs whisked with diced onions, tomatoes, and bell peppers; served with toasted bread.",
    calories: 410,
    prepTime: 15,
    tags: "High Protein, Fresh, Quick",
  },
  {
    dayOfWeek: "TUESDAY",
    mealType: "LUNCH",
    title: "Beef Stir-Fry Noodles with Bell Peppers & Carrots",
    description: "Egg noodles tossed with lean strips of beef, soy sauce, garlic, and crisp seasonal vegetables.",
    calories: 580,
    prepTime: 25,
    tags: "Fast Prep, Savory, Balanced",
  },
  {
    dayOfWeek: "TUESDAY",
    mealType: "SUPPER",
    title: "Soft Chapati with Ndengu (Green Grams) & Sliced Avocado",
    description: "Warm handmade chapati served with hearty cumin-spiced green grams stew and fresh avocado.",
    calories: 640,
    prepTime: 40,
    tags: "Fiber Rich, Plant Protein, Comfort Food",
  },

  // Wednesday
  {
    dayOfWeek: "WEDNESDAY",
    mealType: "BREAKFAST",
    title: "Greek Yogurt Parfait with Granola, Walnuts & Berries",
    description: "Creamy yogurt layered with crunchy toasted granola, crushed walnuts, and honey.",
    calories: 360,
    prepTime: 8,
    tags: "Probiotic, Light, No-Cook",
  },
  {
    dayOfWeek: "WEDNESDAY",
    mealType: "LUNCH",
    title: "Pan-Seared Fish Fillet with Roasted Herb Potatoes",
    description: "Seasoned tilapia or red snapper fillet with lemon pepper, served with roasted herb potato cubes.",
    calories: 520,
    prepTime: 30,
    tags: "Lean Protein, Omega-3, Clean",
  },
  {
    dayOfWeek: "WEDNESDAY",
    mealType: "SUPPER",
    title: "Creamy Garlic, Tomato & Basil Penne Pasta with Beef",
    description: "Al dente penne pasta coated in rich herb tomato sauce with savory minced beef and parmesan.",
    calories: 650,
    prepTime: 28,
    tags: "Italian Classic, Comfort Food, Hearty",
  },

  // Thursday
  {
    dayOfWeek: "THURSDAY",
    mealType: "BREAKFAST",
    title: "Scrambled Eggs with Sautéed Spinach & Whole Wheat Toast",
    description: "Fluffy buttery eggs served over baby spinach with toasted whole wheat bread.",
    calories: 390,
    prepTime: 12,
    tags: "Low Carb, Nutrient Dense, Fast",
  },
  {
    dayOfWeek: "THURSDAY",
    mealType: "LUNCH",
    title: "Steamed Rice with Yellow Lentil Dhal Curry & Slaw",
    description: "Fragrant turmeric and cumin tempered lentils over white rice with fresh lime-tossed cabbage slaw.",
    calories: 510,
    prepTime: 25,
    tags: "Plant Based, Gentle Digestion, Warm",
  },
  {
    dayOfWeek: "THURSDAY",
    mealType: "SUPPER",
    title: "Ugali with Fried Tilapia Fish & Fresh Tomato Kachumbari",
    description: "Crispy fried lake tilapia paired with piping hot ugali and zesty lemon-coriander kachumbari.",
    calories: 720,
    prepTime: 35,
    tags: "Lakeside Classic, High Protein, Special",
  },

  // Friday
  {
    dayOfWeek: "FRIDAY",
    mealType: "BREAKFAST",
    title: "Fluffy Pancakes with Maple Syrup, Strawberries & Tea",
    description: "Golden buttermilk pancakes drizzled with syrup and served with cardamom spiced milk tea.",
    calories: 460,
    prepTime: 20,
    tags: "Friday Treat, Sweet & Warm, Comfort",
  },
  {
    dayOfWeek: "FRIDAY",
    mealType: "LUNCH",
    title: "Chicken Shawarma Wrap with Garlic Sauce & Pickles",
    description: "Spiced marinated grilled chicken strips rolled in pita bread with crisp lettuce and garlic sauce.",
    calories: 590,
    prepTime: 20,
    tags: "Fast & Tasty, Portable, High Protein",
  },
  {
    dayOfWeek: "FRIDAY",
    mealType: "SUPPER",
    title: "Beef Pilau with Fresh Kachumbari & Sliced Banana",
    description: "Aromatic Swahili spiced rice cooked with tender cubed beef, cinnamon, cloves, and cardamom.",
    calories: 710,
    prepTime: 45,
    tags: "Swahili Delicacy, Friday Special, Fragrant",
  },

  // Saturday
  {
    dayOfWeek: "SATURDAY",
    mealType: "BREAKFAST",
    title: "Boiled Sweet Potatoes (Ngwaci), Boiled Eggs & Tea",
    description: "Steamed organic sweet potatoes served with two boiled eggs and fresh ginger milk tea.",
    calories: 430,
    prepTime: 25,
    tags: "Traditional Wholesome, Complex Carbs, Clean",
  },
  {
    dayOfWeek: "SATURDAY",
    mealType: "LUNCH",
    title: "Fried Githeri (Corn & Beans) with Potatoes & Avocado",
    description: "Boiled maize and beans sautéed with onions, garlic, potatoes, tomatoes, and spinach.",
    calories: 580,
    prepTime: 30,
    tags: "High Fiber, Sustained Energy, Kenyan Staple",
  },
  {
    dayOfWeek: "SATURDAY",
    mealType: "SUPPER",
    title: "BBQ Grilled Chicken Thighs with Potato Wedges & Salad",
    description: "Smoky seasoned chicken thighs baked until crisp, served with spiced potato wedges.",
    calories: 690,
    prepTime: 45,
    tags: "Weekend Feast, Finger Food, Savory",
  },

  // Sunday
  {
    dayOfWeek: "SUNDAY",
    mealType: "BREAKFAST",
    title: "Full Sunday Breakfast: Fried Eggs, Sausages & Baked Beans",
    description: "Sunny-side up eggs, grilled beef sausages, rich baked beans, and buttered toast.",
    calories: 560,
    prepTime: 20,
    tags: "Hearty Sunday, High Protein, Weekend",
  },
  {
    dayOfWeek: "SUNDAY",
    mealType: "LUNCH",
    title: "Roast Goat Ribs (Nyama Choma) with Ugali & Kachumbari",
    description: "Slow-roasted tender goat ribs served with chili kachumbari and hot cornmeal ugali.",
    calories: 780,
    prepTime: 50,
    tags: "Nyama Choma, Sunday Legend, Celebration",
  },
  {
    dayOfWeek: "SUNDAY",
    mealType: "SUPPER",
    title: "Light Cream of Butternut Squash Soup with Herb Bread",
    description: "Velvety roasted butternut squash blended with ginger, nutmeg, and cream, served with crusty bread.",
    calories: 410,
    prepTime: 25,
    tags: "Light Supper, Easy Digestion, Relaxing",
  },
];

function getDayOfWeekName(): string {
  const dayIndex = new Date().getDay();
  // JS getDay(): 0 = Sunday, 1 = Monday, 2 = Tuesday, ...
  const map = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
  return map[dayIndex];
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day"); // optional: specific day e.g. "MONDAY" or "TODAY"

    let meals = await prisma.mealPlanItem.findMany({
      where: { userId: user.id },
      orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
    });

    // Auto-seed default healthy menu if user has 0 meals
    if (meals.length === 0) {
      for (const item of DEFAULT_WEEKLY_MEALS) {
        await prisma.mealPlanItem.create({
          data: {
            userId: user.id,
            dayOfWeek: item.dayOfWeek,
            mealType: item.mealType,
            title: item.title,
            description: item.description,
            calories: item.calories,
            prepTime: item.prepTime,
            tags: item.tags,
            isCompleted: false,
          },
        });
      }

      meals = await prisma.mealPlanItem.findMany({
        where: { userId: user.id },
        orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
      });
    }

    const currentDayName = getDayOfWeekName();
    const todayMeals = meals.filter((m) => m.dayOfWeek === currentDayName);

    if (day && day.toUpperCase() === "TODAY") {
      return NextResponse.json(
        {
          success: true,
          currentDay: currentDayName,
          todayMeals,
        },
        { headers: noCacheHeaders }
      );
    }

    if (day && DAYS_OF_WEEK.includes(day.toUpperCase())) {
      const specificMeals = meals.filter(
        (m) => m.dayOfWeek === day.toUpperCase()
      );
      return NextResponse.json(
        {
          success: true,
          day: day.toUpperCase(),
          meals: specificMeals,
          currentDay: currentDayName,
        },
        { headers: noCacheHeaders }
      );
    }

    // Group meals by dayOfWeek for easy frontend consumption
    const groupedByDay: Record<string, Record<string, any>> = {};
    for (const d of DAYS_OF_WEEK) {
      groupedByDay[d] = {
        BREAKFAST: null,
        LUNCH: null,
        SUPPER: null,
      };
    }

    for (const m of meals) {
      if (groupedByDay[m.dayOfWeek]) {
        groupedByDay[m.dayOfWeek][m.mealType] = m;
      }
    }

    return NextResponse.json(
      {
        success: true,
        meals,
        groupedByDay,
        currentDay: currentDayName,
        todayMeals,
        totalMealsCount: meals.length,
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    console.error("Error in GET /api/menu:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load meal plan" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const body = await req.json();
    const { action, dayOfWeek, mealType, title, description, calories, prepTime, tags } = body;

    // Reset action
    if (action === "RESET") {
      await prisma.mealPlanItem.deleteMany({
        where: { userId: user.id },
      });

      for (const item of DEFAULT_WEEKLY_MEALS) {
        await prisma.mealPlanItem.create({
          data: {
            userId: user.id,
            dayOfWeek: item.dayOfWeek,
            mealType: item.mealType,
            title: item.title,
            description: item.description,
            calories: item.calories,
            prepTime: item.prepTime,
            tags: item.tags,
            isCompleted: false,
          },
        });
      }

      const freshMeals = await prisma.mealPlanItem.findMany({
        where: { userId: user.id },
        orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
      });

      return NextResponse.json(
        { success: true, message: "Reset to default weekly menu", meals: freshMeals },
        { headers: noCacheHeaders }
      );
    }

    if (!dayOfWeek || !mealType || !title) {
      return NextResponse.json(
        { success: false, error: "dayOfWeek, mealType, and title are required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const upperDay = dayOfWeek.toUpperCase();
    const upperMeal = mealType.toUpperCase();

    if (!DAYS_OF_WEEK.includes(upperDay)) {
      return NextResponse.json(
        { success: false, error: "Invalid dayOfWeek" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    if (!["BREAKFAST", "LUNCH", "SUPPER"].includes(upperMeal)) {
      return NextResponse.json(
        { success: false, error: "Invalid mealType" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // Upsert meal item for this slot
    const meal = await prisma.mealPlanItem.upsert({
      where: {
        userId_dayOfWeek_mealType: {
          userId: user.id,
          dayOfWeek: upperDay,
          mealType: upperMeal,
        },
      },
      create: {
        userId: user.id,
        dayOfWeek: upperDay,
        mealType: upperMeal,
        title: title.trim(),
        description: description?.trim() || null,
        calories: calories ? parseInt(calories, 10) : null,
        prepTime: prepTime ? parseInt(prepTime, 10) : null,
        tags: tags?.trim() || null,
        isCompleted: false,
      },
      update: {
        title: title.trim(),
        description: description?.trim() || null,
        calories: calories ? parseInt(calories, 10) : null,
        prepTime: prepTime ? parseInt(prepTime, 10) : null,
        tags: tags?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, meal }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error in POST /api/menu:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save meal" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const body = await req.json();
    const { id, title, description, calories, prepTime, tags, isCompleted } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Meal ID is required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const existing = await prisma.mealPlanItem.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Meal not found" },
        { status: 404, headers: noCacheHeaders }
      );
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (calories !== undefined)
      updateData.calories = calories ? parseInt(calories, 10) : null;
    if (prepTime !== undefined)
      updateData.prepTime = prepTime ? parseInt(prepTime, 10) : null;
    if (tags !== undefined) updateData.tags = tags?.trim() || null;
    if (isCompleted !== undefined) updateData.isCompleted = Boolean(isCompleted);

    const updated = await prisma.mealPlanItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, meal: updated }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("Error in PATCH /api/menu:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update meal" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Meal ID is required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const existing = await prisma.mealPlanItem.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Meal not found" },
        { status: 404, headers: noCacheHeaders }
      );
    }

    await prisma.mealPlanItem.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, message: "Meal deleted successfully" },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    console.error("Error in DELETE /api/menu:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete meal" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
