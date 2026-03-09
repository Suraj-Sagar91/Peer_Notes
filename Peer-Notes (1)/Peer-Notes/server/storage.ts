import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import type { User, PublicUser, Subject, Note, LeaderboardEntry, RegisterRequest } from '../shared/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

function toPublicUser(u: User): PublicUser {
  const { password_hash, ...pub } = u as any;
  return pub as PublicUser;
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const r = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!r.rows[0]) return null;
  return toPublicUser(r.rows[0]);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const r = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return r.rows[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return r.rows[0] || null;
}

export async function createUser(data: RegisterRequest): Promise<PublicUser> {
  const hash = await bcrypt.hash(data.password, 10);
  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];
  const r = await pool.query(
    `INSERT INTO users (username, email, password_hash, role, avatar_color, semester, bio)
     VALUES ($1, $2, $3, 'student', $4, $5, '') RETURNING *`,
    [data.username, data.email, hash, avatar_color, data.semester || 1]
  );
  return toPublicUser(r.rows[0]);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export async function getSubjects(): Promise<Subject[]> {
  const r = await pool.query('SELECT * FROM subjects ORDER BY name');
  return r.rows;
}

export async function getNotes(filters: {
  subject_id?: string;
  semester?: number;
  search?: string;
  userId?: string;
  approvedOnly?: boolean;
  uploaderId?: string;
}): Promise<Note[]> {
  const params: (string | number | boolean)[] = [];
  const conditions: string[] = ['1=1'];

  if (filters.approvedOnly !== false) {
    params.push(true);
    conditions.push(`n.approved = $${params.length}`);
  }
  if (filters.subject_id) {
    params.push(filters.subject_id);
    conditions.push(`n.subject_id = $${params.length}`);
  }
  if (filters.semester) {
    params.push(filters.semester);
    conditions.push(`n.semester = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(n.title ILIKE $${params.length} OR n.description ILIKE $${params.length})`);
  }
  if (filters.uploaderId) {
    params.push(filters.uploaderId);
    conditions.push(`n.uploader_id = $${params.length}`);
  }

  let userLikedExpr = 'false as user_liked';
  if (filters.userId) {
    params.push(filters.userId);
    userLikedExpr = `EXISTS(SELECT 1 FROM likes l WHERE l.note_id = n.id AND l.user_id = $${params.length}) as user_liked`;
  }

  const query = `
    SELECT n.*, 
      s.name as subject_name, s.code as subject_code, s.color as subject_color,
      u.username as uploader_username, u.avatar_color as uploader_avatar_color,
      ${userLikedExpr}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    LEFT JOIN users u ON n.uploader_id = u.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY n.created_at DESC
  `;

  const r = await pool.query(query, params);
  return r.rows;
}

export async function getNoteById(id: string, userId?: string): Promise<Note | null> {
  let userExpr = 'false as user_liked, null as user_rating';
  const params: string[] = [id];
  if (userId) {
    params.push(userId);
    userExpr = `EXISTS(SELECT 1 FROM likes l WHERE l.note_id = n.id AND l.user_id = $2) as user_liked,
      (SELECT rating FROM ratings r WHERE r.note_id = n.id AND r.user_id = $2) as user_rating`;
  }
  const r = await pool.query(
    `SELECT n.*, 
      s.name as subject_name, s.code as subject_code, s.color as subject_color,
      u.username as uploader_username, u.avatar_color as uploader_avatar_color,
      ${userExpr}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    LEFT JOIN users u ON n.uploader_id = u.id
    WHERE n.id = $1`,
    params
  );
  return r.rows[0] || null;
}

export async function createNote(data: {
  title: string;
  description: string;
  subject_id: string;
  semester: number;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploader_id: string;
}): Promise<Note> {
  const r = await pool.query(
    `INSERT INTO notes (title, description, subject_id, semester, file_url, file_name, file_type, file_size, uploader_id, approved)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false) RETURNING *`,
    [data.title, data.description, data.subject_id, data.semester, data.file_url, data.file_name, data.file_type, data.file_size, data.uploader_id]
  );
  await pool.query('UPDATE users SET total_uploads = total_uploads + 1 WHERE id = $1', [data.uploader_id]);
  return r.rows[0];
}

export async function approveNote(id: string): Promise<void> {
  await pool.query('UPDATE notes SET approved = true WHERE id = $1', [id]);
  await pool.query(
    'UPDATE subjects SET note_count = note_count + 1 WHERE id = (SELECT subject_id FROM notes WHERE id = $1)',
    [id]
  );
}

export async function deleteNote(id: string): Promise<void> {
  const note = await pool.query('SELECT * FROM notes WHERE id = $1', [id]);
  if (note.rows[0]) {
    await pool.query('UPDATE users SET total_uploads = GREATEST(0, total_uploads - 1) WHERE id = $1', [note.rows[0].uploader_id]);
    if (note.rows[0].approved) {
      await pool.query(
        'UPDATE subjects SET note_count = GREATEST(0, note_count - 1) WHERE id = $1',
        [note.rows[0].subject_id]
      );
    }
  }
  await pool.query('DELETE FROM notes WHERE id = $1', [id]);
}

