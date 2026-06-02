const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../upload');
const router = express.Router();

async function courseAccess(courseId, user) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { course: null, allowed: false, isOwner: false };
  const isOwner = user.role === 'TEACHER' && course.teacherId === user.userId;
  let allowed = isOwner;
  if (!allowed && user.role === 'STUDENT') {
    const enr = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId: user.userId } },
    });
    allowed = !!enr;
  }
  return { course, allowed, isOwner };
}

function removePhysicalFile(filePath) {
  const abs = path.join(__dirname, '..', '..', filePath.replace(/^\/+/, ''));
  fs.unlink(abs, () => {});
}

async function nextOrderInSection(sectionId) {
  const lastP = await prisma.project.findFirst({ where: { sectionId }, orderBy: { order: 'desc' } });
  const lastM = await prisma.material.findFirst({ where: { sectionId }, orderBy: { order: 'desc' } });
  return Math.max(lastP?.order ?? -1, lastM?.order ?? -1) + 1;
}

router.get('/', authenticate, async (req, res) => {
  try {
    const courseId = Number(req.query.courseId);
    const { course, allowed, isOwner } = await courseAccess(courseId, req.user);
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
    const where = { courseId };
    if (!isOwner) where.section = { hidden: false, OR: [{ openAt: null }, { openAt: { lte: new Date() } }] };
    const materials = await prisma.material.findMany({
      where,
      include: { files: true, section: { select: { id: true, name: true, order: true } } },
      orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }],
    });
    res.json(materials);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.post('/', authenticate, requireRole('TEACHER'), upload.array('files'), async (req, res) => {
  try {
    const { title, description, sectionId, type, url } = req.body;
    if (!title || !sectionId) return res.status(400).json({ error: 'Потрібні title і sectionId' });
    const section = await prisma.section.findUnique({ where: { id: Number(sectionId) }, include: { course: true } });
    if (!section) return res.status(404).json({ error: 'Розділ не знайдено' });
    if (section.course.teacherId !== req.user.userId) return res.status(403).json({ error: 'Це не ваш курс' });

    const mtype = ['INFO', 'FILES', 'LINK'].includes(type) ? type : 'INFO';
    const order = await nextOrderInSection(section.id);

    const material = await prisma.material.create({
      data: {
        title,
        description: description || null,
        type: mtype,
        url: mtype === 'LINK' ? (url || null) : null,
        order,
        sectionId: section.id,
        courseId: section.courseId,
        uploadedById: req.user.userId,
        files: mtype === 'FILES'
          ? {
              create: (req.files || []).map((f) => ({
                fileName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
                filePath: `/uploads/${f.filename}`,
              })),
            }
          : undefined,
      },
      include: { files: true },
    });
    res.status(201).json(material);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.patch('/:id', authenticate, requireRole('TEACHER'), upload.array('files'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const material = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!material) return res.status(404).json({ error: 'Матеріал не знайдено' });
    if (material.course.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш курс' });
    }
    const { title, description, removeFileIds, type, url } = req.body;
    if (removeFileIds) {
      const ids = JSON.parse(removeFileIds);
      const files = await prisma.materialFile.findMany({ where: { id: { in: ids }, materialId: id } });
      files.forEach((f) => removePhysicalFile(f.filePath));
      await prisma.materialFile.deleteMany({ where: { id: { in: ids }, materialId: id } });
    }
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description || null;
    if (type !== undefined && ['INFO', 'FILES', 'LINK'].includes(type)) data.type = type;
    if (url !== undefined) data.url = url || null;
    if (req.files && req.files.length > 0) {
      data.files = {
        create: req.files.map((f) => ({ fileName: Buffer.from(f.originalname, 'latin1').toString('utf8'), filePath: `/uploads/${f.filename}` })),
      };
    }
    const updated = await prisma.material.update({ where: { id }, data, include: { files: true } });
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.delete('/:id', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const material = await prisma.material.findUnique({ where: { id }, include: { course: true, files: true } });
    if (!material) return res.status(404).json({ error: 'Матеріал не знайдено' });
    if (material.course.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш курс' });
    }
    material.files.forEach((f) => removePhysicalFile(f.filePath));
    await prisma.material.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/files/:fileId/download', async (req, res) => {
  try {
    const fileId = Number(req.params.fileId);
    const file = await prisma.materialFile.findUnique({ where: { id: fileId } });
    if (!file) return res.status(404).json({ error: 'Файл не знайдено' });
    const abs = path.join(__dirname, '..', '..', file.filePath.replace(/^\/+/, ''));
    res.download(abs, file.fileName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;