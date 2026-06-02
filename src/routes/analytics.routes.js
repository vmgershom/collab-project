const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { computeContribution } = require('../services/contribution');

const router = express.Router();

router.get('/teams/:id/contribution', authenticate, async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { project: true },
    });
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });

    if (req.user.role !== 'TEACHER' || team.project.teacherId !== req.user.userId) {
      return res.status(403).json({ error: 'Аналітика доступна лише викладачу' });
    }

    const result = await computeContribution(teamId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;