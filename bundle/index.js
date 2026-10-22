/**
 * turn-chime — play a notification sound on the Host machine whenever an Agent finishes a turn.
 *
 * Placement: the Harness Client exposes no turn-level event, while the Host emits
 * `agent/turn-stopping` (the turn is about to close) for every Agent. Playing here keeps the
 * reminder audible even when no browser page is open.
 *
 * Format: the sound must be a WAV. `System.Media.SoundPlayer` is the one audio route that works
 * on this machine — the legacy WMP/WPF media stack is gone on Windows 11 25H2, WinRT MediaPlayer
 * does not run in a headless process, and no CLI decoder is installed. `notify.wav` is the
 * configured MP3 decoded once, so playback is the same audio, not a substitute sound.
 *
 * @module @local/dsh-turn-chime
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POWERSHELL = path.join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);
const LOG_LIMIT_BYTES = 64 * 1024;
const SUBAGENT_TRACK_LIMIT = 512;

/**
 * Register the turn-end chime on one Host Context.
 * @param ctx - owning Cordis Context; listeners are disposed with it.
 * @param config - row configuration (see `cordis.patch.yml`).
 * @returns a disposer that unregisters this plugin's listeners.
 */
export function apply(ctx, config = {}) {
  const settings = {
    enabled: config.enabled !== false,
    soundPath:
      typeof config.soundPath === 'string' && config.soundPath !== ''
        ? config.soundPath
        : path.join(HERE, 'notify.wav'),
    scriptPath:
      typeof config.scriptPath === 'string' && config.scriptPath !== ''
        ? config.scriptPath
        : path.join(HERE, 'play.ps1'),
    cooldownMs:
      Number.isFinite(config.cooldownMs) && config.cooldownMs >= 0 ? Number(config.cooldownMs) : 2500,
    includeSubagents: config.includeSubagents === true,
    logPath: typeof config.logPath === 'string' ? config.logPath : '',
  };

  const warn = (message) => {
    try {
      ctx.logger?.warn?.(`turn-chime: ${message}`);
    } catch {
      /* a diagnostic must never break activation */
    }
  };

  if (!settings.enabled) {
    warn('disabled by row config; no chime');
    return;
  }
  for (const [label, target] of [
    ['PowerShell', POWERSHELL],
    ['player script', settings.scriptPath],
    ['sound file', settings.soundPath],
  ]) {
    if (!existsSync(target)) {
      warn(`${label} not found at ${target}; chime stays inactive`);
      return;
    }
  }

  const subagentIds = new Set();
  let lastPlayedAt = 0;

  const note = (message) => {
    if (settings.logPath === '') return;
    try {
      if (existsSync(settings.logPath) && statSync(settings.logPath).size > LOG_LIMIT_BYTES) {
        writeFileSync(settings.logPath, '');
      }
      appendFileSync(settings.logPath, `${new Date().toISOString()} ${message}\n`);
    } catch {
      /* logging is diagnostic only */
    }
  };

  const sessionOf = (payload) =>
    payload && payload.agent && typeof payload.agent.id === 'string' ? payload.agent.id : '';

  const chime = (reason, sessionId) => {
    if (!settings.includeSubagents && subagentIds.has(sessionId)) {
      note(`${reason} skipped=subagent session=${sessionId}`);
      return;
    }
    const now = Date.now();
    if (now - lastPlayedAt < settings.cooldownMs) {
      note(`${reason} skipped=cooldown session=${sessionId}`);
      return;
    }
    lastPlayedAt = now;
    try {
      const child = spawn(
        POWERSHELL,
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-WindowStyle',
          'Hidden',
          '-File',
          settings.scriptPath,
          settings.soundPath,
        ],
        { detached: true, stdio: 'ignore', windowsHide: true },
      );
      child.on('error', (error) => note(`${reason} spawn-error=${error?.message ?? error}`));
      child.unref();
      note(`${reason} played session=${sessionId}`);
    } catch (error) {
      note(`${reason} throw=${error?.message ?? error}`);
    }
  };

  const disposers = [
    ctx.on('subagent/start', (info) => {
      if (info && typeof info.id === 'string') subagentIds.add(info.id);
    }),
    ctx.on('subagent/end', (info) => {
      if (!info) return;
      if (typeof info.id === 'string') subagentIds.delete(info.id);
      if (subagentIds.size > SUBAGENT_TRACK_LIMIT) subagentIds.clear();
    }),
    ctx.on('agent/turn-stopping', (payload) => {
      chime('turn-stopping', sessionOf(payload));
    }),
    ctx.on('agent/status', (payload) => {
      if (payload && payload.status === 'idle') chime('idle', sessionOf(payload));
    }),
  ];

  note(`activated sound=${settings.soundPath} cooldownMs=${settings.cooldownMs}`);
  warn(`active; sound=${settings.soundPath}`);

  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        /* the context may already be torn down */
      }
    }
  };
}
