const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId ?? req.userId;
    const me = await prisma.user.findUnique({ where: { id: userId } });
    if (!me) return res.status(401).json({ error: 'Неавторизовано' });

    let items = [];

    if (me.role === 'TEACHER') {
      const projects = await prisma.project.findMany({
        where: {
          deadline: { not: null },
          OR: [{ teacherId: me.id }, { course: { teacherId: me.id } }],
        },
        include: { course: { select: { name: true } } },
      });
      items = projects.map((p) => ({
        type: 'PROJECT',
        title: p.name,
        deadline: p.deadline,
        courseId: p.courseId,
        courseName: p.course.name,
        projectType: p.type,
        projectId: p.id,
      }));
    } else {
      // 1. Курси, на які записаний студент
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: me.id },
        select: { courseId: true },
      });
      const courseIds = enrollments.map((e) => e.courseId);

      // 2. Команди студента (потрібні для завдань)
      const memberships = await prisma.teamMember.findMany({
        where: { userId: me.id },
        select: { teamId: true },
      });
      const teamIds = memberships.map((m) => m.teamId);

      // Усі проєкти курсів, на яких студент — незалежно від наявності команди
      const projects = await prisma.project.findMany({
        where: {
          courseId: { in: courseIds },
          deadline: { not: null },
        },
        include: { course: { select: { name: true } } },
      });

      const tasks = await prisma.task.findMany({
        where: { teamId: { in: teamIds }, deadline: { not: null } },
        include: {
          team: { select: { project: { select: { name: true, courseId: true, course: { select: { name: true } } } } } },
        },
      });

      items = [
        ...projects.map((p) => ({
          type: 'PROJECT',
          title: p.name,
          deadline: p.deadline,
          courseId: p.courseId,
          courseName: p.course.name,
          projectType: p.type,
          projectId: p.id,
        })),
        ...tasks.map((t) => ({
          type: 'TASK',
          title: t.title,
          deadline: t.deadline,
          courseId: t.team.project.courseId,
          courseName: t.team.project.course.name,
          projectName: t.team.project.name,
          teamId: t.teamId,
        })),
      ];
    }

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка завантаження календаря' });
  }
});

module.exports = router;