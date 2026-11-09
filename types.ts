export type TaskKey =
  | 'theory'
  | 'ncert'
  | 'exemplar'
  | 'pyq'
  | 'cbq'
  | 'revision'
  | 'test';

export type TaskState = 'not_started' | 'in_progress' | 'completed';

export interface TaskDefinition {
  key: TaskKey;
  label: string;
  shortLabel: string;
  description: string;
  weight: number;
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  { key: 'theory', label: 'Theory', shortLabel: 'Theory', description: 'Concept clarity & lectures', weight: 1 },
  { key: 'ncert', label: 'NCERT Questions', shortLabel: 'NCERT', description: 'Intext & back exercises', weight: 1 },
  { key: 'exemplar', label: 'Exemplar', shortLabel: 'Exemplar', description: 'Advanced problem solving', weight: 1 },
  { key: 'pyq', label: 'PYQs', shortLabel: 'PYQs', description: 'Previous year board questions', weight: 1 },
  { key: 'cbq', label: 'Case Based (CBQs)', shortLabel: 'CBQs', description: 'Competency & case questions', weight: 1 },
  { key: 'revision', label: 'Revision', shortLabel: 'Revision', description: 'Formula sheets & mind maps', weight: 1 },
  { key: 'test', label: 'Chapter Test', shortLabel: 'Test', description: 'Timed assessment test', weight: 1 },
];

export interface Chapter {
  id: string;
  name: string;
  subjectId: string;
  tasks: Record<TaskKey, TaskState>;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type SubjectId = 'science' | 'maths' | 'social_science' | 'english' | 'hindi';

export interface Subject {
  id: SubjectId | string;
  name: string;
  color: string;
  accent: string;
  icon: string;
  chapters: Chapter[];
}

export interface DatesheetItem {
  id: string;
  subjectName: string;
  subjectId?: string;
  date: string; // YYYY-MM-DD
  time: string;
  examCode?: string;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export type ActivityLog = Record<string, number>; // "YYYY-MM-DD" -> count of completed actions

export interface StudySession {
  id: string;
  durationMinutes: number;
  subject: string;
  completedAt: string; // ISO string
  type: 'timer' | 'stopwatch';
  notes?: string;
}

export interface StopwatchLap {
  id: string;
  lapNumber: number;
  lapTimeMs: number;
  splitTimeMs: number;
}

export const ADMIN_EMAIL = 'ansh666960@gmail.com';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  isAdmin?: boolean;
}

export function isUserAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isAdmin || user.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase());
}

export interface Profile {
  id: string;
  name: string;
  targetScore: number;
  subjects: Subject[];
  datesheet: DatesheetItem[];
  studyTasks: StudyTask[];
  activityLog: ActivityLog;
  studySessions: StudySession[];
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  createdAt: string;
}

export interface AppState {
  appName: string;
  schemaVersion: number;
  profiles: Profile[];
  activeProfileId: string;
  theme: 'dark' | 'light';
  userId?: string;
}

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  profileName: string;
  chapterCount: number;
  completedTasksCount: number;
  state: AppState;
}

export type NavTab = 'dashboard' | 'chapters' | 'focus' | 'datesheet' | 'streak' | 'tasks' | 'settings';

