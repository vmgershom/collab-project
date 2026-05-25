const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const day = (offset) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
const pick = (arr, i) => arr[i % arr.length];

const TASK_TITLES = ['Аналіз вимог', 'Проєктування інтерфейсу', 'Реалізація бекенду', 'Реалізація фронтенду', 'Тестування', 'Підготовка звіту'];
const TEAM_COMMENTS = [
  'Розподілили завдання, починаємо',
  'Я візьму бекенд, хто береться за фронтенд?',
  'Окей, фронтенд на мені',
  'Залив першу версію, гляньте як буде час',
  'Знайшов баг у формі реєстрації, уже виправляю',
  'Перевірте мою частину, начебто працює',
  'Звіт майже готовий, лишилось оформлення',
  'Завтра зранку здаємо, не забудьте свої частини',
];

async function main() {
  // 1. ОЧИЩЕННЯ (порядок важливий через зовнішні ключі)
  await prisma.peerRating.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.materialFile.deleteMany();
  await prisma.material.deleteMany();
  await prisma.task.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.team.deleteMany();
  await prisma.project.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  console.log('Базу очищено.');

  const pass = await bcrypt.hash('test1234', 10);

  const teacher = await prisma.user.create({
    data: { role: 'TEACHER', name: 'Коваленко Ірина Петрівна', email: 't1@test.com', password: pass },
  });

  const studentData = [
    'ІС-XX Мандріка Віталій',
    'ІС-XX Шевченко Олег',
    'ІС-XX Ткаченко Андрій',
    'ІС-XX Бондаренко Софія',
    'ІС-XX Коваль Дмитро',
    'ІС-XX Лисенко Марія',
    'ІС-XX Поліщук Артем',
    'ІС-XX Савченко Юлія',
  ];
  const students = [];
  for (let i = 0; i < studentData.length; i++) {
    students.push(await prisma.user.create({
      data: { role: 'STUDENT', name: studentData[i], email: `s${i + 1}@test.com`, password: pass },
    }));
  }
  console.log(`Створено викладача t1@test.com та ${students.length} студентів (s1..s8@test.com). Пароль: test1234`);

  async function buildCourse({ courseName, courseDesc, enrolled, projects }) {
    const course = await prisma.course.create({
      data: { name: courseName, description: courseDesc, teacherId: teacher.id },
    });
    for (const s of enrolled) {
      await prisma.enrollment.create({ data: { courseId: course.id, userId: s.id } });
    }

    for (const p of projects) {
      const project = await prisma.project.create({
        data: { name: p.name, description: p.desc, deadline: day(p.deadline), courseId: course.id, teacherId: teacher.id },
      });

      for (const t of p.teams) {
        const team = await prisma.team.create({
          data: { name: t.name, status: 'SUBMITTED', openJoin: false, projectId: project.id },
        });
        await prisma.teamMember.createMany({ data: t.members.map((s) => ({ teamId: team.id, userId: s.id })) });

        const taskDeadline = day(p.deadline - 2);
        const createdTasks = [];
        for (let k = 0; k < t.members.length; k++) {
          // більшість встигає вчасно, останній учасник здає із запізненням
          const isLate = k === t.members.length - 1;
          const completedAt = isLate ? day(p.deadline - 1) : day(p.deadline - 4 - k);
          const task = await prisma.task.create({
            data: {
              title: pick(TASK_TITLES, k),
              description: 'Демонстраційне завдання',
              status: 'DONE',
              deadline: taskDeadline,
              completedAt,
              teamId: team.id,
              assigneeId: t.members[k].id,
              createdById: t.members[0].id,
            },
          });
          createdTasks.push(task);
        }

        // взаємні оцінки (варіюємо 3..5)
        for (let a = 0; a < t.members.length; a++) {
          for (let b = 0; b < t.members.length; b++) {
            if (a === b) continue;
            await prisma.peerRating.create({
              data: { raterId: t.members[a].id, rateeId: t.members[b].id, teamId: team.id, score: 3 + ((a + b) % 3) },
            });
          }
        }

        // коментарі в загальній гілці (різні автори, без крапок, у недалекому минулому)
        const howMany = Math.min(TEAM_COMMENTS.length, 4 + t.members.length);
        for (let c = 0; c < howMany; c++) {
          await prisma.comment.create({
            data: {
              content: TEAM_COMMENTS[c],
              authorId: pick(t.members, c).id,
              teamId: team.id,
              createdAt: day(c - howMany),
            },
          });
        }
        // пара коментарів у гілці конкретного завдання
        await prisma.comment.create({
          data: { content: 'Тут потрібно ще додати валідацію', authorId: t.members[0].id, teamId: team.id, taskId: createdTasks[0].id, createdAt: day(-3) },
        });
        await prisma.comment.create({
          data: { content: 'Додав, можна перевіряти', authorId: pick(t.members, 1).id, teamId: team.id, taskId: createdTasks[0].id, createdAt: day(-2) },
        });

        await prisma.submission.create({ data: { fileName: 'Звіт команди.pdf', teamId: team.id, studentId: t.members[0].id } });
      }

      // оцінки викладача за проєкт усім учасникам команд цього проєкту
      const allMembers = p.teams.flatMap((t) => t.members);
      for (const s of allMembers) {
        await prisma.grade.create({
          data: { score: 78 + Math.floor(Math.random() * 18), studentId: s.id, projectId: project.id, teacherId: teacher.id },
        });
      }
    }

    await prisma.material.create({
      data: { title: 'Методичні вказівки', description: 'Загальні вимоги до оформлення робіт', courseId: course.id, uploadedById: teacher.id },
    });

    return course;
  }

  // КУРС 1: 8 студентів, команди 3+3+2
  const teamA = students.slice(0, 3);
  const teamB = students.slice(3, 6);
  const teamC = students.slice(6, 8);

  await buildCourse({
    courseName: 'Програмна інженерія',
    courseDesc: 'Курс 8-го семестру',
    enrolled: students,
    projects: [
      { name: 'Командний проєкт №1', desc: 'Розробка вебзастосунку', deadline: 5,
        teams: [
          { name: 'Команда Альфа', members: teamA },
          { name: 'Команда Бета', members: teamB },
          { name: 'Команда Гамма', members: teamC },
        ] },
      { name: 'Командний проєкт №2', desc: 'Проєктування бази даних', deadline: 12,
        teams: [
          { name: 'Альфа (проєкт 2)', members: teamA },
          { name: 'Бета (проєкт 2)', members: teamB },
        ] },
    ],
  });

  // КУРС 2: частина тих самих студентів
  const course2Students = students.slice(0, 5);
  await buildCourse({
    courseName: 'Бази даних',
    courseDesc: 'Курс 7-го семестру',
    enrolled: course2Students,
    projects: [
      { name: 'Лабораторний проєкт', desc: 'Нормалізація та запити', deadline: 8,
        teams: [
          { name: 'Група 1', members: course2Students.slice(0, 3) },
          { name: 'Група 2', members: course2Students.slice(3, 5) },
        ] },
      { name: 'Курсова робота', desc: 'Проєктування інформаційної системи', deadline: 20,
        teams: [
          { name: 'Команда БД', members: course2Students.slice(0, 3) },
        ] },
    ],
  });

  console.log('Демо-дані створено.');
  console.log('Вхід: t1@test.com (викладач), s1@test.com … s8@test.com (студенти). Пароль: test1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });