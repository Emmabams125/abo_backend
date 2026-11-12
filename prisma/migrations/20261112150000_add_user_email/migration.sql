-- AlterTable
ALTER TABLE "users" ADD COLUMN "email" TEXT;

-- AlterTable
ALTER TABLE "otp_challenges" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
