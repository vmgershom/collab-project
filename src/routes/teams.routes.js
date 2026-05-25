const express = require('express');
const prisma = require('../prismaClient');
const { authenticate, requireRole } = require('../middleware/auth');
const { getTeamAccess } = require('../utils/access');

const router = express.Router();

// створити команду: викладач-власник АБО студент, записаний на курс (студент автоматично стає учасником)
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, projectId } = req.body;
    if (!name || !projectId) {
      return res.status(400).json({ error: 'Потрібні name і projectId' });
    }
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });

    const isOwner = req.user.role === 'TEACHER' && project.teacherId === req.user.userId;
    let isEnrolled = false;
    if (req.user.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: { courseId_userId: { courseId: project.courseId, userId: req.user.userId } },
      });
      isEnrolled = !!enrollment;
    }
    if (!isOwner && !isEnrolled) {
      return res.status(403).json({ error: 'Немає доступу до цього проєкту' });
    }

    // студент не може створити команду, якщо вже входить до команди цього проєкту
    if (req.user.role === 'STUDENT') {
      const existing = await prisma.teamMember.findFirst({
        where: { userId: req.user.userId, team: { projectId } },
      });
      if (existing) {
        return res.status(400).json({ error: 'Ви вже входите до команди цього проєкту' });
      }
    }

    const team = await prisma.team.create({ data: { name, projectId } });

    // студент-творець автоматично стає учасником
    if (req.user.role === 'STUDENT') {
      await prisma.teamMember.create({ data: { teamId: team.id, userId: req.user.userId } });
    }

    res.status(201).json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// приєднати учасника: викладач — будь-кого свого; студент — лише себе
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Потрібен userId' });

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { project: true },
    });
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });

    const isOwner = req.user.role === 'TEACHER' && team.project.teacherId === req.user.userId;
    const isSelf = req.user.role === 'STUDENT' && userId === req.user.userId;
    if (!isOwner && !isSelf) {
      return res.status(403).json({ error: 'Студент може додати лише себе' });
    }

    // якщо пряме приєднання закрите — лише за кодом
    if (!team.openJoin && isSelf) {
      return res.status(403).json({ error: 'Пряме приєднання закрите. Використовуйте код запрошення' });
    }

    // той, кого додають, має бути студентом і записаним на курс проєкту
    const student = await prisma.user.findUnique({ where: { id: userId } });
    if (!student || student.role !== 'STUDENT') {
      return res.status(400).json({ error: 'Учасником може бути лише студент' });
    }
    const enrollment = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: team.project.courseId, userId } },
    });
    if (!enrollment) {
      return res.status(400).json({ error: 'Студент не записаний на курс цього проєкту' });
    }

    // студент не може бути більш ніж в одній команді цього проєкту
    const alreadyInProject = await prisma.teamMember.findFirst({
      where: {
        userId,
        team: { projectId: team.projectId },
      },
    });
    if (alreadyInProject) {
      return res.status(400).json({ error: 'Студент уже входить до команди цього проєкту' });
    }

    const member = await prisma.teamMember.create({ data: { teamId, userId } });
    res.status(201).json(member);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Студент уже в цій команді' });
    }
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// список команд (фільтр: /teams?projectId=1) зі складом учасників
router.get('/', authenticate, async (req, res) => {
  const { projectId } = req.query;
  const where = projectId ? { projectId: Number(projectId) } : undefined;
  const teams = await prisma.team.findMany({
    where,
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(teams);
});

// одна команда за id зі складом учасників
router.get('/:id', authenticate, async (req, res) => {
  const teamId = Number(req.params.id);
  const { team, allowed } = await getTeamAccess(teamId, req.user);
  if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
  if (!allowed) return res.status(403).json({ error: 'Немає доступу' });

  const full = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      project: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  res.json(full);
});

// здати/відмінити здачу + закрити/відкрити пряме приєднання
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const { status, openJoin } = req.body;
    const { team } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });

    const isMember = team.members.some((m) => m.userId === req.user.userId);
    const data = {};

    if (status !== undefined) {
      if (!['ACTIVE', 'SUBMITTED'].includes(status)) {
        return res.status(400).json({ error: 'status має бути ACTIVE або SUBMITTED' });
      }
      if (!(req.user.role === 'STUDENT' && isMember)) {
        return res.status(403).json({ error: 'Здавати проєкт можуть лише студенти команди' });
      }
      data.status = status;
    }

    if (openJoin !== undefined) {
      if (!isMember) {
        return res.status(403).json({ error: 'Керувати приєднанням можуть лише учасники команди' });
      }
      data.openJoin = openJoin;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нічого для оновлення' });
    }

    const updated = await prisma.team.update({ where: { id: teamId }, data });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// покинути команду / прибрати учасника
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const userId = Number(req.params.userId);
    const { team } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });

    const isTeacherOwner = req.user.role === 'TEACHER' && team.project.teacherId === req.user.userId;
    const isSelf = req.user.role === 'STUDENT' && userId === req.user.userId;
    if (!isTeacherOwner && !isSelf) {
      return res.status(403).json({ error: 'Студент може покинути лише власну участь' });
    }

    if (team.status === 'SUBMITTED' && !isTeacherOwner) {
      return res.status(400).json({ error: 'Не можна покинути команду після здачі проєкту' });
    }

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) return res.status(404).json({ error: 'Учасника немає в команді' });

    await prisma.teamMember.delete({ where: { id: membership.id } });

    // автовидалення порожньої команди
    const remaining = await prisma.teamMember.count({ where: { teamId } });
    if (remaining === 0) {
      await prisma.team.delete({ where: { id: teamId } });
    }

    res.json({ left: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;