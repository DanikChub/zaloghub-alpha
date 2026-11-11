import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import { resolve, basename, join, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { parseOffer } from '../dist/marketplace/parse-offer.js';
const input=process.argv[2], photoRoot=process.argv[3];
assert.ok(input && photoRoot,'Usage: node --env-file=.env scripts/import-legacy-marketplace.mjs <export.json> <photo-directory> [--apply]');
const apply=process.argv.includes('--apply');
const url=new URL(process.env.DATABASE_URL);assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Only local destination allowed');
const data=JSON.parse(await readFile(input,'utf8'));assert.ok(Array.isArray(data.sources)&&Array.isArray(data.offers));
const directory=await realpath(photoRoot);
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
const summary={inputOffers:data.offers.length,inputSources:data.sources.length,referencedPhotos:0,readablePhotos:0,created:0,existing:0,photosCreated:0,photosExisting:0,missingPhotos:[],unparsed:0};
const prepared=[];
const sourceIds=new Set(data.sources.map(s=>s.id));
try{
 await client.query('BEGIN READ ONLY');
 const schema=await client.query("select column_name from information_schema.columns where table_schema='public' and table_name='users'");
 assert.ok(schema.rows.some(c=>c.column_name==='passwordHash'),'Destination is not Alpha');
 for(const table of ['marketplace_sources','marketplace_offers','marketplace_photos','marketplace_marks'])assert.ok((await client.query('select to_regclass($1) as name',[`public.${table}`])).rows[0].name,`Missing ${table}; no automatic migration`);
 for(const source of data.sources){assert.ok(source.externalId && /^-100\d+$/.test(source.externalId));const existing=(await client.query('select * from marketplace_sources where key=$1 or "channelId"=$2',[source.key,source.externalId])).rows;assert.ok(existing.length<=1 && (!existing.length || (existing[0].key===source.key && existing[0].channelId===source.externalId)),'Source identity conflict');}
 for(const row of data.offers){
  assert.ok(sourceIds.has(row.sourceId),'Unknown legacy source');assert.match(row.externalMessageId,/^\d+$/);assert.equal(typeof row.fullText,'string');assert.ok(Number.isFinite(Date.parse(row.publishedAt)));
  const photos=[];
  for(const image of row.images ?? []){
   summary.referencedPhotos++;
   const filename=image.filename || basename(image.path || image.url || '');
   assert.ok(filename && filename===basename(filename) && !filename.includes('\\'),'Unsafe photo filename');
   const path=join(directory,filename);
   try{
    const actual=await realpath(path);assert.ok(actual.startsWith(directory+sep),'Photo escapes directory');
    assert.ok((await stat(actual)).size<=50*1024*1024,'Oversize photo');
    const bytes=await readFile(actual);let mime=null;
    if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
    else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
    else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')mime='image/webp';
    if(bytes.subarray(4,8).toString()==='ftyp')mime=bytes.subarray(8,12).toString()==='qt  '?'video/quicktime':'video/mp4';
    assert.ok(mime,'Unsupported media');photos.push({filename,bytes,mime,hash:createHash('sha256').update(bytes).digest('hex')});summary.readablePhotos++;
   }catch(error){if(error.code==='ENOENT')summary.missingPhotos.push({legacyId:row.id,filename});else throw error;}
  }
  prepared.push({row,photos});
 }
 const finance=async()=>{
  const result={};for(const table of ['deals','payments','disbursements','financial_events','deal_finance_journal_versions']){
   const exists=(await client.query('select to_regclass($1) as name',[`public.${table}`])).rows[0].name;
   if(exists)result[table]=(await client.query(`select count(*)::int as count, md5(coalesce(string_agg(row_to_json(t)::text, '' order by id),'')) as hash from "${table}" t`)).rows[0];
  }return result;
 };
 const before=await finance();
 const current=(await client.query('select count(*)::int as offers from marketplace_offers')).rows[0];
 await client.query('COMMIT');
 console.log(JSON.stringify({mode:apply?'apply':'dry-run',target:{host:url.hostname,port:url.port||'5432',database:url.pathname.slice(1)},...summary,currentOffers:current.offers,financialCounts:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.count]))}));
 if(apply){
  const backupDir=resolve('../../.local/legacy-import');await mkdir(backupDir,{recursive:true});
  const backup=join(backupDir,`alpha-before-${Date.now()}.dump`);
  const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:client.connectionParameters.user,PGPASSWORD:client.connectionParameters.password,PGDATABASE:url.pathname.slice(1)};
  const pgDump=process.env.PG_DUMP_PATH || 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe';
  const dump=spawnSync(pgDump,['-Fc','-f',backup],{env,windowsHide:true,encoding:'utf8'});assert.equal(dump.status,0,'Destination backup failed; import cancelled');
  assert.ok((await stat(backup)).size>0);console.log('Destination backup created');
  await client.query('BEGIN');
  await client.query("select pg_advisory_xact_lock(hashtext('legacy-marketplace-import'))");
  const sources=new Map();
  for(const s of data.sources){
   const result=await client.query('insert into marketplace_sources(id,key,title,"channelId","channelUsername","contactUrl",enabled,"parseImages") values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(key) do nothing returning id',[randomUUID(),s.key,s.title||s.name,s.externalId,null,s.defaultContactUrl||null,s.isActive&&s.parseEnabled,s.parseImages]);
   const target=result.rows[0] || (await client.query('select id,"channelId" from marketplace_sources where key=$1',[s.key])).rows[0];
   assert.ok(!target.channelId || target.channelId===s.externalId,'Source changed during import');sources.set(s.id,{...s,targetId:target.id});
  }
  for(const {row,photos} of prepared){
   const source=sources.get(row.sourceId);await client.query('select pg_advisory_xact_lock(hashtext($1))',[source.targetId]);
   let offer=(await client.query('select id from marketplace_offers where "sourceId"=$1 and "externalMessageId"=$2',[source.targetId,row.externalMessageId])).rows[0];
   if(offer)summary.existing++;
   else{
    const parsed=parseOffer(source.key,row.fullText,source.defaultContactUrl||null);if(parsed.parseStatus!=='PARSED')summary.unparsed++;
    parsed.declared.legacyImport={legacyId:row.id,sourceId:row.sourceId,originalPublishedAt:row.publishedAt,originalCreatedAt:row.createdAt,originalUpdatedAt:row.updatedAt,postUrl:row.postUrl,photoFilenames:(row.images??[]).map(i=>i.filename),storedFields:{objectName:row.objectName,type:row.type,address:row.address,loanAmount:row.loanAmount,collateralValue:row.collateralValue,loanTermMonths:row.loanTermMonths,borrowerType:row.borrowerType,contactUrl:row.contactUrl},note:'Поля старого парсера сохранены для сверки. Ставки и расчёты извлечены заново из исходного текста.'};
    const record={id:randomUUID(),sourceId:source.targetId,externalMessageId:row.externalMessageId,albumId:null,messageIds:[row.externalMessageId],rawText:row.fullText,publicationUrl:row.postUrl||`https://t.me/c/${source.externalId.replace(/^-100/,'')}/${row.externalMessageId}`,publishedAt:row.publishedAt,revisionAt:row.publishedAt,updatedAt:new Date(),...parsed};
    const keys=Object.keys(record);const jsonFields=new Set(['messageIds','declared','calculated','inferred']);
    const values=keys.map(k=>jsonFields.has(k)?JSON.stringify(record[k]):record[k]);
    offer=(await client.query(`insert into marketplace_offers(${keys.map(k=>'"'+k+'"').join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning id`,values)).rows[0];summary.created++;
   }
   // Legacy storage lost Telegram photo message IDs; stable filename keys prevent reimport duplicates.
   for(const photo of photos){
    const existing=(await client.query('select id,content from marketplace_photos where "offerId"=$1',[offer.id])).rows;
    if(existing.some(p=>createHash('sha256').update(p.content).digest('hex')===photo.hash)){summary.photosExisting++;continue;}
    const result=await client.query('insert into marketplace_photos(id,"offerId","externalMessageId","mimeType",content) values($1,$2,$3,$4,$5) on conflict("offerId","externalMessageId") do nothing returning id',[randomUUID(),offer.id,`legacy:${photo.filename}`,photo.mime,photo.bytes]);
    if(result.rowCount)summary.photosCreated++;else summary.photosExisting++;
   }
  }
  assert.deepEqual(await finance(),before,'Financial data changed: import will roll back');
  const pairs=await client.query('select "sourceId","externalMessageId",count(*) from marketplace_offers group by 1,2 having count(*)>1');assert.equal(pairs.rowCount,0);
  await client.query('COMMIT');
  const counts=(await client.query('select (select count(*)::int from marketplace_offers) as offers,(select count(*)::int from marketplace_photos) as photos')).rows[0];
  const report={...summary,final:counts,financialDataUnchanged:true};await writeFile(join(backupDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }
} catch(error){await client.query('ROLLBACK').catch(()=>{});console.error('Import failed:',error.message);process.exitCode=1;}finally{await client.end();}

