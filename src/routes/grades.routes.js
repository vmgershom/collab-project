const express = require('express');
const prisma = require('../prismaClient');
const { authenticate, requireRole } = require('../middleware/auth');
const { notify, notifyMany } = require('../utils/notify');

const router = express.Router();

router.put('/', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const { studentId, projectId, score } = req.body;
    if (!studentId || !projectId || score === undefined) {
      return res.status(400).json({ error: 'Потрібні studentId, projectId і score' });
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { course: true } });
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (project.course.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш курс' });
    }
    const max = project.maxScore ?? 100;
    if (score < 0 || score > max) {
      return res.status(400).json({ error: `Оцінка має бути від 0 до ${max}` });
    }
    const enrollment = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: project.courseId, userId: studentId } },
    });
    if (!enrollment) return res.status(400).json({ error: 'Студент не записаний на цей курс' });

    const grade = await prisma.grade.upsert({
      where: { studentId_projectId: { studentId, projectId } },
      update: { score, teacherId: req.user.userId },
      create: { studentId, projectId, score, teacherId: req.user.userId },
    });

    await notify({
      userId: studentId,
      type: 'GRADED',
      title: `Вашу роботу оцінено: «${project.name}»`,
      body: `Оцінка: ${score} / ${max}`,
      link: '/grades',
    });

    res.json(grade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/course/:courseId', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (course.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш курс' });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: { user: { select: { id: true, name: true } } },
    });
    const students = enrollments.map((e) => e.user);

    const projects = await prisma.project.findMany({
      where: { courseId },
      select: {
        id: true,
        name: true,
        maxScore: true,
        order: true,
        section: { select: { order: true } },
      },
      orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }],
    });

    const grades = await prisma.grade.findMany({
      where: { projectId: { in: projects.map((p) => p.id) } },
    });
    const gradeMap = {};
    for (const g of grades) {
      gradeMap[`${g.studentId}-${g.projectId}`] = g.score;
    }

    res.json({ students, projects, grades: gradeMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/my', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Доступно лише студентам' });
    }
    const grades = await prisma.grade.findMany({
      where: { studentId: req.user.userId },
      include: { project: { select: { name: true, courseId: true, course: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(grades.map((g) => ({
      projectName: g.project.name,
      courseName: g.project.course.name,
      courseId: g.project.courseId,
      projectId: g.projectId,
      score: g.score,
      updatedAt: g.updatedAt,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/my/summary', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Доступно лише студентам' });
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user.userId },
      include: {
        course: {
          include: {
            projects: {
              where: { section: { hidden: false, OR: [{ openAt: null }, { openAt: { lte: new Date() } }] } },
              include: { section: { select: { id: true, name: true, order: true } } },
            },
          },
        },
      },
    });
    const grades = await prisma.grade.findMany({ where: { studentId: req.user.userId } });
    const gradeMap = {};
    grades.forEach((g) => { gradeMap[g.projectId] = g.score; });

    const result = enrollments
      .map((e) => {
        const projects = e.course.projects
          .slice()
          .sort((a, b) => (a.section.order - b.section.order) || (a.order - b.order))
          .map((p) => ({
            projectId: p.id,
            projectName: p.name,
            sectionName: p.section.name,
            maxScore: p.maxScore,
            score: gradeMap[p.id] ?? null,
          }));
        const totalMax = projects.reduce((s, p) => s + p.maxScore, 0);
        const totalEarned = projects.reduce((s, p) => s + (p.score ?? 0), 0);
        return {
          courseId: e.course.id,
          courseName: e.course.name,
          totalMax,
          totalEarned,
          projects,
        };
      })
      .sort((a, b) => a.courseName.localeCompare(b.courseName, 'uk'));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;