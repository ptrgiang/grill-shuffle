// Daily puzzle helpers for the client: the local streak, the "next daily" countdown, and picking the level the
// server pre-built (Cron) over generating it locally. Pure (no DOM, no storage): main.js wires them up.
import { dayNumber } from '../../shared/challenge.js';
import { PUZZLE_RULE_VERSION } from '../../shared/version.js';
import { validateLevel } from '../../shared/levels.js';
import { t } from '../i18n/index.js';

/**
 * Advance the local streak with a daily win on `date` (YYYY-MM-DD, UTC). Winning the same day again changes
 * nothing; the day after the last win extends the streak; any gap restarts it at 1.
 * streak = { last: date | null, count, best }
 */
export function advanceStreak(streak, date) {
  const s = { last: null, count: 0, best: 0, ...(streak ?? {}) };
  if (s.last === date) return s;
  const gap = s.last ? dayNumber(date) - dayNumber(s.last) : null;
  if (gap !== null && gap < 0) return s; // an older day (replayed link): leaves today's streak alone
  const count = gap === 1 ? s.count + 1 : 1;
  return { last: date, count, best: Math.max(s.best, count) };
}

/** The streak as it stands today: it is broken once a whole UTC day passed without a win. */
export function currentStreak(streak, today) {
  if (!streak?.last) return 0;
  const gap = dayNumber(today) - dayNumber(streak.last);
  return gap <= 1 ? streak.count : 0;
}

/** Milliseconds until the next daily puzzle (00:00 UTC). */
export function msUntilNextDaily(now) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

/** 5h 03m 09s -> "05:03:09". */
export function formatCountdown(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}

/** The pre-built level from `GET /api/daily`, when it is usable for `code`; otherwise null (generate locally). */
export function serverDailyLevel(info, code, date) {
  const level = info?.level;
  if (!level || info.code !== code || info.rulesVersion !== PUZZLE_RULE_VERSION || level.id !== `daily-${date}` || !level.solver?.minMoves) return null;
  try {
    return validateLevel(level).ok ? level : null;
  } catch {
    return null;
  }
}

/** One line for the result screen from the server's verified answer (`POST /api/daily/result`). */
export function rankLine({ players, percentile, bestMoves, moves }) {
  if (!players || players <= 1) return t('rank.first');
  const better = percentile > 0 ? t('rank.better', { percentile, players }) : null;
  if (moves <= bestMoves) return better ? t('rank.todaysBest', { better }) : t('rank.matched', { best: bestMoves, players });
  return t('rank.bestToday', { lead: better ?? t('rank.players', { players }), best: bestMoves });
}