export async function toggleLike(noteId: string, userId: string): Promise<{ liked: boolean; count: number }> {
  const existing = await pool.query('SELECT id FROM likes WHERE note_id = $1 AND user_id = $2', [noteId, userId]);
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM likes WHERE note_id = $1 AND user_id = $2', [noteId, userId]);
    await pool.query('UPDATE notes SET like_count = GREATEST(0, like_count - 1) WHERE id = $1', [noteId]);
  } else {
    await pool.query('INSERT INTO likes (note_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [noteId, userId]);
    await pool.query('UPDATE notes SET like_count = like_count + 1 WHERE id = $1', [noteId]);
  }
  const r = await pool.query('SELECT like_count FROM notes WHERE id = $1', [noteId]);
  return { liked: existing.rows.length === 0, count: r.rows[0]?.like_count || 0 };
}

export async function rateNote(noteId: string, userId: string, rating: number): Promise<{ avg_rating: number; rating_count: number }> {
  await pool.query(
    `INSERT INTO ratings (note_id, user_id, rating) VALUES ($1, $2, $3)
     ON CONFLICT (note_id, user_id) DO UPDATE SET rating = $3`,
    [noteId, userId, rating]
  );
  const r = await pool.query(
    'SELECT AVG(rating)::DECIMAL(3,2) as avg_rating, COUNT(*) as rating_count FROM ratings WHERE note_id = $1',
    [noteId]
  );
  const { avg_rating, rating_count } = r.rows[0];
  await pool.query('UPDATE notes SET avg_rating = $1, rating_count = $2 WHERE id = $3', [avg_rating, rating_count, noteId]);
  return { avg_rating: parseFloat(avg_rating), rating_count: parseInt(rating_count) };
}

export async function recordDownload(noteId: string, userId: string): Promise<void> {
  await pool.query(
    'INSERT INTO user_downloads (note_id, user_id) VALUES ($1, $2)',
    [noteId, userId]
  );
  await pool.query('UPDATE notes SET downloads = downloads + 1 WHERE id = $1', [noteId]);
  await pool.query('UPDATE users SET total_downloads = total_downloads + 1 WHERE id = $1', [userId]);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const r = await pool.query(`
    SELECT id, username, avatar_color, total_uploads, total_downloads,
      (total_uploads * 10 + total_downloads) as score
    FROM users
    ORDER BY score DESC
    LIMIT 20
  `);
  return r.rows.map((row, i) => ({ ...row, rank: i + 1, score: parseInt(row.score) }));
}

export async function getRecommendations(userId: string, limit = 6): Promise<Note[]> {
  const r = await pool.query(`
    SELECT n.*, 
      s.name as subject_name, s.code as subject_code, s.color as subject_color,
      u.username as uploader_username, u.avatar_color as uploader_avatar_color,
      false as user_liked
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    LEFT JOIN users u ON n.uploader_id = u.id
    WHERE n.approved = true
    AND n.id NOT IN (
      SELECT note_id FROM user_downloads WHERE user_id = $1
    )
    AND n.subject_id IN (
      SELECT DISTINCT n2.subject_id FROM user_downloads ud
      JOIN notes n2 ON ud.note_id = n2.id
      WHERE ud.user_id = $1
    )
    ORDER BY n.avg_rating DESC, n.downloads DESC
    LIMIT $2
  `, [userId, limit]);

  let rows = r.rows;
  if (rows.length < limit) {
    const existing = rows.map(row => `'${row.id}'`).join(',') || `'none'`;
    const fallback = await pool.query(`
      SELECT n.*, 
        s.name as subject_name, s.code as subject_code, s.color as subject_color,
        u.username as uploader_username, u.avatar_color as uploader_avatar_color,
        false as user_liked
      FROM notes n
      LEFT JOIN subjects s ON n.subject_id = s.id
      LEFT JOIN users u ON n.uploader_id = u.id
      WHERE n.approved = true AND n.id NOT IN (${existing})
      ORDER BY n.avg_rating DESC, n.downloads DESC
      LIMIT $1
    `, [limit - rows.length]);
    rows = [...rows, ...fallback.rows];
  }
  return rows;
}

export async function getAllUsers(): Promise<PublicUser[]> {
  const r = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  return r.rows.map(toPublicUser);
}

export async function deleteUser(id: string): Promise<void> {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

export async function getAllNotesAdmin(): Promise<Note[]> {
  const r = await pool.query(`
    SELECT n.*, 
      s.name as subject_name, s.code as subject_code, s.color as subject_color,
      u.username as uploader_username, u.avatar_color as uploader_avatar_color,
      false as user_liked
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    LEFT JOIN users u ON n.uploader_id = u.id
    ORDER BY n.approved ASC, n.created_at DESC
  `);
  return r.rows;
}

