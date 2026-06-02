const express = require('express');
const prisma = require('../prismaClient');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();
const { notify, notifyMany } = require('../utils/notify');
const fs = require('fs');
const path = require('path');
const upload = require('../upload');

async function nextOrderInSection(sectionId) {
  const lastP = await prisma.project.findFirst({ where: { sectionId }, orderBy: { order: 'desc' } });
  const lastM = await prisma.material.findFirst({ where: { sectionId }, orderBy: { order: 'desc' } });
  return Math.max(lastP?.order ?? -1, lastM?.order ?? -1) + 1;
}

router.post('/', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const { name, description, deadline, sectionId, type, maxScore, openAt } = req.body;
    if (!name || !sectionId) {
      return res.status(400).json({ error: 'Потрібні name і sectionId' });
    }
    const section = await prisma.section.findUnique({ where: { id: Number(sectionId) }, include: { course: true } });
    if (!section) return res.status(404).json({ error: 'Розділ не знайдено' });
    if (section.course.teacherId !== req.user.userId) return res.status(403).json({ error: 'Це не ваш курс' });

    const order = await nextOrderInSection(section.id);
    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        deadline: deadline ? new Date(deadline) : null,
        openAt: openAt ? new Date(openAt) : null,
        type: type === 'SOLO' ? 'SOLO' : 'TEAM',
        maxScore: maxScore != null && maxScore !== '' ? Number(maxScore) : 100,
        order,
        sectionId: section.id,
        courseId: section.courseId,
        teacherId: req.user.userId,
      },
    });
    const isLocked = project.openAt && new Date(project.openAt) > new Date();
    if (!isLocked) {
      const enrolled = await prisma.enrollment.findMany({ where: { courseId: section.courseId }, select: { userId: true } });
      for (const e of enrolled) {
        await notify({
          userId: e.userId,
          type: 'NEW_PROJECT',
          title: `Новий проєкт: «${project.name}»`,
          link: `/projects/${project.id}`,
          dedupeKey: `new-proj:${project.id}:${e.userId}`,
        });
      }
    }
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/', authenticate, async (req, res) => {
  const { courseId } = req.query;
  const where = {};
  if (courseId) where.courseId = Number(courseId);
  if (req.user.role === 'TEACHER') {
    where.teacherId = req.user.userId;
  } else {
    where.course = { enrollments: { some: { userId: req.user.userId } } };
    where.section = { hidden: false, OR: [{ openAt: null }, { openAt: { lte: new Date() } }] };
  }
  const projects = await prisma.project.findMany({
    where,
    include: {
      course: { select: { id: true, name: true } },
      section: { select: { id: true, name: true, order: true } },
    },
    orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }],
  });

  if (req.user.role === 'STUDENT') {
    const projectIds = projects.map((p) => p.id);
    const myTeams = await prisma.team.findMany({
      where: { projectId: { in: projectIds }, members: { some: { userId: req.user.userId } } },
      select: { projectId: true, status: true, submittedAt: true },
    });
    const submittedSet = new Set();
    const submitTime = {};
    myTeams.filter((t) => t.status === 'SUBMITTED').forEach((t) => {
      submittedSet.add(t.projectId);
      if (t.submittedAt) submitTime[t.projectId] = t.submittedAt;
    });
    const mySubs = await prisma.submission.findMany({
      where: { projectId: { in: projectIds }, studentId: req.user.userId, submitted: true },
      select: { projectId: true, submittedAt: true },
    });
    mySubs.forEach((s) => {
      submittedSet.add(s.projectId);
      const prev = submitTime[s.projectId];
      if (!prev || s.submittedAt > prev) submitTime[s.projectId] = s.submittedAt;
    });
    const now = new Date();
    return res.json(projects.map((p) => {
      const st = submitTime[p.id];
      return {
        ...p,
        submitted: submittedSet.has(p.id),
        submittedLate: !!(st && p.deadline && new Date(st) > new Date(p.deadline)),
        locked: p.openAt ? new Date(p.openAt) > now : false,
      };
    }));
  }

  res.json(projects);
});

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const project = await prisma.project.findUnique({
    where: { id },
    include: { course: { select: { id: true, name: true } }, section: true, attachments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
  let allowed = req.user.role === 'TEACHER' && project.teacherId === req.user.userId;
  if (!allowed && req.user.role === 'STUDENT') {
    const enr = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: project.courseId, userId: req.user.userId } },
    });
    allowed = !!enr;
    if (allowed && project.section) {
      const s = project.section;
      if (s.hidden || (s.openAt && new Date(s.openAt) > new Date())) allowed = false;
    }
    if (req.user.role === 'STUDENT' && project.openAt && new Date(project.openAt) > new Date()) {
      return res.json({ id: project.id, name: project.name, type: project.type, openAt: project.openAt, locked: true, course: { id: project.courseId } });
    }
  }
  if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
  res.json(project);
});

router.delete('/:id', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (project.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш проєкт' });
    }
    await prisma.project.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.patch('/:id', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (project.teacherId !== req.user.userId) return res.status(403).json({ error: 'Це не ваш проєкт' });
    const { name, description, deadline, maxScore, openAt } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
    if (maxScore !== undefined && maxScore !== '') data.maxScore = Number(maxScore);
    if (openAt !== undefined) data.openAt = openAt ? new Date(openAt) : null;
    const updated = await prisma.project.update({ where: { id }, data });
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.post('/:id/attachments', authenticate, upload.array('files'), async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!(req.user.role === 'TEACHER' && project.teacherId === req.user.userId)) {
      return res.status(403).json({ error: 'Немає доступу' });
    }
    const { url } = req.body;
    const hasFiles = req.files && req.files.length > 0;
    const hasUrl = !!(url && url.trim());
    if (!hasFiles && !hasUrl) return res.status(400).json({ error: 'Додайте файл або посилання' });

    if (hasFiles) {
      await prisma.attachment.createMany({
        data: req.files.map((f) => ({
          fileName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
          filePath: `/uploads/${f.filename}`,
          projectId,
        })),
      });
    }
    if (hasUrl) {
      await prisma.attachment.create({ data: { fileName: url.trim(), url: url.trim(), projectId } });
    }
    const list = await prisma.attachment.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    res.status(201).json(list);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.delete('/attachments/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const att = await prisma.attachment.findUnique({ where: { id }, include: { project: true } });
    if (!att) return res.status(404).json({ error: 'Не знайдено' });
    if (!(req.user.role === 'TEACHER' && att.project.teacherId === req.user.userId)) {
      return res.status(403).json({ error: 'Немає доступу' });
    }
    if (att.filePath) {
      const abs = path.join(__dirname, '..', '..', att.filePath.replace(/^\/+/, ''));
      fs.unlink(abs, () => {});
    }
    await prisma.attachment.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/attachments/:id/download', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const att = await prisma.attachment.findUnique({ where: { id } });
    if (!att || !att.filePath) return res.status(404).json({ error: 'Файл не знайдено' });
    const abs = path.join(__dirname, '..', '..', att.filePath.replace(/^\/+/, ''));
    res.download(abs, att.fileName);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

module.exports = router;