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
//   - runs a sentinel while the browser is up (Windows): the counter is machine-wide, so when it rises the sentinel
//     snapshots every Chrome / Edge started since launch, marks ours (by profile dir) and names the parent of the
//     others. BLOCK_FILE carries that snapshot, so a person can tell our browser from another program's automation.
//     (Issue #55: other automation on the same machine can fail the blank-password check too; a pair of those
//     landed during an e2e run and the launcher blamed itself. The seed was verified to work: Chrome 153
//     reads it ~15 s after start, skips LogonUser, and rewrites os_password_last_changed with the real value.)
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

// Polls the failed sign-in counter; on every rise appends a snapshot of the Chrome / Edge processes started since
// launch: OURS when the command line holds our profile dir, else FOREIGN with its parent's command line.
const SENTINEL_PS = `
param([string]$Log, [string]$Profile, [int]$Owner, [int]$Start = -1)
$u = [ADSI]("WinNT://./" + $env:USERNAME + ",user")
$t0 = (Get-Date).AddSeconds(-5); $last = $Start
while (Get-Process -Id $Owner -ErrorAction SilentlyContinue) {
  $u.RefreshCache(); $n = [int]$u.BadPasswordAttempts.Value
  if ($last -ge 0 -and $n -gt $last) {
    $lines = @("{0:HH:mm:ss} counter $last -> $n" -f (Get-Date))
    $all = Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'"
    foreach ($p in $all | Where-Object { $_.CreationDate -ge $t0 -and $_.CommandLine -notmatch '--type=' }) {
      if ($p.CommandLine -like "*$Profile*") { $lines += "  OURS     $($p.Name) pid=$($p.ProcessId)" }
      else {
        $par = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" -ErrorAction SilentlyContinue
        $pc = if ($par) { "$($par.Name): $($par.CommandLine)" } else { "gone" }
        $cl = "$($p.CommandLine)"
        $lines += "  FOREIGN  $($p.Name) pid=$($p.ProcessId) started $($p.CreationDate.ToString('HH:mm:ss')) [$($cl.Substring(0, [Math]::Min(200, $cl.Length)))]"
        $lines += "           parent pid=$($p.ParentProcessId) [$($pc.Substring(0, [Math]::Min(200, $pc.Length)))]"
      }
    }
    Add-Content -Path $Log -Value $lines -Encoding utf8
  }
  $last = $n
  Start-Sleep -Milliseconds 700
}`;

function startSentinel(profile, start) {
  if (process.platform !== 'win32') return null;
  const log = join(tmpdir(), `gs-chrome-sentinel-${process.pid}.log`);
  rmSync(log, { force: true });
  const script = `& {${SENTINEL_PS}} -Log '${log}' -Profile '${profile}' -Owner ${process.pid} -Start ${start ?? -1}`;
  const enc = Buffer.from(script, 'utf16le').toString('base64');
  const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { stdio: 'ignore', windowsHide: true });
  child.unref();
  return {
    report() {
      try {
        execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {}
      let text = '';
      try {
        text = readFileSync(log, 'utf8').trim();
      } catch {}
      rmSync(log, { force: true });
      return text;
    },
  };
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
export async function launchChrome({ width = 900, height = 600, life = 4 * 60_000, mobile = false, dpr = mobile ? 3 : 1, story = false } = {}) {
  if (process.env.GS_NO_BROWSER === '1') throw new Error('GS_NO_BROWSER=1: no browser may be started now');
  if (existsSync(BLOCK_FILE)) throw new Error(`blocked by ${BLOCK_FILE}: the failed sign-in counter rose while a browser was up. The file lists the browsers that were up (OURS / FOREIGN): find out why, then delete it.`);
  const before = badPasswordAttempts();
  if (before !== null && before >= BAD_ATTEMPTS_MAX) throw new Error(`the Windows account has ${before} failed sign-ins: no launch at ${BAD_ATTEMPTS_MAX} or more (the counter clears ~10 minutes after the last failure)`);
  takeLock();
  const profile = mkdtempSync(join(tmpdir(), 'gs-chrome-'));
  writeFileSync(join(profile, 'Local State'), LOCAL_STATE_SEED);
  mkdirSync(join(profile, 'Default'), { recursive: true });
  writeFileSync(join(profile, 'Default', 'Preferences'), JSON.stringify(SAFE_PREFS));
  const sentinel = startSentinel(profile, before);
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
    sentinel?.report();
    dropLock();
    throw e;
  }
  const pid = browser.process()?.pid;
  startWatchdog(pid, profile, Math.min(10 * 60_000, life));
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  await page.evaluateOnNewDocument(SAFE_STUBS);
  // a fresh profile is a first launch: without this every capture / e2e page would open on the story's cold open.
  // `story: true` (or ?story=on in the page URL) keeps the beats.
  if (!story) await page.evaluateOnNewDocument(() => {
    window.__gsNoStory = true;
  });
  await page.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
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
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {} // Windows may still hold a file: the watchdog deletes the profile once Chrome is gone
    dropLock();
    const after = badPasswordAttempts();
    const seen = sentinel?.report() ?? '';
    if (before !== null && after !== null && after > before) {
      const msg = `failed sign-in counter rose from ${before} to ${after} while a headless browser was up (${new Date().toISOString()})`;
      const who = seen || '(no sentinel snapshot)';
      writeFileSync(BLOCK_FILE, `${msg}\nChrome / Edge started meanwhile (OURS = this launcher, FOREIGN = another program):\n${who}\n`);
      throw new Error(`STOP: ${msg}. ${BLOCK_FILE} now blocks every launch.\n${who}`);
    }
  };
  process.once('exit', () => {
    if (!closed && pid) try { execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  });
  return { browser, page, close };
}

/**
 * Collect page errors into `sink` (strings, each prefixed with `prefix`). A failed load of an `/api/` resource is not
 * an error: under plain `vite` the Worker is usually not running, the proxy answers 502, and cloud sync is best effort
 * (client/storage/sync.js). Thrown errors and every other console error still count.
 */
export function collectPageErrors(page, sink, prefix = '') {
  page.on('pageerror', (e) => sink.push(prefix + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url ?? '';
    if (/^Failed to load resource/.test(m.text()) && new URL(url, 'http://x').pathname.startsWith('/api/')) return;
    sink.push(prefix + m.text());
  });
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
