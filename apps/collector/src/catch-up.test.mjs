import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatchUp } from './catch-up.mjs';

const source = { id: 'source-1', channelId: '-100123' };
test('restart recovers the oldest missing batch and never advances past failed persistence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collector-catch-up-'));
  try {
    const options = [];
    let messages = [{ id: 9 }, { id: 8 }];
    const client = { async *iterMessages(ref, value) { options.push(value); yield* messages; } };
    const received = [];
    await new CatchUp(directory, client, async (s, group) => received.push(group[0].id), () => {}).scan(source, 'ref');
    assert.deepEqual(received, [8, 9]);
    messages = [{ id: 10 }, { id: 11 }];
    const restarted = new CatchUp(directory, client, async () => { throw new Error('disk full'); }, () => {});
    await assert.rejects(restarted.scan(source, 'ref'));
    assert.equal(JSON.parse(await readFile(join(directory, 'source-1.json'))).id, 9);
    restarted.store = async (s, group) => received.push(group[0].id);
    await restarted.scan(source, 'ref');
    assert.deepEqual(options[1], { limit: 100, minId: 9, reverse: true });
    assert.deepEqual(received, [8, 9, 10, 11]);
    assert.equal(JSON.parse(await readFile(join(directory, 'source-1.json'))).id, 11);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('boundary albums are completed without moving the cursor past the scanned batch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collector-catch-up-'));
  try {
    const client = {
      async *iterMessages() { yield { id: 20, groupedId: 'album' }; },
      async getMessages() { return [{ id: 19, groupedId: 'album' }, { id: 21, groupedId: 'album' }, { id: 22 }]; },
    };
    const groups = [];
    await new CatchUp(directory, client, async (s, group) => groups.push(group.map(m => m.id)), () => {}).scan(source, 'ref');
    assert.deepEqual(groups, [[19, 20, 21]]);
    assert.equal(JSON.parse(await readFile(join(directory, 'source-1.json'))).id, 20);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
