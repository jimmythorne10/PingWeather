// User feedback — "What matters most to you?"
//
// Rows land in public.feedback (migration 00022). Users can insert their own
// rows and nothing else; the operator reads them from the Supabase dashboard.
// Rows cascade-delete with the profile, which the privacy policy promises.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';
import { useAuthStore } from '../stores/authStore';
import type { SubscriptionTier } from '../types';

export const FEEDBACK_PRIORITIES = [
  { id: 'more_alert_types', label: 'More kinds of alerts' },
  { id: 'more_locations', label: 'More locations or rules' },
  { id: 'forecast_accuracy', label: 'More accurate forecasts' },
  { id: 'faster_alerts', label: 'Faster or more frequent checks' },
  { id: 'radar_maps', label: 'Better radar and maps' },
  { id: 'look_and_feel', label: 'How the app looks' },
  { id: 'price', label: 'Lower price' },
] as const;

export type FeedbackPriorityId = (typeof FEEDBACK_PRIORITIES)[number]['id'];

// Mirrored by a CHECK constraint in the migration.
export const FEEDBACK_MESSAGE_MAX = 2000;

export interface FeedbackInput {
  priorities: string[];
  message: string;
  contactOk: boolean;
}

export interface FeedbackContext {
  userId: string;
  appVersion: string;
  platform: string;
  tier: SubscriptionTier;
}

export interface FeedbackRow {
  user_id: string;
  priorities: FeedbackPriorityId[];
  message: string | null;
  contact_ok: boolean;
  app_version: string;
  platform: string;
  subscription_tier: SubscriptionTier;
}

const PRIORITY_IDS = new Set<string>(FEEDBACK_PRIORITIES.map((p) => p.id));

export function buildFeedbackRow(
  input: FeedbackInput,
  ctx: FeedbackContext
): { ok: true; row: FeedbackRow } | { ok: false; error: string } {
  const priorities = [...new Set(input.priorities)];
  if (priorities.some((p) => !PRIORITY_IDS.has(p))) {
    return { ok: false, error: 'Unknown option selected.' };
  }
  const message = input.message.trim();
  if (message.length > FEEDBACK_MESSAGE_MAX) {
    return { ok: false, error: `Please keep it under ${FEEDBACK_MESSAGE_MAX} characters.` };
  }
  if (priorities.length === 0 && message.length === 0) {
    return { ok: false, error: 'Pick at least one option or write a note.' };
  }
  return {
    ok: true,
    row: {
      user_id: ctx.userId,
      priorities: priorities as FeedbackPriorityId[],
      message: message.length > 0 ? message : null,
      contact_ok: input.contactOk,
      app_version: ctx.appVersion,
      platform: ctx.platform,
      subscription_tier: ctx.tier,
    },
  };
}

export async function submitFeedback(input: FeedbackInput): Promise<boolean> {
  const { user, profile } = useAuthStore.getState();
  if (!user) return false;

  const built = buildFeedbackRow(input, {
    userId: user.id,
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
    platform: Platform.OS,
    tier: profile?.subscription_tier ?? 'free',
  });
  if (!built.ok) return false;

  try {
    const { error } = await supabase.from('feedback').insert(built.row);
    if (error) {
      console.error('[feedback] insert failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[feedback] insert threw:', err);
    return false;
  }
}
