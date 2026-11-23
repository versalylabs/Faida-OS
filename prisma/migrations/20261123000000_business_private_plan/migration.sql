-- CreateTable
CREATE TABLE "BusinessPrivatePlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPrivatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPrivatePlan_businessId_key" ON "BusinessPrivatePlan"("businessId");

-- CreateIndex
CREATE INDEX "BusinessPrivatePlan_userId_idx" ON "BusinessPrivatePlan"("userId");

-- AddForeignKey
ALTER TABLE "BusinessPrivatePlan" ADD CONSTRAINT "BusinessPrivatePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPrivatePlan" ADD CONSTRAINT "BusinessPrivatePlan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
