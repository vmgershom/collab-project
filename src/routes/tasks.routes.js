const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { getTeamAccess } = require('../utils/access');
const { notify } = require('../utils/notify');

const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, deadline, teamId, assigneeId } = req.body;
    if (!title || !teamId) {
      return res.status(400).json({ error: 'Потрібні title і teamId' });
    }
    const { team } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });

    const isMember = team.members.some((m) => m.userId === req.user.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Керувати завданнями можуть лише учасники команди' });
    }

    if (assigneeId) {
      const assigneeIsMember = team.members.some((m) => m.userId === assigneeId);
      if (!assigneeIsMember) {
        return res.status(400).json({ error: 'Виконавець має бути учасником команди' });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        deadline: deadline ? new Date(deadline) : null,
        teamId,
        assigneeId: assigneeId || null,
        createdById: req.user.userId,
      },
    });
    if (task.assigneeId && task.assigneeId !== req.user.userId) {
      await notify({
        userId: task.assigneeId,
        type: 'TASK_ASSIGNED',
        title: `Вам призначено завдання «${task.title}»`,
        link: `/teams/${teamId}`,
      });
    }
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/', authenticate, async (req, res) => {
  const { teamId } = req.query;
  if (!teamId) return res.status(400).json({ error: 'Потрібен teamId' });
  const { team, allowed } = await getTeamAccess(Number(teamId), req.user);
  if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
  if (!allowed) return res.status(403).json({ error: 'Немає доступу до цієї команди' });

  const tasks = await prisma.task.findMany({
    where: { teamId: Number(teamId) },
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks);
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) return res.status(404).json({ error: 'Завдання не знайдено' });

    const isAssignee = existing.assigneeId === req.user.userId;
    const isCreator = existing.createdById === req.user.userId;
    const canEdit = isAssignee || (existing.status === 'TODO' && isCreator);

    const { title, description, deadline, status, assigneeId } = req.body;
    const data = {};

    if (status !== undefined) {
      if (!isAssignee) {
        return res.status(403).json({ error: 'Змінювати статус може лише виконавець завдання' });
      }
      const allowedStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'status має бути TODO, IN_PROGRESS або DONE' });
      }
      data.status = status;
      data.completedAt = status === 'DONE' ? new Date() : null;
    }

    const changingOther =
      title !== undefined || description !== undefined || deadline !== undefined || assigneeId !== undefined;
    if (changingOther) {
      if (!canEdit) {
        return res.status(403).json({
          error: 'Редагувати може виконавець, або той, хто призначив (поки завдання не розпочате)',
        });
      }
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
      if (assigneeId !== undefined) data.assigneeId = assigneeId;
    }

    const task = await prisma.task.update({ where: { id: taskId }, data });
    if (assigneeId !== undefined && assigneeId && assigneeId !== existing.assigneeId && assigneeId !== req.user.userId) {
      await notify({
        userId: assigneeId,
        type: 'TASK_ASSIGNED',
        title: `Вам призначено завдання «${task.title}»`,
        link: `/teams/${task.teamId}`,
      });
    }
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) return res.status(404).json({ error: 'Завдання не знайдено' });

    const isAssignee = existing.assigneeId === req.user.userId;
    const isCreator = existing.createdById === req.user.userId;
    const canDelete = isAssignee || (existing.status === 'TODO' && isCreator);
    if (!canDelete) {
      return res.status(403).json({
        error: 'Видалити може виконавець, або той, хто призначив (поки завдання не розпочате)',
      });
    }

    await prisma.comment.deleteMany({ where: { taskId } });
    await prisma.submission.deleteMany({ where: { taskId } });
    await prisma.task.delete({ where: { id: taskId } });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;