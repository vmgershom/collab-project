const TYPES = {
  PROJECT_DEADLINE_WEEK:   { role: 'STUDENT', label: 'Тиждень до дедлайну проєкту' },
  PROJECT_DEADLINE_DAY:    { role: 'STUDENT', label: 'День до дедлайну проєкту' },
  PROJECT_DEADLINE_MISSED: { role: 'STUDENT', label: 'Пропуск дедлайну проєкту' },
  PROJECT_OPENED:          { role: 'STUDENT', label: 'Відкриття проєкту до виконання' },
  SECTION_OPENED:          { role: 'STUDENT', label: 'Відкриття нового розділу' },
  GRADED:                  { role: 'STUDENT', label: 'Роботу оцінено викладачем' },
  NEW_PROJECT:             { role: 'STUDENT', label: 'Нові проєкти' },
  PRIVATE_COMMENT:         { role: 'STUDENT', label: 'Приватний коментар викладача' },
  TEAM_COMMENT:            { role: 'STUDENT', label: 'Новий коментар у команді' },
  TASK_ASSIGNED:           { role: 'STUDENT', label: 'Призначення завдання у команді' },
  TASK_DEADLINE_WEEK:      { role: 'STUDENT', label: 'Тиждень до дедлайну завдання' },
  TASK_DEADLINE_DAY:       { role: 'STUDENT', label: 'День до дедлайну завдання' },
  TASK_DEADLINE_MISSED:    { role: 'STUDENT', label: 'Пропуск дедлайну завдання' },
  TEAM_MEMBER_JOINED:      { role: 'STUDENT', label: 'Приєднання людини в команду' },
  TEAM_MEMBER_LEFT:        { role: 'STUDENT', label: 'Хтось покинув команду' },
  
  COURSE_JOINED:           { role: 'TEACHER', label: 'Студент приєднався до курсу' },
  COURSE_LEFT:             { role: 'TEACHER', label: 'Студент покинув курс' },
  SUBMISSION:              { role: 'TEACHER', label: 'Студент здав роботу' },
  T_PRIVATE_COMMENT:       { role: 'TEACHER', label: 'Новий приватний коментар' },
  PROJECT_COMMENT:         { role: 'TEACHER', label: 'Новий коментар під проєктом' },
  T_PROJECT_OPENED:        { role: 'TEACHER', label: 'Проєкт відкрився для студентів' },
  T_SECTION_OPENED:        { role: 'TEACHER', label: 'Розділ відкрився для студентів' },
  T_PROJECT_DEADLINE:      { role: 'TEACHER', label: 'Настав дедлайн проєкту' },
};

module.exports = { TYPES };