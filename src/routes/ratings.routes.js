const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { getTeamAccess } = require('../utils/access');

const router = express.Router();

// поставити/змінити оцінку співпраці (1–5)
router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, rateeId, score } = req.body;
    if (!teamId || !rateeId || score === undefined) {
      return res.status(400).json({ error: 'Потрібні teamId, rateeId і score' });
    }
    if (score < 1 || score > 5) return res.status(400).json({ error: 'Оцінка має бути від 1 до 5' });
    if (rateeId === req.user.userId) return res.status(400).json({ error: 'Не можна оцінювати себе' });

    const { team, allowed } = await getTeamAccess(teamId, req.user);
    if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
    if (!allowed) return res.status(403).json({ error: 'Немає доступу' });

    const raterIsMember = team.members.some((m) => m.userId === req.user.userId);
    const rateeIsMember = team.members.some((m) => m.userId === rateeId);
    if (!raterIsMember || !rateeIsMember) {
      return res.status(400).json({ error: 'Оцінювати можна лише учасників своєї команди' });
    }

    const rating = await prisma.peerRating.upsert({
      where: { raterId_rateeId_teamId: { raterId: req.user.userId, rateeId, teamId } },
      update: { score },
      create: { raterId: req.user.userId, rateeId, teamId, score },
    });
    res.json(rating);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// мої виставлені оцінки в команді (для підсвічування зірочок)
router.get('/mine', authenticate, async (req, res) => {
  try {
    const teamId = Number(req.query.teamId);
    const ratings = await prisma.peerRating.findMany({
      where: { teamId, raterId: req.user.userId },
      select: { rateeId: true, score: true },
    });
    res.json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;