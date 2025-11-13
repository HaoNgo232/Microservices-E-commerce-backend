-- CreateTable
CREATE TABLE "ReportEntry" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "fromAt" TIMESTAMP(3),
    "toAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportEntry_pkey" PRIMARY KEY ("id")
);
