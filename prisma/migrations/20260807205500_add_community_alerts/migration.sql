-- CreateEnum
CREATE TYPE "CommunityAlertKind" AS ENUM ('MISSING', 'LOST_ITEM', 'HAZARD');

-- CreateEnum
CREATE TYPE "CommunityAlertStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXPIRED');

-- CreateTable
CREATE TABLE "community_alerts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "CommunityAlertKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "placeLabel" TEXT NOT NULL,
    "status" "CommunityAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "location" geography(Point, 4326) NOT NULL,

    CONSTRAINT "community_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_alerts_authorId_idx" ON "community_alerts"("authorId");

-- CreateIndex
CREATE INDEX "community_alerts_status_expiresAt_idx" ON "community_alerts"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "community_alerts_location_idx" ON "community_alerts" USING GIST ("location");

-- AddForeignKey
ALTER TABLE "community_alerts" ADD CONSTRAINT "community_alerts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
