/**
 * User feedback — "What matters most to you?"
 *
 * Written BEFORE src/services/feedback.ts exists. Covers:
 * 1. buildFeedbackRow: validation (empty, unknown priority, oversize) + shaping
 * 2. submitFeedback: inserts the right row into `feedback`, returns boolean
 * 3. The privacy policy discloses feedback and its deletion with the account
 * 4. The migration: cascade-delete with the profile, RLS on, users cannot read
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  FEEDBACK_PRIORITIES,
  FEEDBACK_MESSAGE_MAX,
  buildFeedbackRow,
  submitFeedback,
} from '../../src/services/feedback';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/utils/supabase';
import { PRIVACY_POLICY_CONTENT } from '../../src/data/legal-content';

const mockFrom = supabase.from as jest.Mock;

const CTX = { userId: 'user-123', appVersion: '1.0.0', platform: 'android', tier: 'free' } as const;
const firstPriority = () => FEEDBACK_PRIORITIES[0].id;

describe('buildFeedbackRow', () => {
  it('rejects a submission with no priorities and a blank message', () => {
    const r = buildFeedbackRow({ priorities: [], message: '   ', contactOk: false }, CTX);
    expect(r.ok).toBe(false);
  });

  it('accepts priorities alone', () => {
    const r = buildFeedbackRow({ priorities: [firstPriority()], message: '', contactOk: false }, CTX);
    expect(r.ok).toBe(true);
  });

  it('accepts a message alone, trimmed', () => {
    const r = buildFeedbackRow({ priorities: [], message: '  more wind alerts  ', contactOk: false }, CTX);
    expect(r.ok && r.row.message).toBe('more wind alerts');
  });

  it('rejects an unknown priority id', () => {
    const r = buildFeedbackRow({ priorities: ['not-a-real-priority'], message: '', contactOk: false }, CTX);
    expect(r.ok).toBe(false);
  });

  it('rejects a message over the length cap instead of silently truncating it', () => {
    const r = buildFeedbackRow(
      { priorities: [], message: 'x'.repeat(FEEDBACK_MESSAGE_MAX + 1), contactOk: false },
      CTX
    );
    expect(r.ok).toBe(false);
  });

  it('de-duplicates priorities and stamps context', () => {
    const p = firstPriority();
    const r = buildFeedbackRow({ priorities: [p, p], message: '', contactOk: true }, CTX);
    if (!r.ok) throw new Error(r.error);
    expect(r.row).toEqual({
      user_id: 'user-123',
      priorities: [p],
      message: null,
      contact_ok: true,
      app_version: '1.0.0',
      platform: 'android',
      subscription_tier: 'free',
    });
  });
});

describe('submitFeedback', () => {
  let insert: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert });
    useAuthStore.setState({
      user: { id: 'user-123', email: 't@example.com' } as any,
      profile: { id: 'user-123', subscription_tier: 'pro' } as any,
    });
  });

  it('inserts one row into the feedback table and returns true', async () => {
    const ok = await submitFeedback({ priorities: [firstPriority()], message: 'hi', contactOk: false });
    expect(ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('feedback');
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    expect(row.user_id).toBe('user-123');
    expect(row.subscription_tier).toBe('pro');
    expect(row.message).toBe('hi');
  });

  it('returns false when the insert errors', async () => {
    insert.mockResolvedValue({ error: { message: 'boom' } });
    const ok = await submitFeedback({ priorities: [firstPriority()], message: '', contactOk: false });
    expect(ok).toBe(false);
  });

  it('returns false and never inserts when signed out', async () => {
    useAuthStore.setState({ user: null, profile: null });
    const ok = await submitFeedback({ priorities: [firstPriority()], message: '', contactOk: false });
    expect(ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns false and never inserts when validation fails', async () => {
    const ok = await submitFeedback({ priorities: [], message: '', contactOk: false });
    expect(ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('privacy policy discloses feedback', () => {
  const text = PRIVACY_POLICY_CONTENT.sections.map((s) => s.body).join('\n');

  it('lists feedback under information collected', () => {
    expect(text).toMatch(/Feedback:/);
  });

  const section = (title: string) =>
    PRIVACY_POLICY_CONTENT.sections.find((s) => s.title === title)?.body ?? '';

  it('lists feedback among the data removed on account deletion', () => {
    expect(section('Data Deletion Requests')).toMatch(/alert history, feedback, and device tokens/);
  });

  it('states how long feedback is retained', () => {
    expect(section('Data Retention')).toMatch(/- Feedback: Retained until you delete your account\./);
  });

  it('bumps the policy version past 1.1.0', () => {
    expect(PRIVACY_POLICY_CONTENT.version).not.toBe('1.1.0');
  });
});

describe('feedback migration', () => {
  const dir = path.join(__dirname, '../../supabase/migrations');
  const file = fs.readdirSync(dir).find((f) => /_user_feedback\.sql$/.test(f));
  const sql = file ? fs.readFileSync(path.join(dir, file), 'utf8').toLowerCase() : '';

  it('exists', () => {
    expect(file).toBeDefined();
  });

  it('deletes feedback with the profile (privacy policy promise)', () => {
    expect(sql).toMatch(/user_id uuid not null references public\.profiles\(id\) on delete cascade/);
  });

  it('enables RLS and allows users to insert only their own rows', () => {
    expect(sql).toMatch(/alter table public\.feedback enable row level security/);
    expect(sql).toMatch(/for insert[\s\S]*with check \(auth\.uid\(\) = user_id\)/);
  });

  it('grants users no read, update or delete', () => {
    expect(sql).not.toMatch(/for (select|update|delete|all)/);
  });

  it('caps the message length in the database too', () => {
    expect(sql).toMatch(/char_length\(message\) <= 2000/);
  });
});
