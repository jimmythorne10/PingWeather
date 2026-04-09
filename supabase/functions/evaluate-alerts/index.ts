// ────────────────────────────────────────────────────────────
// evaluate-alerts Edge Function
//
// Core alert engine. Called by poll-weather after fetching forecast data.
// Evaluates all active alert rules for a given location against forecast data.
// Returns which rules triggered and the human-readable summary.
//
// This is the core IP of WeatherWatch.
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

interface AlertCondition {
  metric: string;
  operator: string;
  value: number;
  unit?: string;
}

interface AlertRule {
  id: string;
  user_id: string;
  location_id: string;
  name: string;
  conditions: AlertCondition[];
  logical_operator: "AND" | "OR";
  lookahead_hours: number;
  polling_interval_hours: number;
  cooldown_hours: number;
  is_active: boolean;
  last_triggered_at: string | null;
  max_notifications: number; // 0 = unlimited
  notifications_sent_count: number;
}

interface HourlyForecast {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  precipitation_probability: number[];
  wind_speed_10m: number[];
  apparent_temperature: number[];
  uv_index: number[];
}

interface DailyForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  uv_index_max: number[];
}

interface ForecastData {
  hourly: HourlyForecast;
  daily: DailyForecast;
}

// ── Metric extractors ──────────────────────────────────────
// Each metric extractor returns all relevant values from the forecast
// within the rule's lookahead window.

function getMetricValues(
  metric: string,
  forecast: ForecastData,
  lookaheadHours: number
): number[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);

  switch (metric) {
    case "temperature_high": {
      return forecast.daily.temperature_2m_max.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= now && date <= cutoff;
      });
    }
    case "temperature_low": {
      return forecast.daily.temperature_2m_min.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= now && date <= cutoff;
      });
    }
    case "temperature_current": {
      return forecast.hourly.temperature_2m.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }
    case "precipitation_probability": {
      // Use hourly for short windows, daily max for longer
      if (lookaheadHours <= 24) {
        return forecast.hourly.precipitation_probability.filter((_, i) => {
          const time = new Date(forecast.hourly.time[i]);
          return time >= now && time <= cutoff;
        });
      }
      return forecast.daily.precipitation_probability_max.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= now && date <= cutoff;
      });
    }
    case "wind_speed": {
      if (lookaheadHours <= 24) {
        return forecast.hourly.wind_speed_10m.filter((_, i) => {
          const time = new Date(forecast.hourly.time[i]);
          return time >= now && time <= cutoff;
        });
      }
      return forecast.daily.wind_speed_10m_max.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= now && date <= cutoff;
      });
    }
    case "humidity": {
      return forecast.hourly.relative_humidity_2m.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }
    case "feels_like": {
      return forecast.hourly.apparent_temperature.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }
    case "uv_index": {
      return forecast.daily.uv_index_max.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= now && date <= cutoff;
      });
    }
    default:
      return [];
  }
}

// ── Comparison ─────────────────────────────────────────────

function compare(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt":  return actual > threshold;
    case "gte": return actual >= threshold;
    case "lt":  return actual < threshold;
    case "lte": return actual <= threshold;
    case "eq":  return actual === threshold;
    default:    return false;
  }
}

// ── Condition evaluation ───────────────────────────────────
// A condition is met if ANY value within the lookahead window matches.

function evaluateCondition(
  condition: AlertCondition,
  forecast: ForecastData,
  lookaheadHours: number
): { met: boolean; matchedValue: number | null; matchedTime: string | null } {
  const values = getMetricValues(condition.metric, forecast, lookaheadHours);

  for (let i = 0; i < values.length; i++) {
    if (compare(values[i], condition.operator, condition.value)) {
      return { met: true, matchedValue: values[i], matchedTime: null };
    }
  }

  return { met: false, matchedValue: null, matchedTime: null };
}

// ── Rule evaluation ────────────────────────────────────────

interface EvaluationResult {
  rule: AlertRule;
  triggered: boolean;
  summary: string;
  matchDetails: Array<{
    metric: string;
    operator: string;
    threshold: number;
    matchedValue: number | null;
    met: boolean;
  }>;
}

function evaluateRule(rule: AlertRule, forecast: ForecastData): EvaluationResult {
  const details = rule.conditions.map((condition) => {
    const result = evaluateCondition(condition, forecast, rule.lookahead_hours);
    return {
      metric: condition.metric,
      operator: condition.operator,
      threshold: condition.value,
      matchedValue: result.matchedValue,
      met: result.met,
    };
  });

  const triggered =
    rule.logical_operator === "AND"
      ? details.every((d) => d.met)
      : details.some((d) => d.met);

  // Build human-readable summary
  const metConditions = details.filter((d) => d.met);
  const summary = triggered
    ? metConditions
        .map((d) => formatConditionSummary(d.metric, d.operator, d.threshold, d.matchedValue))
        .join(rule.logical_operator === "AND" ? " and " : " or ")
    : "No conditions met";

  return { rule, triggered, summary, matchDetails: details };
}

function formatConditionSummary(
  metric: string,
  operator: string,
  threshold: number,
  matchedValue: number | null
): string {
  const metricLabels: Record<string, string> = {
    temperature_high: "High temp",
    temperature_low: "Low temp",
    temperature_current: "Temperature",
    precipitation_probability: "Rain chance",
    wind_speed: "Wind speed",
    humidity: "Humidity",
    feels_like: "Feels like",
    uv_index: "UV index",
  };

  const operatorLabels: Record<string, string> = {
    gt: "above",
    gte: "at or above",
    lt: "below",
    lte: "at or below",
    eq: "exactly",
  };

  const label = metricLabels[metric] || metric;
  const op = operatorLabels[operator] || operator;
  const actual = matchedValue !== null ? ` (forecast: ${matchedValue})` : "";

  return `${label} ${op} ${threshold}${actual}`;
}

