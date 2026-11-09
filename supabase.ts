import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthUser } from '../types';

const LOCAL_STORAGE_SESSION_KEY = 'ansh_cbse_auth_user_v1';
const LOCAL_STORAGE_USERS_DB_KEY = 'ansh_cbse_local_users_db_v1';
const SUPABASE_CONFIG_KEY = 'ansh_cbse_supabase_config_v1';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  if (envUrl && envKey && !envUrl.includes('your-project')) {
    return { url: envUrl, anonKey: envKey };
  }

  try {
    const custom = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.url && parsed.anonKey) return parsed;
    }
  } catch {
    // ignore
  }

  return { url: envUrl, anonKey: envKey };
}

export function saveStoredSupabaseConfig(config: SupabaseConfig) {
  try {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey || config.url.includes('your-project')) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseInstance;
}

export function resetSupabaseClient() {
  supabaseInstance = null;
}

// Convert Supabase User to AuthUser
function formatAuthUser(user: User): AuthUser {
  const isAdm = user.email?.toLowerCase().trim() === 'ansh666960@gmail.com';
  return {
    id: isAdm ? 'admin_ansh666960_private' : user.id,
    email: user.email || '',
    name: isAdm ? 'Ansh Bhaiya (Admin)' : user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student',
    createdAt: user.created_at || new Date().toISOString(),
    isAdmin: isAdm,
  };
}

// Get locally saved user for offline/session persistence
export function getStoredLocalUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function setStoredLocalUser(user: AuthUser | null) {
  try {
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

// Local mock DB helper for offline or when Supabase project is not yet connected
function getLocalUsersDb(): Array<{ id: string; email: string; name: string; passwordHash: string; createdAt: string }> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_DB_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalUsersDb(db: Array<{ id: string; email: string; name: string; passwordHash: string; createdAt: string }>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
}

// SHA-256 for local offline credential protection (never store plaintext)
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Auth API Methods

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<{ user: AuthUser | null; error: string | null; requiresEmailConfirmation?: boolean }> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const authUser = formatAuthUser(data.user);
        // If session was immediately returned
        if (data.session) {
          setStoredLocalUser(authUser);
          return { user: authUser, error: null };
        } else {
          // Requires email confirmation
          return { user: authUser, error: null, requiresEmailConfirmation: true };
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      return { user: null, error: e.message || 'Registration failed' };
    }
  }

  // Local Offline Secure Fallback when Supabase URL is not configured yet
  const db = getLocalUsersDb();
  const normalizedEmail = email.toLowerCase().trim();
  if (db.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return { user: null, error: 'An account with this email already exists.' };
  }

  const hashedPassword = await hashPassword(password);
  const newUser = {
    id: `local-usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    name: fullName.trim() || 'Class 10 Student',
    passwordHash: hashedPassword,
    createdAt: new Date().toISOString(),
  };

  db.push(newUser);
  saveLocalUsersDb(db);

  const authUser: AuthUser = {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    createdAt: newUser.createdAt,
  };
  setStoredLocalUser(authUser);
  return { user: authUser, error: null };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: AuthUser | null; error: string | null }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Admin Master Credentials check
  if (normalizedEmail === 'ansh666960@gmail.com' && password === 'anshtrip_12') {
    const adminUser: AuthUser = {
      id: 'admin_ansh666960_private',
      email: 'ansh666960@gmail.com',
      name: 'Ansh Bhaiya (Admin)',
      createdAt: '2026-11-08T00:00:00.000Z',
      isAdmin: true,
    };
    setStoredLocalUser(adminUser);
    return { user: adminUser, error: null };
  }

  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const authUser = formatAuthUser(data.user);
        setStoredLocalUser(authUser);
        return { user: authUser, error: null };
      }
    } catch (err: unknown) {
      const e = err as Error;
      return { user: null, error: e.message || 'Login failed' };
    }
  }

  // Local Offline Secure Fallback
  const db = getLocalUsersDb();
  const existing = db.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!existing) {
    return { user: null, error: 'No account found with this email address.' };
  }

  const hashedPassword = await hashPassword(password);
  if (existing.passwordHash !== hashedPassword) {
    return { user: null, error: 'Incorrect password. Please try again.' };
  }

  const authUser: AuthUser = {
    id: existing.id,
    email: existing.email,
    name: existing.name,
    createdAt: existing.createdAt,
  };
  setStoredLocalUser(authUser);
  return { user: authUser, error: null };
}

export async function signOutUser(): Promise<{ error: string | null }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut error:', e);
    }
  }
  setStoredLocalUser(null);
  return { error: null };
}

export async function sendPasswordResetLink(email: string): Promise<{ success: boolean; error: string | null }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, error: null };
    } catch (err: unknown) {
      const e = err as Error;
      return { success: false, error: e.message };
    }
  }

  // Local Offline Simulation
  const db = getLocalUsersDb();
  const exists = db.some((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!exists) {
    return { success: false, error: 'No account registered with this email address.' };
  }
  return { success: true, error: null };
}

export async function changeUserPassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, error: null };
    } catch (err: unknown) {
      const e = err as Error;
      return { success: false, error: e.message };
    }
  }

  // Local update
  const current = getStoredLocalUser();
  if (!current) return { success: false, error: 'No active session found.' };

  const db = getLocalUsersDb();
  const idx = db.findIndex((u) => u.id === current.id);
  if (idx !== -1) {
    db[idx].passwordHash = await hashPassword(newPassword);
    saveLocalUsersDb(db);
    return { success: true, error: null };
  }

  return { success: false, error: 'User record not found.' };
}
