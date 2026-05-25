const express = require('express');
const prisma = require('../prismaClient');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const { name, description, deadline, courseId } = req.body;
    if (!name || !courseId) {
      return res.status(400).json({ error: 'Потрібні name і courseId' });
    }
    const project = await prisma.project.create({
      data: {
        name,
        description,
        deadline: deadline ? new Date(deadline) : null,
        courseId,
        teacherId: req.user.userId,
      },
    });
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/', authenticate, async (req, res) => {
  const { courseId } = req.query;
  const where = {};
  if (courseId) where.courseId = Number(courseId);

  if (req.user.role === 'TEACHER') {
    where.teacherId = req.user.userId;
  } else {
    where.course = { enrollments: { some: { userId: req.user.userId } } };
  }

  const projects = await prisma.project.findMany({
    where,
    include: { course: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(projects);
});

// один проєкт за id (доступ: викладач-власник або записаний студент)
router.get('/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const project = await prisma.project.findUnique({
    where: { id },
    include: { course: { select: { id: true, name: true } } },
  });
  if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });

  let allowed = req.user.role === 'TEACHER' && project.teacherId === req.user.userId;
  if (!allowed && req.user.role === 'STUDENT') {
    const enr = await prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId: project.courseId, userId: req.user.userId } },
    });
    allowed = !!enr;
  }
  if (!allowed) return res.status(403).json({ error: 'Немає доступу' });
  res.json(project);
});

// видалити проєкт (лише викладач-власник)
router.delete('/:id', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (project.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Це не ваш проєкт' });
    }
    await prisma.project.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// редагувати проєкт (лише викладач-власник)
router.patch('/:id', authenticate, requireRole('TEACHER'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
    if (project.teacherId !== req.user.userId) return res.status(403).json({ error: 'Це не ваш проєкт' });
    const { name, description, deadline } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
    const updated = await prisma.project.update({ where: { id }, data });
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

module.exports = router;