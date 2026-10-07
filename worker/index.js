// Grill Shuffle Worker: the JSON API under /api/*. Everything else is Workers Static Assets (the Vite build), with
// SPA fallback for /play, /p/<code>, /daily ... (wrangler.jsonc: not_found_handling = single-page-application).
//
// The game never needs this to play: it runs locally and syncs here asynchronously. Results are stored as move
// lists and re-played on the server with the same shared simulation before they count (`verified`).
import { STORY, SHARE, LEVELS } from './content.gen.js';
import { replay } from '../shared/replay.js';
import { mergeProgressRecords } from './progress.js';
import { decodeCode, encodeDaily, encodeGenerated, dailySeed, dailyBand, todayUTC, BANDS } from '../shared/challenge.js';
import { createState } from '../shared/state.js';
import { hashBoard } from '../shared/hash.js';
import { starsFor } from '../shared/progression.js';
import { VERSIONS, PUZZLE_RULE_VERSION } from '../shared/version.js';

const MAX_BODY = 64 * 1024;
const ACTIONS_RE = /^(?:[a-z0-9.:_-]{2,40})(?: [a-z0-9.:_-]{2,40}){0,299}$/;
const PLAYER_RE = /^[A-Za-z0-9-]{8,64}$/;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fail = (status, error) => json({ error }, status);

class HttpError extends Error {
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
}

