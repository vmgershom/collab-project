const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { getTeamAccess } = require('../utils/access');
const upload = require('../upload');

const router = express.Router();

function removePhysicalFile(filePath) {
  if (!filePath) return;
  const abs = path.join(__dirname, '..', '..', filePath.replace(/^\/+/, ''));
  fs.unlink(abs, () => {});
}
const decode = (name) => Buffer.from(name, 'latin1').toString('utf8');

// --- ФАЙЛИ ЗАВДАННЯ ---
router.post('/task/:taskId', authenticate, upload.array('files'), async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });
    const { team } = await getTeamAccess(task.teamId, req.user);
    const isMember = team.members.some((m) => m.userId === req.user.userId);
    if (!isMember) return res.status(403).json({ error: 'Завантажувати файли можуть лише учасники команди' });

    await prisma.submission.createMany({
      data: (req.files || []).map((f) => ({
        fileName: decode(f.originalname),
        filePath: `/uploads/${f.filename}`,
        taskId,
        studentId: req.user.userId,
      })),
    });
    const files = await prisma.submission.findMany({ where: { taskId }, orderBy: { submittedAt: 'asc' } });
    res.status(201).json(files);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/task/:taskId', authenticate, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });
    const { team, allowed } = await getTeamAccess(task.teamId, req.user);
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
    const files = await prisma.submission.findMany({
      where: { taskId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    res.json(files);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

// --- ФАЙЛИ КОМАНДИ (рівень проєкту) ---
router.post('/team/:teamId', authenticate, upload.array('files'), async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    const { team } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
    const isMember = team.members.some((m) => m.userId === req.user.userId);
    if (!isMember) return res.status(403).json({ error: 'Завантажувати файли можуть лише учасники команди' });

    await prisma.submission.createMany({
      data: (req.files || []).map((f) => ({
        fileName: decode(f.originalname),
        filePath: `/uploads/${f.filename}`,
        teamId,
        studentId: req.user.userId,
      })),
    });
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

// --- ВИДАЛИТИ ФАЙЛ (учасник команди) ---
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const file = await prisma.submission.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ error: 'Файл не знайдено' });
    const teamId = file.teamId || (await prisma.task.findUnique({ where: { id: file.taskId } }))?.teamId;
    const { team } = await getTeamAccess(teamId, req.user);
    const isMember = team && team.members.some((m) => m.userId === req.user.userId);
    if (!isMember) return res.status(403).json({ error: 'Видаляти можуть лише учасники команди' });
    removePhysicalFile(file.filePath);
    await prisma.submission.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

// --- ЗАВАНТАЖИТИ З ОРИГІНАЛЬНИМ ІМ'ЯМ ---
router.get('/files/:id/download', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const file = await prisma.submission.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ error: 'Файл не знайдено' });
    const abs = path.join(__dirname, '..', '..', file.filePath.replace(/^\/+/, ''));
    res.download(abs, file.fileName);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

module.exports = router;