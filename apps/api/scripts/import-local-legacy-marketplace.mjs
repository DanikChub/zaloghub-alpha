import { readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { parseOffer } from '../dist/marketplace/parse-offer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const legacyRoot = path.resolve(root, '../zaloghub/server');
const legacyEnv = parseEnv(await readFile(path.join(legacyRoot, '.env'), 'utf8'));
const env = parseEnv(await readFile(path.join(root, 'apps/api/.env'), 'utf8'));
const apply = process.argv.includes('--apply');
if (!['localhost','127.0.0.1','[::1]'].includes(new URL(env.DATABASE_URL).hostname)) throw new Error('Only local target allowed');
let targetConnected = false;
const source = new pg.Client({ host: legacyEnv.DB_HOST || 'localhost', port: Number(legacyEnv.DB_PORT || 5432), database: legacyEnv.DB_NAME || 'zaloghub', user: legacyEnv.DB_USER || 'postgres', password: legacyEnv.DB_PASSWORD || 'postgres', connectionTimeoutMillis: 5000 });
const target = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const report = { mode: apply ? 'apply' : 'dry-run', offers: 0, existing: 0, photos: 0, bytes: 0, missing: [], statuses: {}, estimatedLegacyRates: 0 };
const insert = async (table, data, conflict = '') => {
  const keys = Object.keys(data);
  return target.query(`INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map((_,i) => '$'+(i+1)).join(',')}) ${conflict} RETURNING id`, Object.values(data));
};
try {
  await source.connect(); await target.connect(); targetConnected = true;
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const oldDb = (await source.query('select current_database() db')).rows[0].db;
  const newDb = (await target.query('select current_database() db')).rows[0].db;
  if (oldDb !== 'zaloghub' || newDb !== 'zaloghub_alpha') throw new Error('Unexpected database; expected zaloghub -> zaloghub_alpha');
  const sources = (await source.query('select * from sources order by id')).rows;
  const deals = (await source.query('select d.*, c.name as "legacyCityName" from deals d left join cities c on c.id=d."cityId" order by d.id')).rows;
  const storage = await realpath(path.join(legacyRoot, 'storage/deals'));
  await mkdir(path.join(root,'.local'), { recursive: true });
  await writeFile(path.join(root,'.local/legacy-marketplace-snapshot.json'), JSON.stringify({ sources, deals }, null, 2));
  await target.query('BEGIN');
  await target.query("SELECT pg_advisory_xact_lock(hashtext('legacy-marketplace-import'))");
  const sourceMap = new Map();
  for (const s of sources) {
    const channelId = /^-100\d+$/.test(s.externalId || '') ? s.externalId : /^\d+$/.test(s.externalId || '') ? '-100'+s.externalId : 'legacy:'+s.id;
    const existing = (await target.query('select * from marketplace_sources where key=$1 or "channelId"=$2', [s.key, channelId])).rows;
    if (existing.length > 1 || (existing.length && (existing[0].key !== s.key || existing[0].channelId !== channelId))) throw new Error('Source identity conflict: '+s.key);
    let id = existing[0]?.id;
    if (!id) {
      id = randomUUID();
      const username = s.url?.match(/^https:\/\/t\.me\/([A-Za-z][A-Za-z0-9_]{3,})\/?$/)?.[1] || null;
      await insert('marketplace_sources', {id,key:s.key,title:s.title||s.name,channelId,channelUsername:username,contactUrl:s.defaultContactUrl,enabled:true,parseImages:s.parseImages});
    }
    sourceMap.set(s.id, {id,source:s});
  }
  for (const d of deals) {
    const mapped=sourceMap.get(d.sourceId);
    if (!mapped) throw new Error('Missing source for deal '+d.id);
    const exists=(await target.query('select id from marketplace_offers where "sourceId"=$1 and "externalMessageId"=$2',[mapped.id,d.externalMessageId])).rows[0];
    if (exists) { report.existing++; continue; }
    const parsed=parseOffer(mapped.source.key,d.fullText||'',mapped.source.defaultContactUrl);
    if(d.interestRateMonthlySource==='estimated') report.estimatedLegacyRates++;
    // Legacy city dictionary is a useful explicit inference, never a verified address.
    if (!parsed.city && d.legacyCityName) { parsed.city=d.legacyCityName; parsed.inferred.city=d.legacyCityName; parsed.inferred.cityBasis='Справочник города старого сервиса; не проверено'; }
    const id=randomUUID();
    const images=Array.isArray(d.images)?d.images:[];
    const photos=[];
    for(const [index,img] of images.entries()) {
      const filename=typeof img==='string'?path.basename(img):img.filename || (img.path?path.basename(img.path):img.url?path.basename(img.url):null);
      if(!filename || path.basename(filename)!==filename) {report.missing.push({dealId:d.id,index,reason:'invalid filename'});continue;}
      let file;
      try { file=await realpath(path.join(storage,filename)); } catch(e) { if(e.code==='ENOENT'){report.missing.push({dealId:d.id,filename,reason:'missing file'});continue;}throw e; }
      if(!file.toLowerCase().startsWith((storage+path.sep).toLowerCase())) throw new Error('Photo outside storage');
      const content=await readFile(file);
      let mimeType=content[0]===255&&content[1]===216&&content[2]===255?'image/jpeg':content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':content.subarray(0,4).toString()==='RIFF'&&content.subarray(8,12).toString()==='WEBP'?'image/webp':null;
      if(content.subarray(4,8).toString()==='ftyp') mimeType=content.subarray(8,12).toString()==='qt  '?'video/quicktime':'video/mp4';
      if(!mimeType){report.missing.push({dealId:d.id,filename,reason:'unsupported image'});continue;}
      photos.push({id:randomUUID(),offerId:id,externalMessageId:'legacy:'+filename,mimeType,content});
      report.bytes+=content.length;
    }
    const data={ id,sourceId:mapped.id,externalMessageId:d.externalMessageId,albumId:null,messageIds:JSON.stringify([d.externalMessageId]),rawText:d.fullText||'',publicationUrl:d.postUrl||null,publishedAt:d.publishedAt||d.createdAt,revisionAt:d.updatedAt||d.createdAt,receivedAt:d.createdAt,updatedAt:d.updatedAt||d.createdAt,...parsed };
    data.parserVersion += '+legacy-import-1';
    data.declared=JSON.stringify(parsed.declared); data.calculated=JSON.stringify(parsed.calculated);
    data.inferred=JSON.stringify({...parsed.inferred,legacy:{database:oldDb,dealId:d.id,sourceId:d.sourceId,original:d,photoHashes:photos.map(p=>({key:p.externalMessageId,sha256:createHash('sha256').update(p.content).digest('hex')}))}});
    await insert('marketplace_offers',data);
    for(const photo of photos) await insert('marketplace_photos',photo);
    report.offers++;report.photos+=photos.length;report.statuses[parsed.parseStatus]=(report.statuses[parsed.parseStatus]||0)+1;
    if(report.offers%100===0) console.log('Processed',report.offers);
  }
  await source.query('COMMIT');
  await target.query(apply?'COMMIT':'ROLLBACK');
  await writeFile(path.join(root,`.local/legacy-marketplace-${apply?'apply':'dry-run'}.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} catch(e) {
  if (targetConnected) await target.query('ROLLBACK').catch(()=>{});
  console.error('Import failed:',e.code || e.name, e.message?.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;
} finally {await source.end();await target.end();}
