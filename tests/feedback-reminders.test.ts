import { describe, expect, it } from 'vitest';
import {
  formatLocalDateTimeInput,
  isFeedbackReminder,
  isFeedbackReminderDue,
  isFutureReminderDateTime,
  shouldNotifyFeedbackReminder,
  type FeedbackReminder
} from '@/lib/feedback-reminders';

const courseIds = ['cse201','cse305'];
const reminder: FeedbackReminder = {
  id: 'reminder-1',
  courseId: 'cse201',
  remindAt: '2026-11-27T03:30:00.000Z',
  createdAt: '2026-11-26T08:00:00.000Z',
  completedAt: null,
  notifiedAt: null
};

describe('personal feedback reminders', () => {
  it('accepts only valid reminders for known courses', () => {
    expect(isFeedbackReminder(reminder,courseIds)).toBe(true);
    expect(isFeedbackReminder({...reminder,courseId:'unknown'},courseIds)).toBe(false);
    expect(isFeedbackReminder({...reminder,remindAt:'not-a-date'},courseIds)).toBe(false);
  });

  it('requires a future date/time when creating a reminder', () => {
    const now = Date.parse('2026-11-26T08:00:00.000Z');
    expect(isFutureReminderDateTime('2026-11-27T08:00',now)).toBe(true);
    expect(isFutureReminderDateTime('2026-11-25T08:00',now)).toBe(false);
    expect(isFutureReminderDateTime('invalid',now)).toBe(false);
  });

  it('marks a reminder due when its time passes, unless completed', () => {
    const now = Date.parse('2026-11-27T04:00:00.000Z');
    expect(isFeedbackReminderDue(reminder,now)).toBe(true);
    expect(isFeedbackReminderDue({...reminder,completedAt:'2026-11-27T03:45:00.000Z'},now)).toBe(false);
  });

  it('requests each browser notification at most once', () => {
    const now = Date.parse('2026-11-27T04:00:00.000Z');
    expect(shouldNotifyFeedbackReminder(reminder,now)).toBe(true);
    expect(shouldNotifyFeedbackReminder({...reminder,notifiedAt:'2026-11-27T03:40:00.000Z'},now)).toBe(false);
  });

  it('formats a local datetime input without shifting the local timezone', () => {
    const value = new Date(2026,10,27,9,5,0);
    expect(formatLocalDateTimeInput(value)).toBe('2026-11-27T09:05');
  });
});
