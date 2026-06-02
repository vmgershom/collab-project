const express = require('express');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { notify, notifyMany } = require('../utils/notify');

const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  try {
    const { type, courseId, teamId } = req.body;

    if (type === 'COURSE') {
      if (!courseId) return res.status(400).json({ error: 'Потрібен courseId' });
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
      if (req.user.role !== 'TEACHER' || course.teacherId !== req.user.userId) {
        return res.status(403).json({ error: 'Лише викладач-власник може запрошувати на курс' });
      }
    } else if (type === 'TEAM') {
      if (!teamId) return res.status(400).json({ error: 'Потрібен teamId' });
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { project: true, members: true },
      });
      if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
      const isOwner = req.user.role === 'TEACHER' && team.project.teacherId === req.user.userId;
      const isMember = team.members.some((m) => m.userId === req.user.userId);
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: 'Запрошення може створити учасник або викладач' });
      }
    } else {
      return res.status(400).json({ error: 'type має бути COURSE або TEAM' });
    }

    const code = crypto.randomBytes(4).toString('hex');
    const invitation = await prisma.invitation.create({
      data: {
        code,
        type,
        courseId: type === 'COURSE' ? courseId : null,
        teamId: type === 'TEAM' ? teamId : null,
        createdById: req.user.userId,
      },
    });
    res.status(201).json(invitation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.post('/redeem', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Потрібен код запрошення' });
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Приєднатися за кодом можуть лише студенти' });
    }

    const invitation = await prisma.invitation.findUnique({ where: { code } });
    if (!invitation) return res.status(404).json({ error: 'Код запрошення не знайдено' });

    if (invitation.type === 'COURSE') {
      const existing = await prisma.enrollment.findUnique({
        where: { courseId_userId: { courseId: invitation.courseId, userId: req.user.userId } },
      });
      if (existing) return res.status(400).json({ error: 'Ви вже записані на цей курс' });
      await prisma.enrollment.create({
        data: { courseId: invitation.courseId, userId: req.user.userId },
      });
      const course = await prisma.course.findUnique({ where: { id: invitation.courseId }, select: { name: true, teacherId: true } });
      const studentObj = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });
      await notify({
        userId: course.teacherId,
        type: 'COURSE_JOINED',
        title: `${studentObj?.name || 'Студент'} приєднався до курсу «${course.name}»`,
        link: `/courses/${invitation.courseId}`,
      });
      res.json({ message: `Ви приєднались до курсу «${course.name}»` });
    } else if (invitation.type === 'TEAM') {
      const team = await prisma.team.findUnique({
        where: { id: invitation.teamId },
        include: { project: true },
      });
      if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
      if (team.status === 'SUBMITTED') {
        return res.status(400).json({ error: 'Команда вже здала проєкт' });
      }
      const enrollment = await prisma.enrollment.findUnique({
        where: { courseId_userId: { courseId: team.project.courseId, userId: req.user.userId } },
      });
      if (!enrollment) {
        return res.status(400).json({ error: 'Спершу запишіться на курс цього проєкту' });
      }
      const alreadyInProject = await prisma.teamMember.findFirst({
        where: { userId: req.user.userId, team: { projectId: team.projectId } },
      });
      if (alreadyInProject) {
        return res.status(400).json({ error: 'Ви вже входите до команди цього проєкту' });
      }
      const beforeMembers = await prisma.teamMember.findMany({ where: { teamId: invitation.teamId }, select: { userId: true } });
      await prisma.teamMember.create({ data: { teamId: invitation.teamId, userId: req.user.userId } });
      const newUser = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });
      await notifyMany(beforeMembers.map((m) => m.userId), {
        type: 'TEAM_MEMBER_JOINED',
        title: `${newUser?.name || 'Користувач'} приєднався до команди «${team.name}»`,
        link: `/teams/${invitation.teamId}`,
      });
      res.json({ message: `Ви приєднались до команди «${team.name}»` });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;