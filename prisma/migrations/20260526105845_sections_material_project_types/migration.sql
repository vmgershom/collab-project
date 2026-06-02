/*
  Warnings:

  - Added the required column `sectionId` to the `Material` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('INFO', 'FILES', 'LINK');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('TEAM', 'SOLO');

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sectionId" INTEGER NOT NULL,
ADD COLUMN     "type" "MaterialType" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "maxScore" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sectionId" INTEGER NOT NULL,
ADD COLUMN     "type" "ProjectType" NOT NULL DEFAULT 'TEAM';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "projectId" INTEGER,
ADD COLUMN     "url" TEXT;

-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "openAt" TIMESTAMP(3),
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
