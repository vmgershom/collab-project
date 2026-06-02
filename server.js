require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./src/routes/auth.routes');
const courseRoutes = require('./src/routes/courses.routes');
const sectionRoutes = require('./src/routes/sections.routes');
const projectRoutes = require('./src/routes/projects.routes');
const teamRoutes = require('./src/routes/teams.routes');
const invitationRoutes = require('./src/routes/invitations.routes');
const taskRoutes = require('./src/routes/tasks.routes');
const commentRoutes = require('./src/routes/comments.routes');
const ratingRoutes = require('./src/routes/ratings.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');
const gradeRoutes = require('./src/routes/grades.routes');
const calendarRoutes = require('./src/routes/calendar.routes');
const materialRoutes = require('./src/routes/materials.routes');
const submissionRoutes = require('./src/routes/submissions.routes');
const notificationRoutes = require('./src/routes/notifications.routes');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());

app.get('/', (req, res) => {
  res.send('Сервер працює!');
});

app.use('/', authRoutes);
app.use('/courses', courseRoutes);
app.use('/sections', sectionRoutes);
app.use('/projects', projectRoutes);
app.use('/teams', teamRoutes);
app.use('/invitations', invitationRoutes);
app.use('/tasks', taskRoutes);
app.use('/comments', commentRoutes);
app.use('/ratings', ratingRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/grades', gradeRoutes);
app.use('/calendar', calendarRoutes);
app.use('/materials', materialRoutes);
app.use('/submissions', submissionRoutes);
app.use('/notifications', notificationRoutes);

const { runNotificationChecks } = require('./src/utils/notificationChecks');
runNotificationChecks().catch((e) => console.error('notif checks', e));
setInterval(() => runNotificationChecks().catch((e) => console.error('notif checks', e)), 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});