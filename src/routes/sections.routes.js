const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');

const uid = (req) => req.user?.id ?? req.user?.userId ?? req.userId;

const materialItem = (m) => ({ kind: 'material', id: m.id, title: m.title, type: m.type, order: m.order });
const projectItem = (p) => ({ kind: 'project', id: p.id, title: p.name, type: p.type, deadline: p.deadline, order: p.order });

async function ownerOfSection(sectionId, userId) {
  const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { course: true } });
  if (!section) return { error: 404 };
  if (section.course.teacherId !== userId) return { error: 403 };
  return { section };
}

router.get('/course/:courseId', authenticate, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const userId = uid(req);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });

    const isOwner = course.teacherId === userId;
    if (!isOwner) {
      const enrolled = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId } } });
      if (!enrolled) return res.status(403).json({ error: 'Немає доступу' });
    }

    const sections = await prisma.section.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: { projects: { orderBy: { order: 'asc' } }, materials: { orderBy: { order: 'asc' } } },
    });

    const now = new Date();
    const result = sections
      .filter((s) => isOwner || !s.hidden)
      .map((s) => {
        const locked = !isOwner && s.openAt && new Date(s.openAt) > now;
        const items = locked ? [] : [...s.materials.map(materialItem), ...s.projects.map(projectItem)].sort((a, b) => a.order - b.order);
        return { id: s.id, name: s.name, order: s.order, hidden: s.hidden, openAt: s.openAt, locked: !!locked, items };
      });

    res.json({ isOwner, sections: result });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка завантаження розділів' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const userId = uid(req);
    const { courseId, name, hidden, openAt } = req.body;
    if (!courseId || !name || !name.trim()) return res.status(400).json({ error: 'Вкажіть назву розділу' });
    const course = await prisma.course.findUnique({ where: { id: Number(courseId) } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (course.teacherId !== userId) return res.status(403).json({ error: 'Лише викладач курсу' });

    const last = await prisma.section.findFirst({ where: { courseId: Number(courseId) }, orderBy: { order: 'desc' } });
    const order = last ? last.order + 1 : 0;
    const section = await prisma.section.create({
      data: {
        name: name.trim(),
        courseId: Number(courseId),
        order,
        hidden: !!hidden,
        openAt: openAt ? new Date(openAt) : null,
      },
    });
    res.json(section);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка створення розділу' }); }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const userId = uid(req);
    const id = Number(req.params.id);
    const own = await ownerOfSection(id, userId);
    if (own.error) return res.status(own.error).json({ error: own.error === 404 ? 'Не знайдено' : 'Лише викладач курсу' });

    const data = {};
    if (req.body.name !== undefined) {
      if (!req.body.name.trim()) return res.status(400).json({ error: 'Назва не може бути порожньою' });
      data.name = req.body.name.trim();
    }
    if (req.body.hidden !== undefined) data.hidden = !!req.body.hidden;
    if (req.body.openAt !== undefined) data.openAt = req.body.openAt ? new Date(req.body.openAt) : null;

    const section = await prisma.section.update({ where: { id }, data });
    res.json(section);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка оновлення розділу' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = uid(req);
    const id = Number(req.params.id);
    const own = await ownerOfSection(id, userId);
    if (own.error) return res.status(own.error).json({ error: own.error === 404 ? 'Не знайдено' : 'Лише викладач курсу' });
    await prisma.section.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка видалення розділу' }); }
});

router.put('/reorder', authenticate, async (req, res) => {
  try {
    const userId = uid(req);
    const { courseId, orderedIds } = req.body;
    if (!courseId || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'Невірні дані' });
    const course = await prisma.course.findUnique({ where: { id: Number(courseId) } });
    if (!course) return res.status(404).json({ error: 'Курс не знайдено' });
    if (course.teacherId !== userId) return res.status(403).json({ error: 'Лише викладач курсу' });

    await prisma.$transaction(
      orderedIds.map((sid, i) =>
        prisma.section.updateMany({ where: { id: Number(sid), courseId: Number(courseId) }, data: { order: i } })
      )
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка зміни порядку' }); }
});

router.put('/:id/reorder-items', authenticate, async (req, res) => {
  try {
    const userId = uid(req);
    const id = Number(req.params.id);
    const own = await ownerOfSection(id, userId);
    if (own.error) return res.status(own.error).json({ error: own.error === 404 ? 'Не знайдено' : 'Лише викладач курсу' });

    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Невірні дані' });

    await prisma.$transaction(
      items.map((it, i) =>
        it.kind === 'project'
          ? prisma.project.updateMany({ where: { id: Number(it.id), sectionId: id }, data: { order: i } })
          : prisma.material.updateMany({ where: { id: Number(it.id), sectionId: id }, data: { order: i } })
      )
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка зміни порядку частин' }); }
});

module.exports = router;