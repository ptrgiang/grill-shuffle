import { playStory } from '../story/player.js';
import { STORY_FILES } from '../game/content.js';
import { setLang } from '../i18n/index.js';
import { Audio } from '../audio/audio.js';

// /sandbox/story?beat=street.fan&t=4     one still of a beat (npm run shot set, PR screenshots)
// /sandbox/story?beat=street.fan          the beat playing (loops after a tap)
// /sandbox/story?recap=1                  the memories page with every Saigon Alley beat
// &sound=1: with sound (tap once to start: browsers need a gesture)
// &style=past|present overrides the beat's style (past: Bà Năm's past, a Đông Hồ print); &lang=vi|en
const q = new URLSearchParams(location.search);
setLang(q.get('lang') ?? 'en');
const beats = STORY_FILES.flatMap((f) => f.beats ?? []);
const still = q.has('t') ? Number(q.get('t')) : null;
const pick = beats.find((b) => b.id === q.get('beat')) ?? beats[0];
const style = q.get('style') ?? pick.style ?? 'present'; // the beat's own style unless ?style= overrides it
const items = q.get('recap') === '1' ? [{ id: 'recap', recap: true, beats: beats.filter((b) => b.at.on !== 'firstLaunch' && b.id.startsWith('street.')) }] : [{ ...pick, style }];
const transitionFor = (b) => (b.id.startsWith('beach.') ? 'wave' : 'lights');
const audio = q.get('sound') === '1' ? new Audio() : null;
const sound = audio ? (name, o) => audio.story(name, o) : undefined;
const start = async () => {
  if (still != null || q.get('recap') === '1') return playStory(items, { still: still ?? 0, transitionFor });
  for (;;) await playStory(items, { transitionFor, sound });
};
document.fonts.ready.then(() => {
  window.__sandboxReady = true;
  if (!audio) return start();
  audio.attach();
  const go = () => (audio.unlock(), start());
  window.addEventListener('pointerdown', go, { once: true });
});
