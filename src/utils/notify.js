const prisma = require('../prismaClient');

async function isEnabled(userId, type) {
  const s = await prisma.notificationSetting.findUnique({ where: { userId_type: { userId, type } } });
  return s ? s.enabled : true;
}

async function notify({ userId, type, title, body = null, link = null, dedupeKey = null }) {
  try {
    if (!userId) return null;
    if (!(await isEnabled(userId, type))) return null;
    if (dedupeKey) {
      const existing = await prisma.notification.findUnique({ where: { dedupeKey } });
      if (existing) return null;
    }
    return await prisma.notification.create({ data: { userId, type, title, body, link, dedupeKey } });
  } catch (err) {
    if (err.code === 'P2002') return null;
    console.error('notify error', err);
    return null;
  }
}

async function notifyMany(userIds, payload) {
  for (const uid of userIds) {
    await notify({ ...payload, userId: uid, dedupeKey: payload.dedupeKey ? `${payload.dedupeKey}:${uid}` : null });
  }
}

module.exports = { notify, notifyMany, isEnabled };