// ── Notification cycle decision ────────────────────────────
// MIRROR of `src/engine/notificationCycle.ts`. Must stay in lockstep —
// unit tests for the TS side live in __tests__/engine/notificationCycle.test.ts.
// See that file's docstring for the semantic.

interface CycleDecision {
  fire: boolean;
  next: {
    notifications_sent_count: number;
    last_triggered_at: string | null;
  };
}

function isCycleElapsed(
  now: Date,
  lastTriggeredAt: string | null,
  cooldownHours: number
): boolean {
  if (!lastTriggeredAt) return true;
  const anchor = new Date(lastTriggeredAt).getTime();
  const windowMs = cooldownHours * 60 * 60 * 1000;
  return now.getTime() - anchor >= windowMs;
}

function decideNotificationCycle(rule: AlertRule, now: Date): CycleDecision {
  const unchanged: CycleDecision = {
    fire: false,
    next: {
      notifications_sent_count: rule.notifications_sent_count,
      last_triggered_at: rule.last_triggered_at,
    },
  };

  const isUnlimited = !rule.max_notifications || rule.max_notifications <= 0;

  if (isUnlimited) {
    if (isCycleElapsed(now, rule.last_triggered_at, rule.cooldown_hours)) {
      return {
        fire: true,
        next: {
          notifications_sent_count: 0,
          last_triggered_at: now.toISOString(),
        },
      };
    }
    return unchanged;
  }

  if (isCycleElapsed(now, rule.last_triggered_at, rule.cooldown_hours)) {
    return {
      fire: true,
      next: {
        notifications_sent_count: 1,
        last_triggered_at: now.toISOString(),
      },
    };
  }

  if (rule.notifications_sent_count < rule.max_notifications) {
    return {
      fire: true,
      next: {
        notifications_sent_count: rule.notifications_sent_count + 1,
        last_triggered_at: rule.last_triggered_at,
      },
    };
  }

  return unchanged;
}

// ── Main handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const { rules, forecast, location_name } = await req.json() as {
      rules: AlertRule[];
      forecast: ForecastData;
      location_name: string;
    };

    // Track alert_history row id per triggered rule so poll-weather can
    // update the exact row after sending the push (the old code used a
    // broken .update().eq().order().limit() chain — .order/.limit are
    // silently ignored on UPDATE in supabase-js).
    const historyIdByRule = new Map<string, string>();
    const results: EvaluationResult[] = [];

    // Evaluate the rule's conditions FIRST, then apply the notification
    // cycle decision. This keeps "did the condition match" separate from
    // "should we notify about it right now" — the first is about weather,
    // the second is about user rate-limit preferences.
    const evalNow = new Date();
    for (const rule of rules) {
      if (!rule.is_active) continue;

      const result = evaluateRule(rule, forecast);
      results.push(result);

      if (!result.triggered) continue;

      const decision = decideNotificationCycle(rule, evalNow);
      if (!decision.fire) {
        // Condition matched but we're rate-limited (inside a capped cycle
        // at the cap, or inside a cooldown window with max_notifications=0).
        // Don't create a history row — this is the rate-limit path, not a
        // user-visible event.
        continue;
      }

      // Insert alert_history and capture the id for later UPDATE by PK.
      const { data: historyRow, error: historyErr } = await supabase
        .from("alert_history")
        .insert({
          user_id: rule.user_id,
          rule_id: rule.id,
          rule_name: rule.name,
          location_name,
          conditions_met: result.summary,
          forecast_data: {
            matchDetails: result.matchDetails,
            evaluatedAt: evalNow.toISOString(),
          },
          notification_sent: false, // poll-weather will flip after sending push
        })
        .select("id")
        .single();

      if (historyErr) {
        console.error("alert_history insert error:", historyErr);
      } else if (historyRow?.id) {
        historyIdByRule.set(rule.id, historyRow.id);
      }

      // Persist the cycle state: new count + new/unchanged anchor.
      await supabase
        .from("alert_rules")
        .update({
          notifications_sent_count: decision.next.notifications_sent_count,
          last_triggered_at: decision.next.last_triggered_at,
        })
        .eq("id", rule.id);
    }

    // Only rules that both (a) had their condition match AND (b) passed the
    // notification cycle gate are emitted as alerts — those are the ones we
    // actually want poll-weather to dispatch pushes for.
    const notified = results.filter(
      (r) => r.triggered && historyIdByRule.has(r.rule.id)
    );

    return new Response(
      JSON.stringify({
        evaluated: results.length,
        // "triggered" here retains its historical meaning: the number of
        // alerts we're actually pushing. Rate-limited matches are not
        // counted, which matches poll-weather's summary semantics.
        triggered: notified.length,
        alerts: notified.map((r) => ({
          rule_id: r.rule.id,
          rule_name: r.rule.name,
          user_id: r.rule.user_id,
          summary: r.summary,
          details: r.matchDetails,
          // Dedicated id so poll-weather can surgically UPDATE one row.
          alert_history_id: historyIdByRule.get(r.rule.id) ?? null,
        })),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("evaluate-alerts error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to evaluate alerts" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
