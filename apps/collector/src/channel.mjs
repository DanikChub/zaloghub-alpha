// StringSession contains authentication, not the access hashes for private channels.
export async function resolveChannel(client, source) {
  let entity;
  try { entity = await client.getEntity(source.channelId); }
  catch {
    if (!source.channelUsername) throw new Error('SOURCE_CHANNEL_UNAVAILABLE');
    entity = await client.getEntity(source.channelUsername);
  }
  const expected = source.channelId.replace(/^-100/, '');
  if (entity?.id?.toString() !== expected) throw new Error('SOURCE_CHANNEL_ID_MISMATCH');
  return entity;
}
