const express = require('express');
const prisma = require('../prismaClient');
const { authenticate, requireRole } = require('../middleware/auth');
const { getTeamAccess } = require('../utils/access');
const { notify, notifyMany } = require('../utils/notify');

const router = express.Router();

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

    if (req.user.role === 'STUDENT') {
      const existing = await prisma.teamMember.findFirst({
        where: { userId: req.user.userId, team: { projectId } },
      });
      if (existing) {
        return res.status(400).json({ error: 'Ви вже входите до команди цього проєкту' });
      }
    }

    const team = await prisma.team.create({ data: { name, projectId } });

    if (req.user.role === 'STUDENT') {
      await prisma.teamMember.create({ data: { teamId: team.id, userId: req.user.userId } });
    }

    res.status(201).json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

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

    if (!team.openJoin && isSelf) {
      return res.status(403).json({ error: 'Пряме приєднання закрите. Використовуйте код запрошення' });
    }

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

    const existing = await prisma.teamMember.findMany({ where: { teamId, userId: { not: userId } }, select: { userId: true } });
    const newUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await notifyMany(existing.map((m) => m.userId), {
      type: 'TEAM_MEMBER_JOINED',
      title: `${newUser?.name || 'Користувач'} приєднався до команди «${team.name}»`,
      link: `/teams/${teamId}`,
    });

    res.status(201).json(member);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Студент уже в цій команді' });
    }
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

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

router.get('/:id', authenticate, async (req, res) => {
  const teamId = Number(req.params.id);
  const { team, allowed } = await getTeamAccess(teamId, req.user);
  if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
  if (!allowed) return res.status(403).json({ error: 'Немає доступу' });

  const full = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      project: { select: { id: true, name: true, deadline: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  res.json(full);
});

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
      data.submittedAt = status === 'SUBMITTED' ? new Date() : null;
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

    if (status === 'SUBMITTED' && team.status !== 'SUBMITTED') {
      const proj = await prisma.project.findUnique({ where: { id: team.projectId } });
      const late = proj?.deadline && new Date() > new Date(proj.deadline);
      await notify({
        userId: proj.teacherId,
        type: 'SUBMISSION',
        title: `Команда «${team.name}» здала проєкт «${proj.name}»${late ? ' (із запізненням)' : ''}`,
        link: `/teams/${teamId}`,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

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

    const leftUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const stayMembers = await prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } });
    if (stayMembers.length > 0) {
      await notifyMany(stayMembers.map((m) => m.userId), {
        type: 'TEAM_MEMBER_LEFT',
        title: `${leftUser?.name || 'Користувач'} покинув команду «${team.name}»`,
        link: `/teams/${teamId}`,
      });
    }

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