-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "studentId" INTEGER;
