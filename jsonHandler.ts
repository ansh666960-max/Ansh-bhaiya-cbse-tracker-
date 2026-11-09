import { AppState, Profile, Subject, Chapter, TaskKey, TaskState } from '../types';
import { INITIAL_SUBJECTS_TEMPLATE, DEFAULT_DATESHEET, DEFAULT_TASKS_STATE } from '../data/defaultCurriculum';
import { calculateStreaks } from './streak';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sourceType?: 'ansh_v1' | 'sunil_bhaiya' | 'legacy_single' | 'unknown';
  normalizedState?: AppState;
  stats?: {
    profilesCount: number;
    totalChapters: number;
    completedChapters: number;
  };
}

const VALID_TASK_KEYS: TaskKey[] = ['theory', 'ncert', 'exemplar', 'pyq', 'cbq', 'revision', 'test'];

function sanitizeTaskState(val: unknown): TaskState {
  if (val === 'completed' || val === true || val === 1) return 'completed';
  if (val === 'in_progress' || val === 'inProgress' || val === 0.5) return 'in_progress';
  return 'not_started';
}

function sanitizeChapterTasks(rawTasks: unknown): Record<TaskKey, TaskState> {
  const result: Record<TaskKey, TaskState> = { ...DEFAULT_TASKS_STATE };
  if (!rawTasks || typeof rawTasks !== 'object') return result;

  const r = rawTasks as Record<string, unknown>;
  // Direct matches
  VALID_TASK_KEYS.forEach((key) => {
    if (key in r) {
      result[key] = sanitizeTaskState(r[key]);
    }
  });

  // Legacy Sunil Bhaiya aliases mapping
  if ('ncertQuestions' in r && !('ncert' in r)) result.ncert = sanitizeTaskState(r.ncertQuestions);
  if ('caseBased' in r && !('cbq' in r)) result.cbq = sanitizeTaskState(r.caseBased);
  if ('cbqs' in r && !('cbq' in r)) result.cbq = sanitizeTaskState(r.cbqs);
  if ('pyqs' in r && !('pyq' in r)) result.pyq = sanitizeTaskState(r.pyqs);
  if ('tests' in r && !('test' in r)) result.test = sanitizeTaskState(r.tests);
  if ('testSeries' in r && !('test' in r)) result.test = sanitizeTaskState(r.testSeries);

  return result;
}

function sanitizeSubject(rawSub: unknown, fallbackIndex: number): Subject {
  const defaultTemplates = INITIAL_SUBJECTS_TEMPLATE;
  const s = (rawSub || {}) as Record<string, unknown>;
  const rawId = String(s.id || s.subjectId || defaultTemplates[fallbackIndex % defaultTemplates.length]?.id || `sub-${fallbackIndex}`);
  const rawName = String(s.name || s.subjectName || defaultTemplates[fallbackIndex % defaultTemplates.length]?.name || `Subject ${fallbackIndex + 1}`);

  const matchTemplate = defaultTemplates.find((t) => t.id === rawId || t.name.toLowerCase() === rawName.toLowerCase());

  const rawChapters = Array.isArray(s.chapters) ? s.chapters : [];
  const chapters: Chapter[] = rawChapters.map((rawCh: unknown, idx: number) => {
    const ch = (rawCh || {}) as Record<string, unknown>;
    return {
      id: String(ch.id || `${rawId}-ch-${idx + 1}-${Date.now().toString(36)}`),
      name: String(ch.name || ch.title || ch.chapterName || `Chapter ${idx + 1}`),
      subjectId: rawId,
      tasks: sanitizeChapterTasks(ch.tasks),
      notes: typeof ch.notes === 'string' ? ch.notes : '',
      createdAt: String(ch.createdAt || new Date().toISOString()),
      updatedAt: String(ch.updatedAt || new Date().toISOString()),
    };
  });

  return {
    id: rawId,
    name: rawName,
    color: String(s.color || matchTemplate?.color || 'from-indigo-500 to-purple-600'),
    accent: String(s.accent || matchTemplate?.accent || 'indigo'),
    icon: String(s.icon || matchTemplate?.icon || 'BookOpen'),
    chapters,
  };
}

