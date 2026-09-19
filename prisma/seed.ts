import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Faida OS Second Brain...");

  // 1. Ensure Melio Project
  let melio = await prisma.project.findFirst({ where: { name: "Melio" } });
  if (!melio) {
    melio = await prisma.project.create({
      data: {
        name: "Melio",
        description: "Restaurant reservation and management platform",
        color: "#6366f1",
        milestones: {
          create: [
            { title: "Core development", isDone: true, order: 0 },
            { title: "Functional testing", isDone: true, order: 1 },
            { title: "UI refinement", isDone: true, order: 2 },
            { title: "Production deployment", isDone: false, order: 3 },
          ],
        },
      },
    });
  }

  // 2. Ensure Faida OS Project
  let faida = await prisma.project.findFirst({ where: { name: "Faida OS" } });
  if (!faida) {
    faida = await prisma.project.create({
      data: {
        name: "Faida OS",
        description: "Personal Operating System, Second Brain & Assistant",
        color: "#3b82f6",
        milestones: {
          create: [
            { title: "Phase 0: Architecture & Foundation", isDone: true, order: 0 },
            { title: "Phase 1: Universal Capture & AI Router", isDone: true, order: 1 },
            { title: "Phase 2: Execution Engine & Daily Planner", isDone: true, order: 2 },
            { title: "Phase 3: Connected Second Brain & Learning Hub", isDone: true, order: 3 },
            { title: "Phase 4: Life Operations (Finance, Shopping, Maintenance)", isDone: false, order: 4 },
          ],
        },
      },
    });
  }

  // 3. Ensure Learning Subjects & Topics
  let dbSubject = await prisma.learningSubject.findFirst({
    where: { name: "Databases & Storage" },
    include: { topics: true },
  });
  if (!dbSubject) {
    dbSubject = await prisma.learningSubject.create({
      data: {
        name: "Databases & Storage",
        description: "Relational modeling, transaction isolation, and query optimization",
        icon: "Database",
        topics: {
          create: [
            { title: "PostgreSQL MVCC & Isolation Levels", status: "COMPLETED" },
            { title: "B-Tree & GIN Indexing Strategies", status: "IN_PROGRESS" },
            { title: "Prisma ORM Relations & Migration Hygiene", status: "COMPLETED" },
          ],
        },
      },
      include: { topics: true },
    });

    // Add a study session
    const mvccTopic = dbSubject.topics.find((t) => t.title.includes("MVCC"));
    if (mvccTopic) {
      await prisma.studySession.create({
        data: {
          topicId: mvccTopic.id,
          durationMinutes: 90,
          notes: "Studied snapshot isolation, tuple headers (xmin, xmax), and VACUUM behavior.",
        },
      });
    }
  }

  let fullstackSubject = await prisma.learningSubject.findFirst({ where: { name: "Modern Fullstack" } });
  if (!fullstackSubject) {
    await prisma.learningSubject.create({
      data: {
        name: "Modern Fullstack",
        description: "Next.js 15, React 19, TypeScript, and Tailwind CSS v4",
        icon: "Layers",
        topics: {
          create: [
            { title: "Next.js 15 App Router & Server Components", status: "COMPLETED" },
            { title: "React 19 Actions & useActionState", status: "IN_PROGRESS" },
            { title: "TypeScript Advanced Generics & Utility Types", status: "IN_PROGRESS" },
          ],
        },
      },
    });
  }

  // 4. Ensure Rich Notes in Knowledge Base
  let noteMvcc = await prisma.note.findFirst({ where: { title: { contains: "MVCC" } } });
  if (!noteMvcc) {
    await prisma.note.create({
      data: {
        title: "PostgreSQL MVCC & Concurrency Architecture",
        content: `PostgreSQL uses Multi-Version Concurrency Control (MVCC) to provide transaction isolation with minimal read-locking.

### Key Architectural Concepts:
1. **Tuple Visibility:** Every row header stores \`xmin\` (creation transaction ID) and \`xmax\` (deletion/update transaction ID).
2. **Snapshot Isolation:** Reads take a snapshot of active transactions at query or transaction start, seeing only committed versions.
3. **VACUUM:** Reclaims obsolete row versions (dead tuples) and prevents transaction ID wraparound.

### Relevance to Projects:
- **Melio:** Ensures concurrent table reservations never block analytics queries or read operations.`,
        category: "Databases",
        tags: "postgresql, mvcc, databases, melio, learning",
      },
    });
  }

  let noteNext = await prisma.note.findFirst({ where: { title: { contains: "Server Actions" } } });
  if (!noteNext) {
    await prisma.note.create({
      data: {
        title: "Next.js 15 Server Actions & Mutations",
        content: `Server Actions allow server-side data mutations directly from React components without building manual API endpoints.

### Best Practices:
- Co-locate action functions with UI components.
- Use \`revalidatePath\` or optimistic UI state for instant responsiveness.
- Protect endpoints with schema validation (Zod or TypeScript assertions).`,
        category: "Frontend",
        tags: "nextjs, react, fullstack, faida",
      },
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
