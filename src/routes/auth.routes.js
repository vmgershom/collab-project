const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const upload = require('../upload');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Потрібні name, email і password' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Користувач з таким email вже існує' });
    }
    const pwOk =
      typeof password === 'string' &&
      password.length >= 8 &&
      /[a-zA-Z]/.test(password) &&
      /[0-9]/.test(password);
    if (!pwOk) {
      return res.status(400).json({
        error: 'Пароль має містити щонайменше 8 символів, хоча б одну латинську літеру та одну цифру',
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role === 'TEACHER' ? 'TEACHER' : 'STUDENT',
      },
    });
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Потрібні email і password' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Невірний email або пароль' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Невірний email або пароль' });
    }
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });
  res.json(user);
});

router.patch('/me', authenticate, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== req.user.userId) {
        return res.status(400).json({ error: 'Цей email вже використовується' });
      }
      data.email = email;
    }
    if (password !== undefined && password !== '') {
      const pwOk =
        typeof password === 'string' &&
        password.length >= 8 &&
        /[a-zA-Z]/.test(password) &&
        /[0-9]/.test(password);
      if (!pwOk) {
        return res.status(400).json({
          error: 'Пароль має містити щонайменше 8 символів, хоча б одну латинську літеру та одну цифру',
        });
      }
    }
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: { id: true, name: true, email: true, role: true, avatar: true },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

router.post('/me/avatar', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не надіслано' });
    const url = `/uploads/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { avatar: url },
      select: { id: true, name: true, email: true, role: true, avatar: true },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;