export type FeedbackReminder = {
  id: string;
  courseId: string;
  remindAt: string;
  createdAt: string;
  completedAt: string | null;
  notifiedAt: string | null;
};

export function isFeedbackReminder(value: unknown, courseIds: readonly string[]): value is FeedbackReminder {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const validDate = (input: unknown) => typeof input === 'string' && Number.isFinite(Date.parse(input));
  return typeof item.id === 'string' && item.id.length > 0
    && typeof item.courseId === 'string' && courseIds.includes(item.courseId)
    && validDate(item.remindAt) && validDate(item.createdAt)
    && (item.completedAt === null || validDate(item.completedAt))
    && (item.notifiedAt === null || validDate(item.notifiedAt));
}

export function isFutureReminderDateTime(value: string, now = Date.now()): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now;
}

export function isFeedbackReminderDue(reminder: FeedbackReminder, now = Date.now()): boolean {
  const timestamp = Date.parse(reminder.remindAt);
  return reminder.completedAt === null && Number.isFinite(timestamp) && timestamp <= now;
}

export function shouldNotifyFeedbackReminder(reminder: FeedbackReminder, now = Date.now()): boolean {
  return isFeedbackReminderDue(reminder, now) && reminder.notifiedAt === null;
}

export function formatLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
    + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}
