const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { runNotificationChecks } = require('../utils/notificationChecks');
const { TYPES } = require('../utils/notificationTypes');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    await runNotificationChecks().catch(() => {}); // ліниве оновлення часових сповіщень
    const items = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(items);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user.userId, read: false } });
    res.json({ count });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.post('/read-all', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.userId, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.get('/settings', authenticate, async (req, res) => {
  try {
    const rows = await prisma.notificationSetting.findMany({ where: { userId: req.user.userId } });
    const disabled = new Set(rows.filter((r) => !r.enabled).map((r) => r.type));
    const list = Object.entries(TYPES)
      .filter(([, t]) => t.role === req.user.role)
      .map(([type, t]) => ({ type, label: t.label, enabled: !disabled.has(type) }));
    res.json(list);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

router.put('/settings', authenticate, async (req, res) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) return res.status(400).json({ error: 'settings має бути масивом' });
    for (const s of settings) {
      if (!TYPES[s.type] || TYPES[s.type].role !== req.user.role) continue;
      await prisma.notificationSetting.upsert({
        where: { userId_type: { userId: req.user.userId, type: s.type } },
        update: { enabled: !!s.enabled },
        create: { userId: req.user.userId, type: s.type, enabled: !!s.enabled },
      });
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Помилка сервера' }); }
});

module.exports = router;