import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export class Outbox {
  constructor(directory, send) {
    this.directory = directory;
    this.send = send;
    this.running = false;
  }
  async put(value) {
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, `${Date.now()}-${randomUUID()}.json`);
    await writeFile(`${path}.tmp`, JSON.stringify(value), { mode: 0o600 });
    await rename(`${path}.tmp`, path);
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    let pending = 0;
    try {
      await mkdir(this.directory, { recursive: true });
      for (const name of (await readdir(this.directory))
        .filter((n) => n.endsWith(".json"))
        .sort()) {
        const path = join(this.directory, name);
        try {
          await this.send(JSON.parse(await readFile(path, "utf8")));
          await unlink(path);
        } catch {
          pending++; /* Never log message bodies, headers, sessions or responses. */
        }
      }
    } finally {
      this.running = false;
    }
    if (pending)
      console.warn(
        `В очереди осталось сообщений: ${pending}. Повтор через 30 секунд; проверьте API и конфигурацию.`,
      );
    return pending;
  }
}
export function groupMessages(messages) {
  const groups = new Map();
  for (const message of messages) {
    const key = message.groupedId
      ? `album:${message.groupedId}`
      : `message:${message.id}`;
    const group = groups.get(key) ?? [];
    group.push(message);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => group.sort((a, b) => a.id - b.id));
}
