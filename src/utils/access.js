const prisma = require('../prismaClient');

async function getTeamAccess(teamId, user) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { project: true, members: true },
  });
  if (!team) return { team: null, allowed: false };
  const isOwner = user.role === 'TEACHER' && team.project.teacherId === user.userId;
  const isMember = team.members.some((m) => m.userId === user.userId);
  return { team, allowed: isOwner || isMember };
}

module.exports = { getTeamAccess };