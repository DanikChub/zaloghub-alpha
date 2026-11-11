// Run interactively on the operator's computer; never in a container or CI.
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { ConnectionTCPObfuscated } from 'telegram/network/index.js';
import { proxyOptions, telegramTransport } from './telegram-transport.mjs';

if (!process.stdin.isTTY) throw new Error('Run this command in your own interactive terminal');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const useQr = args.includes('--qr');
const envPath = resolve(root, args.find(arg => !arg.startsWith('--')) ?? 'deploy/secrets/collector.env');
const qrPage = resolve(root, '.local/telegram-login.html');
const env = parseEnv(await readFile(envPath, 'utf8'));
if (!Number(env.TG_API_ID) || !env.TG_API_HASH) throw new Error('TG_API_ID and TG_API_HASH are required');
let silent = false;
const output = new Writable({ write(chunk, encoding, done) { if (!silent) process.stdout.write(chunk, encoding); done(); } });
output.isTTY = true;
const input = createInterface({ input: process.stdin, output, terminal: true });
async function ask(prompt) {
  process.stdout.write(prompt);
  silent = true;
  try { return (await input.question('')).trim(); }
  finally { silent = false; process.stdout.write('\n'); }
}
const Transport = telegramTransport(ConnectionTCPObfuscated, message => console.log(message));
const client = new TelegramClient(new StringSession(''), Number(env.TG_API_ID), env.TG_API_HASH, {
  connection: Transport, useWSS: false, connectionRetries: 2, proxy: proxyOptions(env),
});
client.setLogLevel('none');
input.on('SIGINT', () => { input.close(); process.exit(1); });
try {
  console.log('Create a separate Telegram session for the production collector. Input is hidden.');
  const callbacks = {
    phoneNumber: () => ask('Phone number, including country code: '),
    phoneCode: viaApp => ask(viaApp ? 'Code from the Telegram service chat: ' : 'Telegram login code: '),
    password: () => ask('Telegram two-step verification password: '),
    onError: () => { throw new Error('Authorization failed; check the entered data and proxy'); },
  };
  if (useQr) {
    // Reuse the frontend's declared dependencies; authorization runs from the repo.
    const webRequire = createRequire(resolve(root, 'apps/web/package.json'));
    const React = webRequire('react');
    const { renderToStaticMarkup } = webRequire('react-dom/server');
    const QRCode = webRequire('antd/lib/qr-code/index.js').default;
    await mkdir(resolve(root, '.local'), { recursive: true });
    let opened = false;
    await client.connect();
    await client.signInUserWithQrCode({ apiId: Number(env.TG_API_ID), apiHash: env.TG_API_HASH }, {
      ...callbacks,
      qrCode: async ({ token }) => {
        const svg = renderToStaticMarkup(React.createElement(QRCode, { value: `tg://login?token=${Buffer.from(token).toString('base64url')}`, type: 'svg', size: 320, bordered: false }));
        await writeFile(qrPage, `<!doctype html><html lang="ru"><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>Telegram login</title><body style="font-family:system-ui;text-align:center;margin:40px"><h1>Вход в сборщик ZalogHub</h1><p>Telegram на телефоне → Настройки → Устройства → Подключить устройство</p>${svg}<p>QR обновляется автоматически. После сканирования проверь терминал.</p></body></html>`, { mode: 0o600 });
        if (!opened) {
          opened = true;
          console.log('Open .local/telegram-login.html in your browser and scan it from Telegram on your phone.');
          if (process.platform === 'win32') {
            const escaped = qrPage.replace(/'/g, "''");
            const opener = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath '${escaped}'`], { stdio: 'ignore', windowsHide: true });
            opener.on('error', () => {});
          }
        }
      },
    });
  } else {
    await client.start(callbacks);
  }
  const current = await readFile(envPath, 'utf8');
  const line = `TG_SESSION=${JSON.stringify(client.session.save())}`;
  const updated = /^TG_SESSION=.*$/m.test(current)
    ? current.replace(/^TG_SESSION=.*$/m, () => line)
    : `${current}\n${line}\n`;
  await writeFile(envPath, updated, { mode: 0o600 });
  console.log('Authorized. TG_SESSION saved to collector.env; the session was not printed.');
} catch {
  console.error('Authorization failed. Check Telegram login details, API credentials and proxy.');
  process.exitCode = 1;
} finally {
  if (useQr) await writeFile(qrPage, '<!doctype html><meta charset="utf-8"><p>QR-код больше не действует. Результат входа — в терминале.</p>').catch(() => {});
  input.close();
  await client.destroy().catch(() => {});
  setTimeout(() => process.exit(process.exitCode ?? 0), 1000).unref();
}
