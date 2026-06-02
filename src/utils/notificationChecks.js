const prisma = require('../prismaClient');
const { notify } = require('./notify');

const DAY = 24 * 60 * 60 * 1000;
const daysLeft = (deadline, now) => (new Date(deadline).getTime() - now.getTime()) / DAY;

async function submittedStudents(project) {
  const set = new Set();
  if (project.type === 'SOLO') {
    const subs = await prisma.submission.findMany({ where: { projectId: project.id, submitted: true }, select: { studentId: true } });
    subs.forEach((s) => set.add(s.studentId));
  } else {
    const teams = await prisma.team.findMany({ where: { projectId: project.id, status: 'SUBMITTED' }, include: { members: { select: { userId: true } } } });
    teams.forEach((t) => t.members.forEach((m) => set.add(m.userId)));
  }
  return set;
}

async function runNotificationChecks() {
  const now = new Date();
  const recent = new Date(now.getTime() - 2 * DAY);

  const projects = await prisma.project.findMany({
    include: { course: { select: { id: true, teacherId: true, enrollments: { select: { userId: true } } } } },
  });
  for (const p of projects) {
    const studentIds = p.course.enrollments.map((e) => e.userId);
    const teacherId = p.course.teacherId;
    const link = `/projects/${p.id}`;

    if (p.openAt) {
      const oa = new Date(p.openAt);
      if (oa <= now && oa > recent) {
        for (const uid of studentIds) {
          await notify({ userId: uid, type: 'PROJECT_OPENED', title: `Відкрито проєкт «${p.name}»`, link, dedupeKey: `proj-open:${p.id}:${uid}` });
        }
        await notify({ userId: teacherId, type: 'T_PROJECT_OPENED', title: `Проєкт «${p.name}» відкрито студентам`, link, dedupeKey: `t-proj-open:${p.id}` });
      }
    }

    if (p.deadline) {
      const d = daysLeft(p.deadline, now);
      if (d <= 0) {
        await notify({ userId: teacherId, type: 'T_PROJECT_DEADLINE', title: `Настав дедлайн проєкту «${p.name}»`, link, dedupeKey: `t-proj-dl:${p.id}` });
      }
      const submitted = await submittedStudents(p);
      for (const uid of studentIds) {
        if (submitted.has(uid)) continue;
        if (d > 6 && d <= 7) await notify({ userId: uid, type: 'PROJECT_DEADLINE_WEEK',   title: `Тиждень до дедлайну проєкту «${p.name}»`, link, dedupeKey: `proj-dl-week:${p.id}:${uid}` });
        if (d > 0 && d <= 1) await notify({ userId: uid, type: 'PROJECT_DEADLINE_DAY',    title: `День до дедлайну проєкту «${p.name}»`,    link, dedupeKey: `proj-dl-day:${p.id}:${uid}` });
        if (d <= 0)          await notify({ userId: uid, type: 'PROJECT_DEADLINE_MISSED', title: `Пропущено дедлайн проєкту «${p.name}»`,   link, dedupeKey: `proj-dl-miss:${p.id}:${uid}` });
      }
    }
  }

  const sections = await prisma.section.findMany({
    where: { openAt: { not: null }, hidden: false },
    include: { course: { select: { id: true, teacherId: true, enrollments: { select: { userId: true } } } } },
  });
  for (const s of sections) {
    const oa = new Date(s.openAt);
    if (oa <= now && oa > recent) {
      const link = `/courses/${s.course.id}`;
      for (const e of s.course.enrollments) {
        await notify({ userId: e.userId, type: 'SECTION_OPENED', title: `Відкрито розділ «${s.name}»`, link, dedupeKey: `sec-open:${s.id}:${e.userId}` });
      }
      await notify({ userId: s.course.teacherId, type: 'T_SECTION_OPENED', title: `Розділ «${s.name}» відкрито студентам`, link, dedupeKey: `t-sec-open:${s.id}` });
    }
  }

  const tasks = await prisma.task.findMany({ where: { deadline: { not: null }, assigneeId: { not: null } } });
  for (const t of tasks) {
    if (t.status === 'DONE') continue;
    const d = daysLeft(t.deadline, now);
    const link = `/teams/${t.teamId}`;
    if (d > 6 && d <= 7) await notify({ userId: t.assigneeId, type: 'TASK_DEADLINE_WEEK',   title: `Тиждень до дедлайну завдання «${t.title}»`, link, dedupeKey: `task-dl-week:${t.id}` });
    if (d > 0 && d <= 1) await notify({ userId: t.assigneeId, type: 'TASK_DEADLINE_DAY',    title: `День до дедлайну завдання «${t.title}»`,    link, dedupeKey: `task-dl-day:${t.id}` });
    if (d <= 0)          await notify({ userId: t.assigneeId, type: 'TASK_DEADLINE_MISSED', title: `Пропущено дедлайн завдання «${t.title}»`,   link, dedupeKey: `task-dl-miss:${t.id}` });
  }
}

module.exports = { runNotificationChecks };