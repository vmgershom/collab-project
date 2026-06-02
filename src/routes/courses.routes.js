const express = require('express');
const prisma = require('../prismaClient');
const { authenticate, requireRole } = require('../middleware/auth');
const { notify, notifyMany } = require('../utils/notify');

const router = express.Router();

router.post('/', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Потрібна назва курсу' });
    const course = await prisma.course.create({
      data: { name, description, teacherId: req.user.userId },
    });
    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.post('/:id/students', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Потрібен userId' });

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (course.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш курс' });
    }

    const student = await prisma.user.findUnique({ where: { id: userId } });
    if (!student || student.role !== 'STUDENT') {
      return res.status(400).json({ error: 'Можна записувати лише студентів' });
    }

    const enrollment = await prisma.enrollment.create({ data: { courseId, userId } });
    res.status(201).json(enrollment);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Студент уже записаний на курс' });
    }
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/', authenticate, async (req, res) => {
  const where =
    req.user.role === 'TEACHER'
      ? { teacherId: req.user.userId }
      : { enrollments: { some: { userId: req.user.userId } } };

  const courses = await prisma.course.findMany({
    where,
    include: { teacher: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(courses);
});

router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const course = await prisma.course.findUnique({
    where: { id },
    include: { teacher: { select: { id: true, name: true } } },
  });
  if (!course) return res.status(404).json({ error: 'Курс не знайдено' });

  let allowed = req.user.role === 'TEACHER' && course.teacherId === req.user.userId;
  if (!allowed && req.user.role === 'STUDENT') {
    const enr = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: id, userId: req.user.userId } },
    });
    allowed = !!enr;
  }
  if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
  res.json(course);
});

router.delete('/:id', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (course.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш курс' });
    }
    await prisma.course.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.delete('/:id/students', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Покинути курс може лише студент' });
    }
    const courseId = Number(req.params.id);
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, teacherId: true } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    const enrollment = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId: req.user.userId } },
    });
    if (!enrollment) return res.status(404).json({ error: 'Ви не записані на цей курс' });

    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.user.userId, team: { project: { courseId } } },
      include: { team: { select: { id: true, name: true } } },
    });
    const userObj = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } });

    await prisma.teamMember.deleteMany({
      where: { userId: req.user.userId, team: { project: { courseId } } },
    });
    await prisma.enrollment.delete({ where: { id: enrollment.id } });

    const emptyTeams = await prisma.team.findMany({
      where: { project: { courseId }, members: { none: {} } },
    });
    const deletedIds = new Set(emptyTeams.map((t) => t.id));
    for (const t of emptyTeams) {
      await prisma.team.delete({ where: { id: t.id } });
    }

    await notify({
      userId: course.teacherId,
      type: 'COURSE_LEFT',
      title: `${userObj?.name || 'Студент'} покинув курс «${course.name}»`,
      link: `/courses/${courseId}`,
    });
    for (const m of memberships) {
      if (deletedIds.has(m.team.id)) continue;
      const remaining = await prisma.teamMember.findMany({ where: { teamId: m.team.id }, select: { userId: true } });
      await notifyMany(remaining.map((r) => r.userId), {
        type: 'TEAM_MEMBER_LEFT',
        title: `${userObj?.name || 'Користувач'} покинув команду «${m.team.name}»`,
        link: `/teams/${m.team.id}`,
      });
    }

    res.json({ left: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/:id/students', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (course.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш курс' });
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(enrollments.map((e) => e.user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.patch('/:id', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (course.teacherId !== req.user.userId) return res.status(403).json({ error: 'Це не ваш курс' });
    const { name, description } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;
    const updated = await prisma.course.update({ where: { id }, data });
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.delete('/:id/students/:studentId', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const studentId = Number(req.params.studentId);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (course.teacherId !== req.user.userId) return res.status(403).json({ error: 'Це не ваш курс' });

    const memberships = await prisma.teamMember.findMany({
      where: { userId: studentId, team: { project: { courseId } } },
      select: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);

    if (teamIds.length) {
      await prisma.teamMember.deleteMany({ where: { userId: studentId, teamId: { in: teamIds } } });
      for (const tid of teamIds) {
        const count = await prisma.teamMember.count({ where: { teamId: tid } });
        if (count === 0) await prisma.team.delete({ where: { id: tid } });
      }
    }

    await prisma.enrollment.delete({ where: { courseId_userId: { courseId, userId: studentId } } });

    const studentObj = await prisma.user.findUnique({ where: { id: studentId }, select: { name: true } });
    for (const tid of teamIds) {
      const stillExists = await prisma.team.findUnique({ where: { id: tid }, select: { id: true, name: true } });
      if (!stillExists) continue;
      const remaining = await prisma.teamMember.findMany({ where: { teamId: tid }, select: { userId: true } });
      await notifyMany(remaining.map((r) => r.userId), {
        type: 'TEAM_MEMBER_LEFT',
        title: `${studentObj?.name || 'Користувач'} покинув команду «${stillExists.name}»`,
        link: `/teams/${tid}`,
      });
    }

    res.json({ removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка видалення студента' });
  }
});

module.exports = router;