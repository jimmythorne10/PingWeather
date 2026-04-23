export interface DigestProfile {
  digest_enabled: boolean;
  digest_frequency: 'daily' | 'weekly';
  digest_hour: number;
  digest_day_of_week: number; // 1=Mon, 7=Sun (ISO weekday)
  digest_last_sent_at: string | null;
}

const MIN_RESEND_HOURS = 23;

export function shouldSendDigest(
  profile: DigestProfile,
  locationTimezone: string,
  nowUtc: Date
): boolean {
  if (!profile.digest_enabled) return false;
  if (!locationTimezone) return false;

  let localHour: number;
  let localIsoWeekday: number;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: locationTimezone,
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(nowUtc);
    const hourPart = parts.find((p) => p.type === 'hour');
    const weekdayPart = parts.find((p) => p.type === 'weekday');
    if (!hourPart || !weekdayPart) return false;

    localHour = parseInt(hourPart.value, 10);
    // Map abbreviated weekday to ISO weekday (1=Mon...7=Sun)
    const weekdayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };
    localIsoWeekday = weekdayMap[weekdayPart.value] ?? -1;
  } catch {
    return false;
  }

  if (localHour !== profile.digest_hour) return false;

  if (profile.digest_frequency === 'weekly' && localIsoWeekday !== profile.digest_day_of_week) {
    return false;
  }

  if (profile.digest_last_sent_at) {
    const lastSent = new Date(profile.digest_last_sent_at);
    const hoursSinceLastSent = (nowUtc.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSent < MIN_RESEND_HOURS) return false;
  }

  return true;
}
