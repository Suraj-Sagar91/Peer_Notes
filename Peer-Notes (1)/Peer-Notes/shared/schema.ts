export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  avatar_color: string;
  semester: number;
  bio: string;
  total_uploads: number;
  total_downloads: number;
  created_at: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatar_color: string;
  semester: number;
  bio: string;
  total_uploads: number;
  total_downloads: number;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  icon: string;
  color: string;
  note_count: number;
}

export interface Note {
  id: string;
  title: string;
  description: string;
  subject_id: string;
  subject_name?: string;
  subject_code?: string;
  subject_color?: string;
  semester: number;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploader_id: string;
  uploader_username?: string;
  uploader_avatar_color?: string;
  approved: boolean;
  downloads: number;
  avg_rating: number;
  rating_count: number;
  like_count: number;
  user_liked?: boolean;
  user_rating?: number;
  created_at: string;
}

export interface Rating {
  id: string;
  note_id: string;
  user_id: string;
  rating: number;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_color: string;
  total_uploads: number;
  total_downloads: number;
  score: number;
  rank: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  semester?: number;
}