function sanitizeProfile(rawProf: unknown, index: number): Profile {
  const p = (rawProf || {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const id = String(p.id || `profile-${index + 1}-${Date.now().toString(36)}`);
  const name = String(p.name || p.studentName || p.profileName || `Student ${index + 1}`);
  const targetScore = typeof p.targetScore === 'number' ? Math.min(100, Math.max(0, p.targetScore)) : 95;

  let subjects: Subject[] = [];
  if (Array.isArray(p.subjects) && p.subjects.length > 0) {
    subjects = p.subjects.map((sub, sIdx) => sanitizeSubject(sub, sIdx));
  } else {
    // Check if flat chapters exist on profile
    subjects = JSON.parse(JSON.stringify(INITIAL_SUBJECTS_TEMPLATE));
  }

  // Ensure all 5 core subjects exist even if empty
  INITIAL_SUBJECTS_TEMPLATE.forEach((template) => {
    if (!subjects.some((s) => s.id === template.id || s.name.toLowerCase() === template.name.toLowerCase())) {
      subjects.push(JSON.parse(JSON.stringify(template)));
    }
  });

  const datesheet = Array.isArray(p.datesheet) && p.datesheet.length > 0
    ? p.datesheet.map((d: Record<string, unknown>, dIdx: number) => ({
        id: String(d.id || `date-${dIdx + 1}`),
        subjectName: String(d.subjectName || d.subject || 'Examination'),
        subjectId: d.subjectId ? String(d.subjectId) : undefined,
        date: String(d.date || '2027-02-17'),
        time: String(d.time || '10:30 AM - 01:30 PM'),
        examCode: d.examCode ? String(d.examCode) : undefined,
      }))
    : JSON.parse(JSON.stringify(DEFAULT_DATESHEET));

  const studyTasks = Array.isArray(p.studyTasks)
    ? p.studyTasks.map((t: Record<string, unknown>, tIdx: number) => ({
        id: String(t.id || `task-${tIdx + 1}`),
        title: String(t.title || 'Study Task'),
        subject: String(t.subject || 'General'),
        priority: (t.priority === 'high' || t.priority === 'low' ? t.priority : 'medium') as 'high' | 'medium' | 'low',
        dueDate: String(t.dueDate || new Date().toISOString().split('T')[0]),
        completed: Boolean(t.completed),
        completedAt: t.completedAt ? String(t.completedAt) : undefined,
        createdAt: String(t.createdAt || now),
      }))
    : [];

  const activityLog = (typeof p.activityLog === 'object' && p.activityLog !== null
    ? p.activityLog
    : {}) as Record<string, number>;

  const { currentStreak, longestStreak } = calculateStreaks(activityLog);

  const studySessions = Array.isArray(p.studySessions)
    ? p.studySessions.map((s: Record<string, unknown>, sIdx: number) => ({
        id: String(s.id || `session-${sIdx + 1}`),
        durationMinutes: typeof s.durationMinutes === 'number' ? s.durationMinutes : 25,
        subject: String(s.subject || 'General'),
        completedAt: String(s.completedAt || now),
        type: (s.type === 'stopwatch' ? 'stopwatch' : 'timer') as 'timer' | 'stopwatch',
        notes: typeof s.notes === 'string' ? s.notes : undefined,
      }))
    : [];

  return {
    id,
    name,
    targetScore,
    subjects,
    datesheet,
    studyTasks,
    activityLog,
    studySessions,
    currentStreak: typeof p.currentStreak === 'number' ? Math.max(p.currentStreak, currentStreak) : currentStreak,
    longestStreak: typeof p.longestStreak === 'number' ? Math.max(p.longestStreak, longestStreak) : longestStreak,
    lastActiveDate: p.lastActiveDate ? String(p.lastActiveDate) : null,
    createdAt: String(p.createdAt || now),
  };
}

export function validateAndNormalizeJSON(jsonString: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { valid: false, error: 'Invalid JSON syntax. Please check the file formatting.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Parsed JSON root is not an object or array.' };
  }

  let sourceType: 'ansh_v1' | 'sunil_bhaiya' | 'legacy_single' | 'unknown' = 'unknown';
  const root = parsed as Record<string, unknown>;

  if (root.appName === 'Ansh Bhaiya CBSE Tracker') {
    sourceType = 'ansh_v1';
  } else if (
    root.appName?.toString().toLowerCase().includes('sunil') ||
    root.appName?.toString().toLowerCase().includes('cbse')
  ) {
    sourceType = 'sunil_bhaiya';
  } else {
    sourceType = 'legacy_single';
  }

  const profiles: Profile[] = [];
  let activeProfileId = '';

  // Case 1: Standard profiles array exists
  if (Array.isArray(root.profiles) && root.profiles.length > 0) {
    root.profiles.forEach((p, idx) => {
      profiles.push(sanitizeProfile(p, idx));
    });
    activeProfileId = String(root.activeProfileId || profiles[0].id);
  }
  // Case 2: Array of profiles at root
  else if (Array.isArray(parsed) && parsed.length > 0) {
    parsed.forEach((p, idx) => {
      profiles.push(sanitizeProfile(p, idx));
    });
    activeProfileId = profiles[0].id;
  }
  // Case 3: Flat single tracker format (common in earlier versions / Sunil Bhaiya export)
  else if (root.subjects && Array.isArray(root.subjects)) {
    const singleProf = sanitizeProfile(root, 0);
    profiles.push(singleProf);
    activeProfileId = singleProf.id;
    if (sourceType === 'legacy_single' && root.appName?.toString().toLowerCase().includes('sunil')) {
      sourceType = 'sunil_bhaiya';
    }
  } else {
    return {
      valid: false,
      error: 'Unrecognized tracker structure. The JSON must contain either a "profiles" array or "subjects" list.',
    };
  }

  // Ensure activeProfileId points to a real profile
  if (!profiles.some((p) => p.id === activeProfileId)) {
    activeProfileId = profiles[0].id;
  }

  // Calculate stats for preview
  let totalChapters = 0;
  let completedChapters = 0;
  profiles.forEach((p) => {
    p.subjects.forEach((s) => {
      totalChapters += s.chapters.length;
      s.chapters.forEach((ch) => {
        const isComplete = Object.values(ch.tasks).length > 0 && Object.values(ch.tasks).every((t) => t === 'completed');
        if (isComplete) completedChapters++;
      });
    });
  });

  const normalizedState: AppState = {
    appName: 'Ansh Bhaiya CBSE Tracker',
    schemaVersion: 1,
    profiles,
    activeProfileId,
    theme: (root.theme === 'light' ? 'light' : 'dark'),
  };

  return {
    valid: true,
    sourceType,
    normalizedState,
    stats: {
      profilesCount: profiles.length,
      totalChapters,
      completedChapters,
    },
  };
}

export function exportTrackerBlob(state: AppState): { jsonString: string; filename: string } {
  const exportPayload = {
    appName: 'Ansh Bhaiya CBSE Tracker',
    schemaVersion: 1,
    exportDate: new Date().toISOString(),
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `Ansh_Bhaiya_CBSE_Tracker_Backup_${dateStr}.json`;

  return { jsonString, filename };
}

export function downloadTrackerJSON(state: AppState): void {
  const { jsonString, filename } = exportTrackerBlob(state);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
