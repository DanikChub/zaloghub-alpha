import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { groupMessages } from './outbox.mjs';

// Only history scans advance this cursor: a live event must never skip an outage gap.
export class CatchUp {
  constructor(directory, client, store, report = console.log) {
    Object.assign(this, { directory, client, store, report });
    this.running = false;
  }

  async run(entries) {
    if (this.running) return;
    this.running = true;
    try {
      for (const { source, ref } of entries) {
        try { await this.scan(source, ref); }
        catch { this.report(`Автодобор ${source.id}: ошибка; позиция сохранена, повтор при следующей сверке.`); }
      }
    } finally { this.running = false; }
  }

  async scan(source, ref) {
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, `${source.id}.json`);
    let cursor;
    try {
      const saved = JSON.parse(await readFile(path, 'utf8'));
      if (saved.channelId !== source.channelId || !Number.isSafeInteger(saved.id) || saved.id < 0)
        throw new Error('Invalid catch-up cursor');
      cursor = saved.id;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const messages = [];
    // A bounded batch keeps live collection responsive. Further batches follow on the next tick.
    const options = cursor === undefined ? { limit: 100 } : { limit: 100, minId: cursor, reverse: true };
    for await (const message of this.client.iterMessages(ref, options))
      if (Number.isSafeInteger(message.id) && message.id > (cursor ?? 0)) messages.push(message);
    const next = Math.max(cursor ?? 0, ...messages.map(m => m.id));
    // Complete albums crossing the batch boundary before delivering any fragment.
    const albums = new Set(messages.filter(m => m.groupedId).map(m => String(m.groupedId)));
    if (albums.size) {
      const ids = new Set();
      for (const message of [messages[0], messages.at(-1)])
        for (let id = Math.max(1, message.id - 10); id <= message.id + 10; id++) ids.add(id);
      const seen = new Set(messages.map(m => m.id));
      for (const message of await this.client.getMessages(ref, { ids: [...ids] }))
        if (message?.groupedId && albums.has(String(message.groupedId)) && !seen.has(message.id)) {
          messages.push(message);
          seen.add(message.id);
        }
    }
    for (const group of groupMessages(messages).sort((a, b) => a[0].id - b[0].id))
      await this.store(source, group);
    // store() persists the publication in the outbox even when the API is offline.
    await writeFile(`${path}.tmp`, JSON.stringify({ channelId: source.channelId, id: next }));
    await rename(`${path}.tmp`, path);
    if (messages.length) this.report(`Автодобор ${source.id}: сообщений ${messages.length}, позиция ${next}.`);
  }
}
