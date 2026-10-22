#!/usr/bin/env node
'use strict';
/*
 * launch-next.js - Stop-hook launcher for the 5-session workflow.
 * Node built-ins only. Works on Windows, macOS and Linux.
 *
 * Behaviour:
 *   - Looks at gate markers (.workflow/gates/*) and lock files (.workflow/locks/*).
 *   - Launches the FIRST session whose marker exists and whose lock does not,
 *     in a NEW terminal window running interactive `claude` with that session's prompt.
 *   - The lock is created atomically (O_EXCL) BEFORE launching, so a session can never start twice.
 *     If the launch itself fails, the lock is removed so a later Stop can retry.
 *   - Logs every decision to .workflow/launch.log.
 *   - Always exits 0 and prints nothing (except with --dry-run) so it can never block Claude.
 *
 * Flags: --dry-run  print what would happen; create no locks, wrappers or windows.
 * To deliberately re-run a session: delete .workflow/locks/session-N.lock and re-touch its gate.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DRY = process.argv.includes('--dry-run');
const WF = __dirname;
const ROOT = path.resolve(WF, '..');
const GATES = path.join(WF, 'gates');
const LOCKS = path.join(WF, 'locks');
const PROMPTS = path.join(WF, 'prompts');
const LOG = path.join(WF, 'launch.log');

const SESSIONS = [
  { n: 2, name: 'test-case-writing', marker: 'definition.approved', prompt: 'session-2-test-cases.md' },
  { n: 3, name: 'planning',          marker: 'testcases.approved',  prompt: 'session-3-planning.md' },
  { n: 4, name: 'build',             marker: 'plan.approved',       prompt: 'session-4-build.md' },
  { n: 5, name: 'test-execution',    marker: 'build.complete',      prompt: 'session-5-test-execution.md' },
];

const exists = (p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } };

function log(msg) {
  const line = `${new Date().toISOString()} ${DRY ? '[DRY-RUN] ' : ''}${msg}`;
  try { fs.appendFileSync(LOG, line + '\n'); } catch (_) { /* fail quietly */ }
  if (DRY) console.log(line);
}

function onPath(names) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) for (const n of names) if (exists(path.join(d, n))) return path.join(d, n);
  return null;
}

const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

function startingPrompt(s) {
  return `Read .workflow/prompts/${s.prompt} and follow it exactly. It is your complete set of instructions for this session.`;
}

function buildWrapper(s) {
  const prompt = startingPrompt(s);
  if (process.platform === 'win32') {
    const file = path.join(LOCKS, `run-session-${s.n}.cmd`);
    const body = `@echo off\r\ncd /d "${ROOT}"\r\ncall claude "${prompt}"\r\n`;
    return { file, body, mode: 0o644 };
  }
  const ext = process.platform === 'darwin' ? 'command' : 'sh';
  const file = path.join(LOCKS, `run-session-${s.n}.${ext}`);
  const body = `#!/bin/sh\ncd ${shq(ROOT)} || exit 1\nexec claude ${shq(prompt)}\n`;
  return { file, body, mode: 0o755 };
}

function terminalCommand(s, wrapperFile) {
  if (process.platform === 'win32') {
    const line = `"start "Claude Session ${s.n}" cmd.exe /k "${wrapperFile}""`;
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', line], opts: { windowsVerbatimArguments: true } };
  }
  if (process.platform === 'darwin') {
    return { cmd: 'open', args: ['-a', 'Terminal', wrapperFile], opts: {} };
  }
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return { error: 'no graphical display (DISPLAY/WAYLAND_DISPLAY unset)' };
  const cands = [
    ['x-terminal-emulator', ['-e', wrapperFile]],
    ['gnome-terminal', ['--', wrapperFile]],
    ['konsole', ['-e', wrapperFile]],
    ['xfce4-terminal', ['-x', wrapperFile]],
    ['alacritty', ['-e', wrapperFile]],
    ['kitty', [wrapperFile]],
    ['xterm', ['-e', wrapperFile]],
  ];
  for (const [bin, args] of cands) {
    const found = onPath([bin]);
    if (found) return { cmd: found, args, opts: {} };
  }
  return { error: 'no supported terminal emulator found on PATH' };
}

function spawnDetached(cmd, args, opts) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, Object.assign({ cwd: ROOT, detached: true, stdio: 'ignore' }, opts));
    } catch (e) { return resolve({ ok: false, err: e.message }); }
    child.once('error', (e) => resolve({ ok: false, err: e.message }));
    child.once('spawn', () => { try { child.unref(); } catch (_) {} resolve({ ok: true }); });
  });
}

async function main() {
  const state = SESSIONS.map((s) => ({
    s,
    marker: exists(path.join(GATES, s.marker)),
    lock: exists(path.join(LOCKS, `session-${s.n}.lock`)),
  }));
  const summary = state.map((x) => `S${x.s.n}[marker=${x.marker ? 'Y' : 'n'},lock=${x.lock ? 'Y' : 'n'}]`).join(' ');

  const next = state.find((x) => x.marker && !x.lock);
  if (!next) {
    log(`no-op: ${summary} -> nothing to launch`);
    return;
  }
  const s = next.s;
  const promptFile = path.join(PROMPTS, s.prompt);
  if (!exists(promptFile)) { log(`skip S${s.n}: prompt file missing (${promptFile}). ${summary}`); return; }
  if (!onPath(process.platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude.bat', 'claude'] : ['claude'])) {
    log(`skip S${s.n}: 'claude' not found on PATH. ${summary}`); return;
  }

  const wrapper = buildWrapper(s);
  const term = terminalCommand(s, wrapper.file);
  if (term.error) { log(`skip S${s.n}: ${term.error}. ${summary}`); return; }

  if (DRY) {
    log(`would launch S${s.n} (${s.name}): marker ${s.marker} present, no lock. ${summary}`);
    log(`would create lock ${path.join(LOCKS, `session-${s.n}.lock`)}`);
    log(`would write wrapper ${wrapper.file}:\n${wrapper.body}`);
    log(`would run: ${term.cmd} ${term.args.join(' ')}   (cwd=${ROOT})`);
    return;
  }

  fs.mkdirSync(LOCKS, { recursive: true });
  const lockPath = path.join(LOCKS, `session-${s.n}.lock`);
  let fd;
  try { fd = fs.openSync(lockPath, 'wx'); }
  catch (e) { log(`skip S${s.n}: lock already exists/race lost (${e.code}). ${summary}`); return; }
  try { fs.writeSync(fd, JSON.stringify({ session: s.n, name: s.name, createdAt: new Date().toISOString(), by: process.pid }) + '\n'); } catch (_) {}
  try { fs.closeSync(fd); } catch (_) {}

  let res;
  try {
    fs.writeFileSync(wrapper.file, wrapper.body, { mode: wrapper.mode });
    try { fs.chmodSync(wrapper.file, wrapper.mode); } catch (_) {}
    res = await spawnDetached(term.cmd, term.args, term.opts);
  } catch (e) { res = { ok: false, err: e.message }; }

  if (res.ok) {
    log(`LAUNCHED S${s.n} (${s.name}) via ${path.basename(term.cmd)}; lock ${path.basename(lockPath)} created. ${summary}`);
  } else {
    try { fs.unlinkSync(lockPath); } catch (_) {}
    log(`FAILED to launch S${s.n}: ${res.err}; lock removed so a later Stop can retry. ${summary}`);
  }
}

const hard = setTimeout(() => process.exit(0), 5000); // never hang the hook
main().catch((e) => { try { log(`error: ${e && e.message}`); } catch (_) {} }).finally(() => { clearTimeout(hard); process.exit(0); });
