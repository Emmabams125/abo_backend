-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO');

-- AlterTable
ALTER TABLE "community_alerts" ADD COLUMN "mediaUrl" TEXT,
ADD COLUMN "mediaType" "MediaType";

-- AlterTable
ALTER TABLE "sos_events" ADD COLUMN "videoUrl" TEXT;
