-- CreateTable
CREATE TABLE "Rule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "condition" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Rule_tenantId_idx" ON "Rule"("tenantId");
CREATE INDEX "Rule_tenantId_priority_idx" ON "Rule"("tenantId", "priority");

