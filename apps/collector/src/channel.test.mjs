import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChannel } from './channel.mjs';
test('stable channel ID takes precedence over a stale username', async () => {
  const calls=[];
  const entity={id:1362154501n};
  const result=await resolveChannel({getEntity:async ref=>{calls.push(ref);return entity;}},{channelId:'-1001362154501',channelUsername:'stale_name'});
  assert.equal(result,'-1001362154501');assert.deepEqual(calls,['-1001362154501']);
});
test('real GramJS new/edit event builders resolve the returned reference without object lookup', async () => {
  const { NewMessage } = await import('telegram/events/index.js');
  const { EditedMessage } = await import('telegram/events/EditedMessage.js');
  const ref = await resolveChannel({ getEntity: async () => ({ id: 1362154501n }) }, { channelId:'-1001362154501' });
  for (const Event of [NewMessage, EditedMessage]) {
    const event = new Event({ chats:[ref] });
    await event.resolve({ getInputEntity: () => { throw Error('Numeric IDs must not become object strings'); } });
    assert.deepEqual(event.chats,['-1001362154501']);
    assert.equal(event.resolved,true);
  }
});
test('username fallback cannot silently subscribe to a different channel', async () => {
  const source={channelId:'-1001362154501',channelUsername:'reassigned_name'};
  const client={getEntity:async ref=>{if(ref===source.channelId)throw Error('not cached');return {id:99n};}};
  await assert.rejects(resolveChannel(client,source),/ID_MISMATCH/);
});
