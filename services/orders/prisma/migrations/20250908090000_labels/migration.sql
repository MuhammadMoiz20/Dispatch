-- CreateTable Label
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Label_tenantId_idx" ON "Label"("tenantId");
CREATE UNIQUE INDEX "Label_returnId_key" ON "Label"("returnId");
