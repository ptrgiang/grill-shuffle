// The ONLY way this repo starts a headless browser. Adapted from the safety rules of webdevcody/survive-the-night-fps
// (scripts/clip/lib.js), after an agent there locked a user out of Windows:
//
//   About 40 s after Chromium starts on a profile it has never seen, it asks Windows whether the user's password is
//   blank by signing in with an EMPTY password (CheckBlankPasswordWithPrefs). Every throwaway profile that lives that
//   long is one failed Windows sign-in; ten in ten minutes lock the account.
//
// So launchChrome:
//   - writes the answer into the new profile's "Local State" before Chrome starts, so that sign-in never happens;
//   - reads the account's failed sign-in counter before launching and after closing: refuses to launch at >= 3, and if
//     the counter rose while its browser was up, writes BLOCK_FILE (refusing every later launch until a person deletes
//     it) and throws;
//   - touches no credentials (fresh empty profile, password manager / sync / NTLM all off);
//   - is always headless, muted, software-rendered (SwiftShader), one browser per machine (lock file), killed by a
//     detached watchdog after `life` ms even if this script hangs, and its temporary profile is deleted;
//   - stubs pointer lock / fullscreen / keyboard lock / wake lock in every page;
//   - starts nothing when GS_NO_BROWSER=1.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

export const LOCK_FILE = join(tmpdir(), 'gs-chrome.lock');
export const BLOCK_FILE = join(tmpdir(), 'gs-chrome.blocked');
export const BAD_ATTEMPTS_MAX = 3;
const LOCAL_STATE_SEED = '{"password_manager":{"os_password_blank":false,"os_password_last_changed":"9000000000000000000"}}';
const SAFE_PREFS = { credentials_enable_service: false, profile: { password_manager_enabled: false }, password_manager: { biometric_authentication_filling: false } };
const ARGS = [
  '--headless=new', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--password-store=basic', '--use-mock-keychain', '--disable-sync', '--disable-background-networking', '--disable-component-update',
  '--no-service-autorun', '--auth-server-allowlist=', '--auth-negotiate-delegate-allowlist=',
  '--disable-features=PasswordManagerOnboarding,AutofillServerCommunication,BiometricAuthenticationForFilling,PasswordImport,WebAuthenticationUI',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-position=-32000,-32000',
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const c = process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
    : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const found = c.find((p) => existsSync(p));
  if (!found) throw new Error('no Chrome found: set CHROME to its path');
  return found;
}

/** Windows' failed sign-in counter for this account (null when unreadable / not Windows). */
export function badPasswordAttempts() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', "([ADSI]('WinNT://./' + $env:USERNAME + ',user')).BadPasswordAttempts.Value"], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    const n = parseInt(out.trim(), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function takeLock() {
  try {
    const fd = openSync(LOCK_FILE, 'wx');
    closeSync(fd);
    writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, t: Date.now() }));
    return;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  let held = null;
  try {
    held = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
  } catch {}
  let alive = false;
  try {
    process.kill(held?.pid, 0);
    alive = true;
  } catch (e) {
    alive = e.code === 'EPERM';
  }
  if (held && alive && Date.now() - held.t < 16 * 60_000) throw new Error(`another headless browser is running (process ${held.pid} holds ${LOCK_FILE})`);
  unlinkSync(LOCK_FILE);
  takeLock();
}
function dropLock() {
  try {
    const held = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    if (held.pid === process.pid) unlinkSync(LOCK_FILE);
  } catch {}
}

function startWatchdog(pid, profile, life) {
  const code = `
    const { execFileSync } = require('child_process'); const fs = require('fs');
    const [pid, life, profile, owner] = process.argv.slice(1);
    const gone = (p) => { try { process.kill(+p, 0); return false; } catch (e) { return e.code !== 'EPERM'; } };
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (Date.now() - t0 < +life && !gone(pid) && !gone(owner)) return;
      clearInterval(iv);
      if (!gone(pid)) { try { if (process.platform === 'win32') execFileSync('taskkill', ['/pid', pid, '/T', '/F'], { stdio: 'ignore' }); else process.kill(+pid, 'SIGKILL'); } catch {} }
      setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 1500);
    }, 500);`;
  const w = spawn(process.execPath, ['-e', code, String(pid), String(life), profile, String(process.pid)], { detached: true, stdio: 'ignore', windowsHide: true });
  w.unref();
}

