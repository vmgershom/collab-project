const prisma = require('../prismaClient');
const { normalizeValues } = require('../utils/ahp');
const { CRITERIA_WEIGHTS, CRITERIA_CONSISTENCY } = require('../utils/criteriaMatrix');

async function collectMetrics(teamId) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: { include: { user: { select: { id: true, name: true } } } } },
  });
  if (!team) return null;

  const tasks = await prisma.task.findMany({ where: { teamId } });
  const taskIds = tasks.map((t) => t.id);

  const metrics = [];
  for (const m of team.members) {
    const uid = m.userId;

    const doneTasks = tasks.filter((t) => t.assigneeId === uid && t.status === 'DONE');
    const N = doneTasks.length;

    let onTime = 0;
    for (const t of doneTasks) {
      if (!t.deadline || (t.completedAt && t.completedAt <= t.deadline)) onTime++;
    }
    const D = doneTasks.length === 0 ? 0 : onTime / doneTasks.length;

    const A = await prisma.comment.count({
      where: {
        authorId: uid,
        OR: [
          { teamId },
          { taskId: { in: taskIds } },
          { projectId: team.projectId },
        ],
      },
    });

    const ratings = await prisma.peerRating.findMany({ where: { teamId, rateeId: uid } });
    const G = ratings.length === 0
      ? 0
      : ratings.reduce((s, r) => s + r.score, 0) / ratings.length;

    metrics.push({ userId: uid, name: m.user.name, N, D, A, G });
  }
  return metrics;
}

async function computeContribution(teamId) {
  const metrics = await collectMetrics(teamId);
  if (!metrics) return null;
  if (metrics.length === 0) return { teamId, members: [], note: 'У команді немає учасників' };

  const pN = normalizeValues(metrics.map((m) => m.N));
  const pD = normalizeValues(metrics.map((m) => m.D));
  const pA = normalizeValues(metrics.map((m) => m.A));
  const pG = normalizeValues(metrics.map((m) => m.G));

  const [wN, wD, wA, wG] = CRITERIA_WEIGHTS;

  const members = metrics.map((m, i) => {
    const R = pN[i] * wN + pD[i] * wD + pA[i] * wA + pG[i] * wG;
    return {
      userId: m.userId,
      name: m.name,
      metrics: { N: m.N, D: Number(m.D.toFixed(3)), A: m.A, G: Number(m.G.toFixed(2)) },
      contribution: Number(R.toFixed(4)),
      contributionPercent: Number((R * 100).toFixed(2)),
    };
  });

  members.sort((a, b) => b.contribution - a.contribution);

  return {
    teamId,
    criteriaWeights: {
      tasks: Number(wN.toFixed(4)),
      timeliness: Number(wD.toFixed(4)),
      activity: Number(wA.toFixed(4)),
      cooperation: Number(wG.toFixed(4)),
    },
    criteriaConsistency: {
      CI: Number(CRITERIA_CONSISTENCY.CI.toFixed(4)),
      CR: Number(CRITERIA_CONSISTENCY.CR.toFixed(4)),
      acceptable: CRITERIA_CONSISTENCY.CI <= 0.1 && CRITERIA_CONSISTENCY.CR < 0.2,
    },
    members,
  };
}

module.exports = { collectMetrics, computeContribution };