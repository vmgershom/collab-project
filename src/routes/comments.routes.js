const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { getTeamAccess } = require('../utils/access');

const router = express.Router();

// доступ до проєкту: викладач-власник або записаний студент
async function getProjectAccess(projectId, user) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { project: null, allowed: false };
  let allowed = user.role === 'TEACHER' && project.teacherId === user.userId;
  if (!allowed && user.role === 'STUDENT') {
    const enr = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: project.courseId, userId: user.userId } },
    });
    allowed = !!enr;
  }
  return { project, allowed };
}

const authorSelect = { select: { id: true, name: true, role: true, avatar: true } };

// ===== КОМЕНТАРІ ПРОЄКТУ =====
router.post('/project', authenticate, async (req, res) => {
  try {
    const { projectId, content } = req.body;
    if (!projectId || !content) return res.status(400).json({ error: 'Потрібні projectId і content' });
    const { project, allowed } = await getProjectAccess(projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
    const comment = await prisma.comment.create({
      data: { content, projectId, authorId: req.user.userId },
      include: { author: authorSelect },
    });
    res.status(201).json(comment);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/project', authenticate, async (req, res) => {
  try {
    const projectId = Number(req.query.projectId);
    const { project, allowed } = await getProjectAccess(projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
    const comments = await prisma.comment.findMany({
      where: { projectId },
      include: { author: authorSelect },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

// ===== КОМЕНТАРІ КОМАНДИ (гілки = завдання + загальна) =====
router.post('/team', authenticate, async (req, res) => {
  try {
    const { teamId, taskId, content } = req.body;
    if (!teamId || !content) return res.status(400).json({ error: 'Потрібні teamId і content' });
    const { team, allowed } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });

    if (taskId) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task || task.teamId !== teamId) {
        return res.status(400).json({ error: 'Завдання не належить цій команді' });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        authorId: req.user.userId,
        taskId: taskId || null,
        teamId: taskId ? null : teamId, // гілка-завдання → taskId; загальна → teamId
      },
      include: { author: authorSelect, task: { select: { id: true, title: true } } },
    });
    res.status(201).json(comment);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/team', authenticate, async (req, res) => {
  try {
    const teamId = Number(req.query.teamId);
    const taskId = req.query.taskId ? Number(req.query.taskId) : null;
    const { team, allowed } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });

    let where;
    if (taskId) {
      where = { taskId };
    } else {
      const tasks = await prisma.task.findMany({ where: { teamId }, select: { id: true } });
      const taskIds = tasks.map((t) => t.id);
      where = { OR: [{ teamId }, { taskId: { in: taskIds } }] };
    }

    const comments = await prisma.comment.findMany({
      where,
      include: { author: authorSelect, task: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

module.exports = router;