function SAFE_STUBS() {
  const ok = () => Promise.resolve();
  const def = (o, n, f) => {
    try {
      Object.defineProperty(o, n, { value: f, writable: false, configurable: false });
    } catch {}
  };
  def(Element.prototype, 'requestPointerLock', ok);
  def(Element.prototype, 'requestFullscreen', ok);
  def(Document.prototype, 'exitFullscreen', ok);
  if (navigator.keyboard) def(navigator.keyboard, 'lock', ok);
  if (navigator.wakeLock) def(navigator.wakeLock, 'request', () => Promise.resolve({ release: ok, addEventListener() {} }));
}

/**
 * Launch the one headless Chrome. Returns { browser, page, close }. Always call close() in a finally.
 * opts: { width, height, life (ms, default 4 min, max 10), mobile (touch + DPR 3) }
 */
export async function launchChrome({ width = 900, height = 600, life = 4 * 60_000, mobile = false } = {}) {
  if (process.env.GS_NO_BROWSER === '1') throw new Error('GS_NO_BROWSER=1: no browser may be started now');
  if (existsSync(BLOCK_FILE)) throw new Error(`blocked by ${BLOCK_FILE}: the failed sign-in counter rose while a browser was up. Find out why, then delete it.`);
  const before = badPasswordAttempts();
  if (before !== null && before >= BAD_ATTEMPTS_MAX) throw new Error(`the Windows account has ${before} failed sign-ins: no launch at ${BAD_ATTEMPTS_MAX} or more (the counter clears ~10 minutes after the last failure)`);
  takeLock();
  const profile = mkdtempSync(join(tmpdir(), 'gs-chrome-'));
  writeFileSync(join(profile, 'Local State'), LOCAL_STATE_SEED);
  mkdirSync(join(profile, 'Default'), { recursive: true });
  writeFileSync(join(profile, 'Default', 'Preferences'), JSON.stringify(SAFE_PREFS));
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath(),
      headless: true,
      userDataDir: profile,
      args: [...ARGS, `--window-size=${width},${height}`],
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: null,
    });
  } catch (e) {
    rmSync(profile, { recursive: true, force: true });
    dropLock();
    throw e;
  }
  const pid = browser.process()?.pid;
  startWatchdog(pid, profile, Math.min(10 * 60_000, life));
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  await page.evaluateOnNewDocument(SAFE_STUBS);
  await page.setViewport({ width, height, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try {
      await browser.close();
    } catch {}
    try {
      if (pid) execFileSync(process.platform === 'win32' ? 'taskkill' : 'kill', process.platform === 'win32' ? ['/pid', String(pid), '/T', '/F'] : ['-9', String(pid)], { stdio: 'ignore' });
    } catch {}
    await sleep(300);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    dropLock();
    const after = badPasswordAttempts();
    if (before !== null && after !== null && after > before) {
      const msg = `failed sign-in counter rose from ${before} to ${after} while a headless browser was up (${new Date().toISOString()})`;
      writeFileSync(BLOCK_FILE, msg + '\n');
      throw new Error(`STOP: ${msg}. ${BLOCK_FILE} now blocks every launch.`);
    }
  };
  process.once('exit', () => {
    if (!closed && pid) try { execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  });
  return { browser, page, close };
}

/** Start `vite` on a free port for the duration of a script. Returns { url, stop }. */
export async function startVite(root) {
  const port = 5190 + Math.floor(Math.random() * 90);
  const child = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let log = '';
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`vite not ready\n${log}`)), 60000);
    const on = (d) => {
      log += d;
      if (/Local:|ready in/.test(log)) {
        clearTimeout(t);
        res();
      }
    };
    child.stdout.on('data', on);
    child.stderr.on('data', on);
    child.once('exit', (c) => rej(new Error(`vite exited ${c}\n${log}`)));
  });
  const stop = () => {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill();
    } catch {}
  };
  process.once('exit', stop);
  return { url: `http://localhost:${port}`, stop };
}
