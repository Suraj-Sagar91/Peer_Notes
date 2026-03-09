import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as storage from "./storage";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: "Admin only" });
  next();
}

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const PgSession = connectPgSimple(session);

  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'peer-notes-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  }));

  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  }, (req, res, next) => {
    const filePath = path.join(process.cwd(), 'uploads', path.basename(req.path));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  });

  // AUTH
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password, semester } = req.body;
      if (!username || !email || !password) return res.status(400).json({ message: 'All fields required' });
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) return res.status(409).json({ message: 'Username already taken' });

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) return res.status(409).json({ message: 'Email already registered' });

      const user = await storage.createUser({ username, email, password, semester });
      req.session.userId = user.id;
      res.status(201).json({ user });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const valid = await storage.verifyPassword(user, password);
      if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

      req.session.userId = user.id;
      const { password_hash, ...publicUser } = user as any;
      res.json({ user: publicUser });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });
    res.json({ user });
  });

  // SUBJECTS
  app.get('/api/subjects', async (_req, res) => {
    const subjects = await storage.getSubjects();
    res.json(subjects);
  });

  // NOTES
  app.get('/api/notes', async (req, res) => {
    try {
      const { subject_id, semester, search } = req.query;
      const userId = req.session.userId;
      const notes = await storage.getNotes({
        subject_id: subject_id as string,
        semester: semester ? parseInt(semester as string) : undefined,
        search: search as string,
        userId,
        approvedOnly: true,
      });
      res.json(notes);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get('/api/notes/:id', async (req, res) => {
    const note = await storage.getNoteById(req.params.id, req.session.userId);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  });

  app.post('/api/notes', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'File required' });
      const { title, description, subject_id, semester } = req.body;
      if (!title || !subject_id || !semester) return res.status(400).json({ message: 'Title, subject, and semester required' });

      const file_url = `/uploads/${req.file.filename}`;
      const note = await storage.createNote({
        title,
        description: description || '',
        subject_id,
        semester: parseInt(semester),
        file_url,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        uploader_id: req.session.userId!,
      });
      res.status(201).json(note);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post('/api/notes/:id/like', requireAuth, async (req, res) => {
    try {
      const result = await storage.toggleLike(req.params.id, req.session.userId!);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post('/api/notes/:id/rate', requireAuth, async (req, res) => {
    try {
      const { rating } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' });
      const result = await storage.rateNote(req.params.id, req.session.userId!, parseInt(rating));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post('/api/notes/:id/download', requireAuth, async (req, res) => {
    try {
      await storage.recordDownload(req.params.id, req.session.userId!);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // LEADERBOARD
  app.get('/api/leaderboard', async (_req, res) => {
    const leaders = await storage.getLeaderboard();
    res.json(leaders);
  });

  // RECOMMENDATIONS
  app.get('/api/recommendations', requireAuth, async (req, res) => {
    const notes = await storage.getRecommendations(req.session.userId!);
    res.json(notes);
  });

  // PROFILE
  app.get('/api/users/:id', async (req, res) => {
    const user = await storage.getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  });

  app.get('/api/users/:id/notes', async (req, res) => {
    const notes = await storage.getNotes({ uploaderId: req.params.id, approvedOnly: true });
    res.json(notes);
  });

  // ADMIN
  app.get('/api/admin/notes', requireAdmin, async (_req, res) => {
    const notes = await storage.getAllNotesAdmin();
    res.json(notes);
  });

  app.put('/api/admin/notes/:id/approve', requireAdmin, async (req, res) => {
    await storage.approveNote(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/admin/notes/:id', requireAdmin, async (req, res) => {
    await storage.deleteNote(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/admin/users', requireAdmin, async (_req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    await storage.deleteUser(req.params.id);
    res.json({ success: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
