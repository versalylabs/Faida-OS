import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function init() {
  const mCount = await prisma.maintenanceItem.count();
  if (mCount === 0) {
    const now = new Date();
    await prisma.maintenanceItem.createMany({
      data: [
        { area: "COMPUTER", title: "Clean storage & empty downloads folder", frequencyDays: 14, nextDueAt: new Date(now.getTime() + 3 * 86400000) },
        { area: "HOME", title: "Clean workspace & organize physical desk", frequencyDays: 7, nextDueAt: new Date(now.getTime() + 1 * 86400000) },
        { area: "DEV", title: "Review dependencies & prune merged git branches", frequencyDays: 30, nextDueAt: new Date(now.getTime() + 12 * 86400000) },
        { area: "PERSONAL_ADMIN", title: "Review subscriptions & monthly bank statement", frequencyDays: 30, nextDueAt: new Date(now.getTime() + 8 * 86400000) },
      ],
    });
    console.log("Seeded maintenance items");
  }

  const sCount = await prisma.shoppingItem.count();
  if (sCount === 0) {
    await prisma.shoppingItem.createMany({
      data: [
        { name: "Colgate Herbal Toothpaste", category: "Personal Care", preferredStore: "Pharmacy", estimatedPrice: 280 },
        { name: "HDMI 2.1 4K Ultra Cable (2m)", category: "Tech", preferredStore: "Computer Shop", estimatedPrice: 1500 },
        { name: "Fresh Whole Milk (2L)", category: "Groceries", preferredStore: "Supermarket", estimatedPrice: 260 },
      ],
    });
    console.log("Seeded shopping items");
  }
}

init()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
