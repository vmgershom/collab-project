const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { getTeamAccess } = require('../utils/access');
const upload = require('../upload');
const { notify, notifyMany } = require('../utils/notify');

const router = express.Router();

function removePhysicalFile(filePath) {
  if (!filePath) return;
  const abs = path.join(__dirname, '..', '..', filePath.replace(/^\/+/, ''));
  fs.unlink(abs, () => {});
}
const decode = (name) => Buffer.from(name, 'latin1').toString('utf8');

router.post('/task/:taskId', authenticate, upload.array('files'), async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });
    const { team } = await getTeamAccess(task.teamId, req.user);
    const isMember = team.members.some((m) => m.userId === req.user.userId);
    if (!isMember) return res.status(403).json({ error: 'Завантажувати можуть лише учасники команди' });

    const { url } = req.body;
    if (req.files && req.files.length) {
      await prisma.submission.createMany({
        data: req.files.map((f) => ({
          fileName: decode(f.originalname),
          filePath: `/uploads/${f.filename}`,
          taskId,
          studentId: req.user.userId,
        })),
      });
    }
    if (url && url.trim()) {
      await prisma.submission.create({ data: { fileName: url.trim(), url: url.trim(), taskId, studentId: req.user.userId } });
    }
    const files = await prisma.submission.findMany({ where: { taskId }, orderBy: { submittedAt: 'asc' } });
    res.status(201).json(files);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/task/:taskId', authenticate, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });
    const { allowed } = await getTeamAccess(task.teamId, req.user);
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
    const files = await prisma.submission.findMany({
      where: { taskId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    res.json(files);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.post('/team/:teamId', authenticate, upload.array('files'), async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    const { team } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
    const isMember = team.members.some((m) => m.userId === req.user.userId);
    if (!isMember) return res.status(403).json({ error: 'Завантажувати можуть лише учасники команди' });

    const { url } = req.body;
    if (req.files && req.files.length) {
      await prisma.submission.createMany({
        data: req.files.map((f) => ({
          fileName: decode(f.originalname),
          filePath: `/uploads/${f.filename}`,
          teamId,
          studentId: req.user.userId,
        })),
      });
    }
    if (url && url.trim()) {
      await prisma.submission.create({ data: { fileName: url.trim(), url: url.trim(), teamId, studentId: req.user.userId } });
    }
    const files = await prisma.submission.findMany({ where: { teamId }, orderBy: { submittedAt: 'asc' } });
    res.status(201).json(files);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/team/:teamId', authenticate, async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    const { team, allowed } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
    const files = await prisma.submission.findMany({
      where: { teamId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    res.json(files);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

async function projectFor(projectId) {
  return prisma.project.findUnique({ where: { id: projectId }, include: { course: true } });
}
async function isEnrolled(courseId, userId) {
  const e = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId } } });
  return !!e;
}

router.get('/project/:projectId/my', authenticate, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const project = await projectFor(projectId);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!(await isEnrolled(project.courseId, req.user.userId))) return res.status(403).json({ error: 'Немає доступу' });
    const rows = await prisma.submission.findMany({ where: { projectId, studentId: req.user.userId }, orderBy: { submittedAt: 'asc' } });
    const submittedRows = rows.filter((r) => r.submitted);
    const lastAt = submittedRows.length ? submittedRows[submittedRows.length - 1].submittedAt : null;
    res.json({ files: rows.filter((r) => r.filePath), links: rows.filter((r) => r.url && !r.filePath), submitted: submittedRows.length > 0, lastAt });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.post('/project/:projectId', authenticate, upload.array('files'), async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const project = await projectFor(projectId);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!(await isEnrolled(project.courseId, req.user.userId))) return res.status(403).json({ error: 'Немає доступу' });
    const { url } = req.body;
    const hasFiles = req.files && req.files.length > 0;
    const hasUrl = !!(url && url.trim());
    const existing = await prisma.submission.count({ where: { projectId, studentId: req.user.userId } });
    if (!hasFiles && !hasUrl && existing === 0) {
      return res.status(400).json({ error: 'Додайте файл або посилання' });
    }
    if (hasFiles) {
      await prisma.submission.createMany({
        data: req.files.map((f) => ({ fileName: decode(f.originalname), filePath: `/uploads/${f.filename}`, projectId, studentId: req.user.userId })),
      });
    }
    if (url && url.trim()) {
      await prisma.submission.create({ data: { fileName: url.trim(), url: url.trim(), projectId, studentId: req.user.userId } });
    }

    await prisma.submission.updateMany({
      where: { projectId, studentId: req.user.userId },
      data: { submitted: true },
    });
    const student = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });
    const late = project.deadline && new Date() > new Date(project.deadline);
    await notify({
      userId: project.teacherId,
      type: 'SUBMISSION',
      title: `${student?.name || 'Студент'} здав проєкт «${project.name}»${late ? ' (із запізненням)' : ''}`,
      link: `/projects/${projectId}`,
    });
    const rows = await prisma.submission.findMany({ where: { projectId, studentId: req.user.userId }, orderBy: { submittedAt: 'asc' } });
    const submittedRows = rows.filter((r) => r.submitted);
    const lastAt = submittedRows.length ? submittedRows[submittedRows.length - 1].submittedAt : null;
    res.status(201).json({ files: rows.filter((r) => r.filePath), links: rows.filter((r) => r.url && !r.filePath), submitted: submittedRows.length > 0, lastAt });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const project = await projectFor(projectId);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!(req.user.role === 'TEACHER' && project.course.teacherId === req.user.userId)) {
      return res.status(403).json({ error: 'Немає доступу' });
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: project.courseId },
      include: { user: { select: { id: true, name: true } } },
    });
    const subs = await prisma.submission.findMany({ where: { projectId, submitted: true }, orderBy: { submittedAt: 'asc' } });
    const students = enrollments
      .map((e) => {
        const rows = subs.filter((s) => s.studentId === e.user.id);
        return {
          id: e.user.id,
          name: e.user.name,
          files: rows.filter((r) => r.filePath),
          links: rows.filter((r) => r.url && !r.filePath),
          lastAt: rows.length ? rows[rows.length - 1].submittedAt : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    res.json({ students });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.put('/project/:projectId/cancel', authenticate, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const project = await projectFor(projectId);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!(await isEnrolled(project.courseId, req.user.userId))) return res.status(403).json({ error: 'Немає доступу' });
    await prisma.submission.updateMany({
      where: { projectId, studentId: req.user.userId },
      data: { submitted: false },
    });
    const rows = await prisma.submission.findMany({ where: { projectId, studentId: req.user.userId }, orderBy: { submittedAt: 'asc' } });
    res.json({ files: rows.filter((r) => r.filePath), links: rows.filter((r) => r.url && !r.filePath), submitted: false, lastAt: null });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const file = await prisma.submission.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ error: 'Елемент не знайдено' });

    if (file.projectId && !file.teamId && !file.taskId) {
      const project = await prisma.project.findUnique({ where: { id: file.projectId }, include: { course: true } });
      const isOwner = file.studentId === req.user.userId;
      const isTeacher = req.user.role === 'TEACHER' && project?.course.teacherId === req.user.userId;
      if (!isOwner && !isTeacher) return res.status(403).json({ error: 'Немає доступу' });
      removePhysicalFile(file.filePath);
      await prisma.submission.delete({ where: { id } });
      return res.json({ deleted: true });
    }

    const teamId = file.teamId || (await prisma.task.findUnique({ where: { id: file.taskId } }))?.teamId;
    const { team } = await getTeamAccess(teamId, req.user);
    const isMember = team && team.members.some((m) => m.userId === req.user.userId);
    if (!isMember) return res.status(403).json({ error: 'Видаляти можуть лише учасники команди' });
    removePhysicalFile(file.filePath);
    await prisma.submission.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/files/:id/download', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const file = await prisma.submission.findUnique({ where: { id } });
    if (!file || !file.filePath) return res.status(404).json({ error: 'Файл не знайдено' });
    const abs = path.join(__dirname, '..', '..', file.filePath.replace(/^\/+/, ''));
    res.download(abs, file.fileName);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

module.exports = router;