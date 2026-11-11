// Run interactively on the operator's computer; never in a container or CI.
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { ConnectionTCPObfuscated } from 'telegram/network/index.js';
import { proxyOptions, telegramTransport } from './telegram-transport.mjs';

if (!process.stdin.isTTY) throw new Error('Run this command in your own interactive terminal');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const envPath = resolve(root, process.argv[2] ?? 'deploy/secrets/collector.env');
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
  await client.start({
    phoneNumber: () => ask('Phone number, including country code: '),
    phoneCode: () => ask('Telegram login code: '),
    password: () => ask('Telegram two-step verification password: '),
    onError: () => { throw new Error('Authorization failed; check the entered data and proxy'); },
  });
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
  input.close();
  await client.destroy().catch(() => {});
  setTimeout(() => process.exit(process.exitCode ?? 0), 1000).unref();
}
