import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Outbox, groupMessages } from "./outbox.mjs";
test("сбой API и перезапуск сохраняют сообщение и фото до подтверждения", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zaloghub-outbox-"));
  const value = {
    raw: { text: "неразобранный текст" },
    photos: [{ id: "1", base64: "abc" }],
  };
  try {
    const queue = new Outbox(dir, async () => {
      throw new Error("offline");
    });
    await queue.put(value);
    assert.equal(await queue.drain(), 1);
    const received = [];
    const restarted = new Outbox(dir, async (v) => received.push(v));
    await restarted.drain();
    await restarted.drain();
    assert.deepEqual(received, [value]);
    assert.deepEqual(await readdir(dir), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("альбомы не смешиваются, сообщения упорядочиваются", () => {
  const groups = groupMessages([
    { id: 3, groupedId: "8" },
    { id: 1, groupedId: "8" },
    { id: 2 },
    { id: 4, groupedId: "9" },
  ]);
  assert.deepEqual(
    groups.map((g) => g.map((m) => m.id)),
    [[1, 3], [2], [4]],
  );
});
