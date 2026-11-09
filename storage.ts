import { AppState, Profile, BackupSnapshot } from '../types';
import { INITIAL_SUBJECTS_TEMPLATE, DEFAULT_DATESHEET } from '../data/defaultCurriculum';

const DB_NAME = 'AnshBhaiyaCBSETrackerDB';
const DB_VERSION = 1;
const STATE_STORE = 'app_state';
const BACKUPS_STORE = 'backup_snapshots';
const LOCAL_STORAGE_KEY = 'ansh_cbse_tracker_state_v1';
const LOCAL_BACKUPS_KEY = 'ansh_cbse_tracker_backups_v1';

export function createDefaultProfile(name: string = 'Class 10 Student'): Profile {
  const now = new Date().toISOString();
  return {
    id: `profile-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    name,
    targetScore: 95,
    subjects: JSON.parse(JSON.stringify(INITIAL_SUBJECTS_TEMPLATE)),
    datesheet: JSON.parse(JSON.stringify(DEFAULT_DATESHEET)),
    studyTasks: [],
    activityLog: {},
    studySessions: [],
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    createdAt: now,
  };
}

export function createInitialAppState(userId?: string): AppState {
  const defaultProf = createDefaultProfile('Class 10 Board Aspirant');
  return {
    appName: 'Ansh Bhaiya CBSE Tracker',
    schemaVersion: 1,
    profiles: [defaultProf],
    activeProfileId: defaultProf.id,
    theme: 'dark',
    userId,
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE);
      }
      if (!db.objectStoreNames.contains(BACKUPS_STORE)) {
        db.createObjectStore(BACKUPS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStateKey(userId?: string): string {
  return userId ? `current_state_${userId}` : 'current_state';
}

function getLocalKey(userId?: string): string {
  return userId ? `${LOCAL_STORAGE_KEY}_${userId}` : LOCAL_STORAGE_KEY;
}

export async function loadAppState(userId?: string): Promise<AppState> {
  const stateKey = getStateKey(userId);
  const localKey = getLocalKey(userId);

  try {
    const db = await openDB();
    const tx = db.transaction(STATE_STORE, 'readonly');
    const store = tx.objectStore(STATE_STORE);
    const getRequest = store.get(stateKey);

    const state = await new Promise<AppState | undefined>((resolve, reject) => {
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    });

    if (state && state.profiles && state.profiles.length > 0) {
      // Ensure backwards compatibility with newly added fields
      state.profiles.forEach((p) => {
        if (!p.studySessions) p.studySessions = [];
      });
      return state;
    }
  } catch (err) {
    console.warn('Could not read from IndexedDB, trying localStorage fallback', err);
  }

  // Fallback to localStorage
  try {
    const local = localStorage.getItem(localKey);
    if (local) {
      const parsed = JSON.parse(local) as AppState;
      if (parsed && parsed.profiles && parsed.profiles.length > 0) {
        parsed.profiles.forEach((p) => {
          if (!p.studySessions) p.studySessions = [];
        });
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading from localStorage fallback', e);
  }

  // If loading a specific non-admin user for the first time, check if there's unassigned guest data to adopt
  if (userId && !userId.includes('admin')) {
    const guestState = await loadAppState();
    if (guestState && !guestState.userId && guestState.profiles.length > 0) {
      const adoptedState: AppState = { ...guestState, userId };
      await saveAppState(adoptedState, userId);
      return adoptedState;
    }
  }

  // Brand new clean tracker for user
  const initialState = createInitialAppState(userId);
  await saveAppState(initialState, userId);
  return initialState;
}

export async function saveAppState(state: AppState, userId?: string): Promise<void> {
  const effectiveUserId = userId || state.userId;
  const stateKey = getStateKey(effectiveUserId);
  const localKey = getLocalKey(effectiveUserId);

  // Save to IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STATE_STORE, 'readwrite');
    const store = tx.objectStore(STATE_STORE);
    store.put(state, stateKey);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed saving state to IndexedDB', err);
  }

  // Mirror to localStorage
  try {
    localStorage.setItem(localKey, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed mirroring state to localStorage', err);
  }
}

export async function createAutomaticBackup(state: AppState): Promise<void> {
  try {
    const activeProf = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
    let totalChapters = 0;
    let completedTasks = 0;
    activeProf?.subjects.forEach((s) => {
      totalChapters += s.chapters.length;
      s.chapters.forEach((ch) => {
        Object.values(ch.tasks).forEach((st) => {
          if (st === 'completed') completedTasks++;
        });
      });
    });

    const snapshot: BackupSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: new Date().toISOString(),
      profileName: activeProf?.name || 'Student',
      chapterCount: totalChapters,
      completedTasksCount: completedTasks,
      state: JSON.parse(JSON.stringify(state)),
    };

    // Save snapshot in IndexedDB
    const db = await openDB();
    const tx = db.transaction(BACKUPS_STORE, 'readwrite');
    const store = tx.objectStore(BACKUPS_STORE);
    store.put(snapshot);

    // Keep only last 10 snapshots in IndexedDB
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const all: BackupSnapshot[] = allReq.result || [];
      if (all.length > 10) {
        all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const toDelete = all.slice(0, all.length - 10);
        toDelete.forEach((delSnap) => {
          store.delete(delSnap.id);
        });
      }
    };

    // Mirror recent backups to localStorage
    try {
      const localBackups = JSON.parse(localStorage.getItem(LOCAL_BACKUPS_KEY) || '[]') as BackupSnapshot[];
      localBackups.unshift(snapshot);
      localStorage.setItem(LOCAL_BACKUPS_KEY, JSON.stringify(localBackups.slice(0, 5)));
    } catch {
      // ignore
    }
  } catch (err) {
    console.warn('Failed creating automatic backup snapshot', err);
  }
}

export async function getBackupSnapshots(): Promise<BackupSnapshot[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(BACKUPS_STORE, 'readonly');
    const store = tx.objectStore(BACKUPS_STORE);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const list: BackupSnapshot[] = req.result || [];
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(list);
      };
      req.onerror = () => {
        const local = JSON.parse(localStorage.getItem(LOCAL_BACKUPS_KEY) || '[]');
        resolve(local);
      };
    });
  } catch {
    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_BACKUPS_KEY) || '[]');
      return local;
    } catch {
      return [];
    }
  }
}
