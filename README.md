# Collab

Вебзастосунок для організації командної роботи студентів над навчальними проєктами з **автоматичним оцінюванням внеску кожного учасника** на основі методу аналізу ієрархій.

## Технології

- **Бекенд:** Node.js, Express, Prisma ORM, PostgreSQL, JWT, bcryptjs, multer (завантаження файлів).
- **Фронтенд:** React, Vite, React Router.
- **Допоміжні бібліотеки:** dotenv, react-datepicker, react-quill-new, dompurify, react-icons.

## Структура проєкту

```
collab-app/
├─ prisma/
│  ├─ schema.prisma        # модель бази даних
│  └─ migrations/          # міграції
├─ src/
│  ├─ routes/              # маршрути API
│  ├─ services/            # бізнес-логіка (зокрема розрахунок внеску)
│  ├─ utils/               # допоміжні модулі (AHP, доступи, матриця критеріїв)
│  ├─ middleware/          # автентифікація
│  ├─ prismaClient.js
│  └─ upload.js            # налаштування завантаження файлів
├─ server.js               # точка входу бекенда
└─ client/                 # фронтенд (React + Vite)
   └─ src/
      ├─ pages/            # сторінки
      ├─ components/       # компоненти
      ├─ api.js            # звернення до API
      └─ auth.js           # робота з токеном
```
