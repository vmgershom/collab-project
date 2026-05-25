/*
  Warnings:

  - You are about to drop the column `status` on the `Project` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'SUBMITTED');

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropEnum
DROP TYPE "ProjectStatus";
