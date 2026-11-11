import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChannel } from './channel.mjs';
test('stable channel ID takes precedence over a stale username', async () => {
  const calls=[];
  const entity={id:1362154501n};
  const result=await resolveChannel({getEntity:async ref=>{calls.push(ref);return entity;}},{channelId:'-1001362154501',channelUsername:'stale_name'});
  assert.equal(result,entity);assert.deepEqual(calls,['-1001362154501']);
});
test('username fallback cannot silently subscribe to a different channel', async () => {
  const source={channelId:'-1001362154501',channelUsername:'reassigned_name'};
  const client={getEntity:async ref=>{if(ref===source.channelId)throw Error('not cached');return {id:99n};}};
  await assert.rejects(resolveChannel(client,source),/ID_MISMATCH/);
});
