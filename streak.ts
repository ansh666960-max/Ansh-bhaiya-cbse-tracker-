import { Profile } from '../types';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateToLocal(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculates current and longest streaks from an activity log dictionary
 */
export function calculateStreaks(activityLog: Record<string, number>): {
  currentStreak: number;
  longestStreak: number;
} {
  const activeDates = Object.keys(activityLog)
    .filter((dateStr) => (activityLog[dateStr] || 0) > 0)
    .sort();

  if (activeDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const activeSet = new Set(activeDates);
  const todayStr = getTodayDateString();

  // Helper to subtract days
  const subDays = (dateStr: string, days: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - days);
    const y2 = dt.getFullYear();
    const m2 = String(dt.getMonth() + 1).padStart(2, '0');
    const d2 = String(dt.getDate()).padStart(2, '0');
    return `${y2}-${m2}-${d2}`;
  };

  // Determine current streak
  let currentStreak = 0;
  let checkDate = todayStr;

  // If not active today, check if yesterday was active to keep streak alive
  if (!activeSet.has(todayStr)) {
    const yesterday = subDays(todayStr, 1);
    if (activeSet.has(yesterday)) {
      checkDate = yesterday;
    } else {
      checkDate = ''; // Streak broken
    }
  }

  if (checkDate) {
    while (activeSet.has(checkDate)) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    }
  }

  // Calculate longest streak across history
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of activeDates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const currentDate = new Date(y, m - 1, d);

    if (prevDate) {
      const diffTime = currentDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays === 0) {
        // Same day, do nothing
      } else {
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }

    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
    prevDate = currentDate;
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return { currentStreak, longestStreak };
}

/**
 * Record activity for today and update profile streak numbers
 */
export function recordStudyActivity(profile: Profile, count: number = 1): Profile {
  const todayStr = getTodayDateString();
  const updatedLog = { ...profile.activityLog };
  updatedLog[todayStr] = (updatedLog[todayStr] || 0) + count;

  const { currentStreak, longestStreak } = calculateStreaks(updatedLog);

  return {
    ...profile,
    activityLog: updatedLog,
    currentStreak,
    longestStreak: Math.max(longestStreak, profile.longestStreak),
    lastActiveDate: todayStr,
  };
}

export interface HeatmapDay {
  date: string;
  dayOfWeek: number; // 0 = Sun, 6 = Sat
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
}

export function generateHeatmapData(
  activityLog: Record<string, number>,
  weeksCount: number = 16
): { weeks: HeatmapDay[][]; totalActiveDays: number; totalActions: number } {
  const today = new Date();
  const todayStr = getTodayDateString();
  const totalDays = weeksCount * 7;
  
  // End on the Saturday of the current week (or today)
  const currentDayOfWeek = today.getDay();
  const daysUntilSaturday = 6 - currentDayOfWeek;
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + daysUntilSaturday);

  const days: HeatmapDay[] = [];
  let totalActiveDays = 0;
  let totalActions = 0;

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayNum}`;

    const count = activityLog[dateStr] || 0;
    if (count > 0) {
      totalActiveDays++;
      totalActions += count;
    }

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count >= 7) level = 4;
    else if (count >= 4) level = 3;
    else if (count >= 2) level = 2;
    else if (count >= 1) level = 1;

    days.push({
      date: dateStr,
      dayOfWeek: d.getDay(),
      count,
      level,
      isToday: dateStr === todayStr,
    });
  }

  // Group into weeks (arrays of 7 days: Sun - Sat)
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return { weeks, totalActiveDays, totalActions };
}
