/*
  Warnings:

  - You are about to drop the column `filePath` on the `Material` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `Material` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Material` table. All the data in the column will be lost.
  - You are about to drop the `ActivityLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChatMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Material" DROP CONSTRAINT "Material_projectId_fkey";

-- AlterTable
ALTER TABLE "Material" DROP COLUMN "filePath",
DROP COLUMN "projectId",
DROP COLUMN "url";

-- DropTable
DROP TABLE "ActivityLog";

-- DropTable
DROP TABLE "ChatMessage";
