// /sandbox/board - any level on the real renderer with real input, plus the solver's view of it.
//   ?level=street-004   ?code=G1N...   ?anim=0 (snap, for deterministic screenshots)   ?auto=1 (play the solution)
import { Stage } from '../render/stage.js';
import { BoardView } from '../render/board.js';
import { Input } from '../game/input.js';
import { Session } from '../game/session.js';
import { Audio } from '../audio/audio.js';
import { STORY, getLevel, themeFor } from '../game/content.js';
import { solveLevel } from '../../solver/solver.js';
import { puzzleForCode } from '../../solver/presets.js';
import { encodeGenerated } from '../../shared/challenge.js';
import { decodeActions } from '../../shared/moves.js';
import { hashState } from '../../shared/hash.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
let animations = params.get('anim') !== '0';

const audio = new Audio();
const stage = new Stage($('stage'), { theme: themeFor(null), preserveDrawingBuffer: true });
const view = new BoardView(stage, { animations, onFx: (ev, at) => fx(ev, at) });
let session = null;
let level = null;
let report = null;
let solutionStep = 0;
let autoTimer = null;

function fx(ev, at) {
  audio.onEvent(ev, at ? at.x / stage.size.w : 0.5);
  if (ev.type === 'level_complete' || ev.type === 'level_failed') status();
}

new Input(stage.canvas, () => session, view, {
  enabled: () => session?.status === 'playing',
  onGesture: () => audio.unlock(),
  onSelect: () => audio.onEvent({ type: 'select' }),
  onInvalid: (g, o) => !o?.quiet && audio.onEvent({ type: 'invalid' }),
  onMove: (move, { dropped }) => doMove(move, dropped),
});

function doMove(move, dropped = false) {
  const r = session.apply(move);
  if (!r.ok) return false;
  view.play(r.state, r.events, { dropped });
  status();
  return true;
}

function load(lvl) {
  level = lvl;
  session = new Session(level);
  view.setState(session.state);
  solutionStep = 0;
  report = solveLevel(level, { useLevelMoves: true, maxStates: 150_000 });
  const d = report.difficulty;
  $('stats').textContent = report.solvable
    ? `min ${report.minMoves} / budget ${level.moves}  stored min ${level.solver?.minMoves ?? '-'}\nstates ${report.visitedStates}  branching ${report.branchingFactor}\ndead ends ${report.deadEnds} (${Math.round(report.deadEndRatio * 100)}%)  forced ${report.forcedMoves}\noptimal lines ${report.optimalSolutions}\ndifficulty ${d?.score} ${d?.rating}\n${report.solutionString}`
    : `UNSOLVABLE (${report.visitedStates} states)`;
  status();
}

function status() {
  const s = session.state;
  $('status').textContent = `${level.id}  moves left ${s.movesLeft}  combo x${s.combo}  ${s.status}  ${hashState(s)}`;
}

// level list
for (const id of STORY) $('level').add(new Option(id, id));
$('level').onchange = () => load(getLevel($('level').value));
$('restart').onclick = () => load(level);
$('undo').onclick = () => {
  if (!session.undo()) return;
  view.setState(session.state);
  solutionStep = Math.max(0, solutionStep - 1);
  status();
};
$('step').onclick = () => {
  if (!report?.solvable) return;
  if (solutionStep === 0 && session.actions.length) load(level);
  const moves = decodeActions(report.solutionString);
  if (solutionStep < moves.length && doMove(moves[solutionStep])) solutionStep++;
};
$('auto').onclick = () => {
  clearInterval(autoTimer);
  load(level);
  autoTimer = setInterval(() => {
    const moves = decodeActions(report.solutionString);
    if (solutionStep >= moves.length) return clearInterval(autoTimer);
    doMove(moves[solutionStep++]);
  }, 750);
};
$('anim').onclick = () => {
  animations = !animations;
  view.animations = animations;
  $('anim').textContent = animations ? 'anim on' : 'anim off';
};
$('anim').textContent = animations ? 'anim on' : 'anim off';
$('gen').onclick = () => {
  const code = encodeGenerated($('band').value, Math.floor(Math.random() * 32 ** 5));
  const p = puzzleForCode(code);
  if (p) load(p.level);
};
$('title').onclick = () => $('panel').classList.toggle('min');

const code = params.get('code');
const start = code ? puzzleForCode(code)?.level : getLevel(params.get('level') ?? STORY[0]);
$('level').value = start?.id ?? STORY[0];
load(start ?? getLevel(STORY[0]));
if (stage.size.w < 500) $('panel').classList.add('min');
if (params.get('auto') === '1') $('auto').onclick();

window.addEventListener('resize', () => {
  stage.resize();
  view.relayout();
});
stage.start((dt) => view.update(dt));
// test hooks (e2e): the authoritative state and a way to drive moves
window.__board = { get state() { return session.state; }, view, stage, doMove, load };
window.__sandboxReady = true;