async function body(request) {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) throw new HttpError(413, 'body too large');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'body too large');
  try {
    const v = JSON.parse(text || '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
}

async function player(request, env) {
  const id = request.headers.get('x-player-id');
  if (!id || !PLAYER_RE.test(id)) throw new HttpError(401, 'missing or malformed x-player-id');
  const now = Date.now();
  await env.DB.prepare('INSERT INTO users (id, created_at, last_seen) VALUES (?1, ?2, ?2) ON CONFLICT(id) DO UPDATE SET last_seen = ?2').bind(id, now).run();
  return id;
}

/**
 * The level behind a code, or null. Story codes are bundled; generated / daily puzzles are built once with the
 * shared generator (solver CPU) and cached in D1. `allowBuild: false` only reads the cache.
 */
export async function levelForCode(env, code, { allowBuild = true } = {}) {
  const d = decodeCode(code);
  if (!d) return null;
  if (d.kind === 'story') {
    const id = SHARE[d.index];
    return id && LEVELS[id] ? { decoded: d, level: LEVELS[id] } : null;
  }
  const cached = await env.DB.prepare('SELECT level_json FROM challenge_links WHERE code = ?1').bind(d.code).first();
  if (cached) return { decoded: d, level: JSON.parse(cached.level_json) };
  if (!allowBuild) return { decoded: d, level: null };
  const { puzzleForCode } = await import('../solver/presets.js'); // only loaded when a puzzle must be built
  const p = puzzleForCode(d.code);
  if (!p) return null;
  await env.DB.prepare('INSERT OR IGNORE INTO challenge_links (code, kind, level_json, board_hash, min_moves, rules_version, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(d.code, d.kind, JSON.stringify(p.level), hashBoard(createState(p.level)), p.level.solver?.minMoves ?? null, PUZZLE_RULE_VERSION, Date.now())
    .run();
  return { decoded: d, level: p.level };
}

/** Replay a submitted result. Returns { moves, score, hash, won } or throws 422. */
function verify(level, actions, claimedHash) {
  if (typeof actions !== 'string' || !ACTIONS_RE.test(actions)) throw new HttpError(400, 'malformed moves');
  let r;
  try {
    r = replay(level, actions);
  } catch {
    throw new HttpError(400, 'malformed moves');
  }
  if (!r.ok) throw new HttpError(422, `illegal move: ${r.error}`);
  if (r.state.status !== 'won') throw new HttpError(422, 'the moves do not win the level');
  if (claimedHash && claimedHash !== r.hash) throw new HttpError(422, 'final state hash mismatch');
  return { moves: r.state.movesUsed, score: r.state.score, hash: r.hash };
}

async function stats(env, table, keyCol, key) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS players, MIN(moves) AS best, AVG(moves) AS avg FROM ${table} WHERE ${keyCol} = ?1 AND verified = 1`).bind(key).first();
  return { players: row?.players ?? 0, bestMoves: row?.best ?? null, avgMoves: row?.avg ? Math.round(row.avg * 10) / 10 : null };
}

async function percentile(env, table, keyCol, key, moves) {
  const row = await env.DB.prepare(`SELECT SUM(CASE WHEN moves > ?2 THEN 1 ELSE 0 END) AS worse, COUNT(*) AS n FROM ${table} WHERE ${keyCol} = ?1 AND verified = 1`).bind(key, moves).first();
  return row?.n ? Math.round(((row.worse ?? 0) / row.n) * 100) : null;
}

const routes = [
  ['GET', /^\/api\/version$/, async () => json({ ...VERSIONS, levels: STORY.length })],

  ['GET', /^\/api\/me$/, async (req, env) => {
    const id = await player(req, env);
    const u = await env.DB.prepare('SELECT id, created_at FROM users WHERE id = ?1').bind(id).first();
    return json({ playerId: u.id, createdAt: u.created_at });
  }],

  ['GET', /^\/api\/progress$/, async (req, env) => {
    const id = await player(req, env);
    const { results } = await env.DB.prepare('SELECT level_id, stars, best_moves, best_score, updated_at FROM level_progress WHERE user_id = ?1').bind(id).all();
    const progress = {};
    for (const r of results) progress[r.level_id] = { stars: r.stars, bestMoves: r.best_moves, bestScore: r.best_score, at: r.updated_at };
    return json({ progress });
  }],

  ['POST', /^\/api\/progress$/, async (req, env) => {
    const id = await player(req, env);
    const { progress } = await body(req);
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) throw new HttpError(400, 'progress must be an object');
    const entries = Object.entries(progress);
    if (entries.length > 500) throw new HttpError(400, 'too many levels');
    // only story levels; stars are capped by what the move count can earn against the solver minimum
    const clean = mergeProgressRecords(entries, LEVELS, starsFor);
    const now = Date.now();
    const stmts = clean.map(([levelId, r]) =>
      env.DB.prepare(
        `INSERT INTO level_progress (user_id, level_id, stars, best_moves, best_score, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(user_id, level_id) DO UPDATE SET stars = MAX(stars, ?3), best_moves = MIN(COALESCE(best_moves, ?4), ?4), best_score = MAX(best_score, ?5), updated_at = ?6`,
      ).bind(id, levelId, r.stars, r.bestMoves, r.bestScore, now),
    );
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, stored: stmts.length });
  }],

  ['GET', /^\/api\/daily$/, async (req, env) => {
    const url = new URL(req.url);
    const date = url.searchParams.get('date') ?? todayUTC();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'bad date');
    const code = encodeDaily(date);
    const link = await env.DB.prepare('SELECT board_hash, min_moves FROM challenge_links WHERE code = ?1').bind(code).first();
    return json({ date, code, seed: dailySeed(date), band: dailyBand(date), rulesVersion: PUZZLE_RULE_VERSION, challengeVersion: VERSIONS.challengeVersion, boardHash: link?.board_hash ?? null, minMoves: link?.min_moves ?? null, ...(await stats(env, 'daily_results', 'date', date)) });
  }],

  ['POST', /^\/api\/daily\/result$/, async (req, env) => {
    const id = await player(req, env);
    const b = await body(req);
    const date = b.date ?? todayUTC();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'bad date');
    const found = await levelForCode(env, encodeDaily(date));
    if (!found?.level) throw new HttpError(404, 'no puzzle for that date');
    const v = verify(found.level, b.moves, b.hash);
    await env.DB.prepare(
      `INSERT INTO daily_results (date, user_id, moves, score, actions, final_hash, verified, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)
       ON CONFLICT(date, user_id) DO UPDATE SET moves = ?3, score = ?4, actions = ?5, final_hash = ?6, verified = 1, created_at = ?7 WHERE ?3 < daily_results.moves`,
    ).bind(date, id, v.moves, v.score, b.moves, v.hash, Date.now()).run();
    return json({ ok: true, verified: true, moves: v.moves, percentile: await percentile(env, 'daily_results', 'date', date, v.moves), ...(await stats(env, 'daily_results', 'date', date)) });
  }],

  ['POST', /^\/api\/challenge$/, async (req) => {
    const b = await body(req);
    const band = b.band ?? 'N';
    if (!BANDS[band]) throw new HttpError(400, 'unknown band');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 32 ** 5;
    const code = encodeGenerated(band, seed);
    return json({ code, url: `/p/${code}` }, 201);
  }],

  ['GET', /^\/api\/challenge\/([A-Za-z0-9-]{4,16})$/, async (req, env, m) => {
    const d = decodeCode(m[1]);
    if (!d) throw new HttpError(404, 'unknown code');
    const link = await env.DB.prepare('SELECT board_hash, min_moves FROM challenge_links WHERE code = ?1').bind(d.code).first();
    return json({ code: d.code, kind: d.kind, version: d.version, band: d.band ?? null, boardHash: link?.board_hash ?? null, minMoves: link?.min_moves ?? null, ...(await stats(env, 'challenge_results', 'code', d.code)) });
  }],

  ['POST', /^\/api\/challenge\/([A-Za-z0-9-]{4,16})\/result$/, async (req, env, m) => {
    const id = await player(req, env);
    const b = await body(req);
    const found = await levelForCode(env, m[1]);
    if (!found?.level) throw new HttpError(404, 'unknown code');
    const code = found.decoded.code;
    const v = verify(found.level, b.moves, b.hash);
    await env.DB.prepare(
      `INSERT INTO challenge_results (code, user_id, moves, score, actions, final_hash, verified, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)
       ON CONFLICT(code, user_id) DO UPDATE SET moves = ?3, score = ?4, actions = ?5, final_hash = ?6, verified = 1, created_at = ?7 WHERE ?3 < challenge_results.moves`,
    ).bind(code, id, v.moves, v.score, b.moves, v.hash, Date.now()).run();
    return json({ ok: true, verified: true, moves: v.moves, percentile: await percentile(env, 'challenge_results', 'code', code, v.moves), ...(await stats(env, 'challenge_results', 'code', code)) });
  }],
];

export async function handleApi(request, env) {
  const url = new URL(request.url);
  for (const [method, re, fn] of routes) {
    const m = re.exec(url.pathname);
    if (!m) continue;
    if (request.method !== method) continue;
    try {
      return await fn(request, env, m);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error(e);
      return fail(500, 'internal error');
    }
  }
  return routes.some(([, re]) => re.test(url.pathname)) ? fail(405, 'method not allowed') : fail(404, 'not found');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
