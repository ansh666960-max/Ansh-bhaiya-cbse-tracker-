import { Chapter, Subject, TaskState } from '../types';

export interface ChapterProgressInfo {
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  percentage: number;
  status: 'completed' | 'in_progress' | 'not_started';
}

export function getChapterProgress(chapter: Chapter): ChapterProgressInfo {
  const tasks = Object.values(chapter.tasks);
  const totalTasks = 7;
  let completedCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;

  tasks.forEach((state: TaskState) => {
    if (state === 'completed') completedCount++;
    else if (state === 'in_progress') inProgressCount++;
    else notStartedCount++;
  });

  const rawScore = completedCount * 1.0 + inProgressCount * 0.5;
  const percentage = Math.min(100, Math.round((rawScore / totalTasks) * 100));

  let status: 'completed' | 'in_progress' | 'not_started' = 'not_started';
  if (completedCount === totalTasks) {
    status = 'completed';
  } else if (completedCount > 0 || inProgressCount > 0) {
    status = 'in_progress';
  }

  return {
    completedCount,
    inProgressCount,
    notStartedCount,
    percentage,
    status,
  };
}

export interface SubjectProgressInfo {
  totalChapters: number;
  completedChapters: number;
  inProgressChapters: number;
  pendingChapters: number;
  percentage: number;
}

export function getSubjectProgress(subject: Subject): SubjectProgressInfo {
  const totalChapters = subject.chapters.length;
  if (totalChapters === 0) {
    return {
      totalChapters: 0,
      completedChapters: 0,
      inProgressChapters: 0,
      pendingChapters: 0,
      percentage: 0,
    };
  }

  let completedChapters = 0;
  let inProgressChapters = 0;
  let pendingChapters = 0;
  let totalScore = 0;

  subject.chapters.forEach((ch) => {
    const prog = getChapterProgress(ch);
    if (prog.status === 'completed') completedChapters++;
    else if (prog.status === 'in_progress') inProgressChapters++;
    else pendingChapters++;

    totalScore += prog.completedCount * 1.0 + prog.inProgressCount * 0.5;
  });

  const maxScore = totalChapters * 7;
  const percentage = maxScore > 0 ? Math.min(100, Math.round((totalScore / maxScore) * 100)) : 0;

  return {
    totalChapters,
    completedChapters,
    inProgressChapters,
    pendingChapters,
    percentage,
  };
}

export interface OverallProgressInfo {
  totalChapters: number;
  completedChapters: number;
  inProgressChapters: number;
  pendingChapters: number;
  totalTasksCompleted: number;
  totalTasksCount: number;
  overallPercentage: number;
}

export function getOverallProgress(subjects: Subject[]): OverallProgressInfo {
  let totalChapters = 0;
  let completedChapters = 0;
  let inProgressChapters = 0;
  let pendingChapters = 0;
  let totalTasksCompleted = 0;
  let totalScore = 0;

  subjects.forEach((sub) => {
    totalChapters += sub.chapters.length;
    sub.chapters.forEach((ch) => {
      const prog = getChapterProgress(ch);
      if (prog.status === 'completed') completedChapters++;
      else if (prog.status === 'in_progress') inProgressChapters++;
      else pendingChapters++;

      totalTasksCompleted += prog.completedCount;
      totalScore += prog.completedCount * 1.0 + prog.inProgressCount * 0.5;
    });
  });

  const totalTasksCount = totalChapters * 7;
  const overallPercentage = totalTasksCount > 0 ? Math.min(100, Math.round((totalScore / totalTasksCount) * 100)) : 0;

  return {
    totalChapters,
    completedChapters,
    inProgressChapters,
    pendingChapters,
    totalTasksCompleted,
    totalTasksCount,
    overallPercentage,
  };
}
