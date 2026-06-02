const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { getTeamAccess } = require('../utils/access');
const { notify, notifyMany } = require('../utils/notify');

const router = express.Router();

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

router.post('/project', authenticate, async (req, res) => {
  try {
    const { projectId, content, isPrivate, studentId } = req.body;
    if (!projectId || !content) return res.status(400).json({ error: 'Потрібні projectId і content' });
    const { project, allowed } = await getProjectAccess(projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });

    const data = { content, projectId, authorId: req.user.userId, isPrivate: false, studentId: null };
    if (isPrivate) {
      data.isPrivate = true;
      if (req.user.role === 'STUDENT') {
        data.studentId = req.user.userId;
      } else {
        const sid = Number(studentId);
        if (!sid) return res.status(400).json({ error: 'Потрібен studentId' });
        const enr = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: project.courseId, userId: sid } } });
        if (!enr) return res.status(400).json({ error: 'Студент не записаний на курс' });
        data.studentId = sid;
      }
    }
    const comment = await prisma.comment.create({ data, include: { author: authorSelect } });
    const author = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });
    if (data.isPrivate) {
      if (req.user.role === 'STUDENT') {
        await notify({
          userId: project.teacherId,
          type: 'T_PRIVATE_COMMENT',
          title: `Приватний коментар від ${author?.name || 'студента'} під проєктом «${project.name}»`,
          link: `/projects/${projectId}?thread=private&student=${req.user.userId}`,
        });
      } else {
        await notify({
          userId: data.studentId,
          type: 'PRIVATE_COMMENT',
          title: `Приватний коментар від ${author?.name || 'викладача'} під проєктом «${project.name}»`,
          link: `/projects/${projectId}?thread=private`,
        });
      }
    } else if (req.user.role !== 'TEACHER') {
      await notify({
        userId: project.teacherId,
        type: 'PROJECT_COMMENT',
        title: `Новий коментар від ${author?.name || 'студента'} під проєктом «${project.name}»`,
        link: `/projects/${projectId}`,
      });
    }
    res.status(201).json(comment);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/project', authenticate, async (req, res) => {
  try {
    const projectId = Number(req.query.projectId);
    const { project, allowed } = await getProjectAccess(projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });

    const isPrivate = req.query.private === 'true';
    let where;
    if (!isPrivate) {
      where = { projectId, isPrivate: false };
    } else {
      const sid = req.user.role === 'STUDENT' ? req.user.userId : Number(req.query.studentId);
      if (!sid) return res.status(400).json({ error: 'Потрібен studentId' });
      where = { projectId, isPrivate: true, studentId: sid };
    }
    const comments = await prisma.comment.findMany({
      where,
      include: { author: authorSelect },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/project/students', authenticate, async (req, res) => {
  try {
    const projectId = Number(req.query.projectId);
    const { project, allowed } = await getProjectAccess(projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (!allowed || req.user.role !== 'TEACHER') return res.status(403).json({ error: 'Немає доступу' });

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: project.courseId },
      include: { user: { select: { id: true, name: true } } },
    });
    const priv = await prisma.comment.findMany({
      where: { projectId, isPrivate: true },
      orderBy: { createdAt: 'asc' },
      select: { studentId: true, authorId: true, createdAt: true },
    });
    const byStudent = {};
    for (const c of priv) byStudent[c.studentId] = c;

    const students = enrollments.map((e) => {
      const last = byStudent[e.user.id];
      return {
        id: e.user.id,
        name: e.user.name,
        hasThread: !!last,
        lastFromStudent: last ? last.authorId === e.user.id : false,
        lastAt: last ? last.createdAt : null,
      };
    }).sort((a, b) => {
      if (a.lastFromStudent !== b.lastFromStudent) return a.lastFromStudent ? -1 : 1;
      if (a.hasThread !== b.hasThread) return a.hasThread ? -1 : 1;
      return a.name.localeCompare(b.name, 'uk');
    });
    res.json(students);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

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
        teamId: taskId ? null : teamId,
      },
      include: { author: authorSelect, task: { select: { id: true, title: true } } },
    });

    const author = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });
    const others = team.members.filter((m) => m.userId !== req.user.userId).map((m) => m.userId);
    await notifyMany(others, {
      type: 'TEAM_COMMENT',
      title: `Новий коментар від ${author?.name || 'учасника'} у команді «${team.name}»`,
      link: `/teams/${teamId}`,
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