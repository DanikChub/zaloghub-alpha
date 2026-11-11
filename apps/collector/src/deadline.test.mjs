import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {withDeadline,OperationTimeout,startupFailure} from './deadline.mjs';
test('зависшее top-level await завершается таймаутом, а не кодом 13',()=>{
 const moduleUrl=new URL('./deadline.mjs',import.meta.url).href;
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import {withDeadline} from ${JSON.stringify(moduleUrl)};try{await withDeadline(()=>new Promise(()=>{}),30,'Telegram')}catch(e){console.error(e.message);process.exitCode=1}`],{encoding:'utf8',timeout:3000,windowsHide:true});
 assert.equal(result.status,1);assert.match(result.stderr,/Telegram/);assert.doesNotMatch(result.stderr,/unsettled top-level await/);
});
test('успех и немедленная ошибка освобождают таймер',async()=>{
 assert.equal(await withDeadline(()=>Promise.resolve(42),1000,'connect'),42);
 await assert.rejects(withDeadline(()=>{throw new Error('fixture')},1000,'connect'),/fixture/);
});
test('диагностика не раскрывает произвольные сообщения с секретами',()=>{
 assert.match(startupFailure(new OperationTimeout('Telegram'),'connect'),/прокси/);
 assert.doesNotMatch(startupFailure(new Error('password=secret'),'connect'),/secret/);
 assert.match(startupFailure(new Error('AUTH_KEY_UNREGISTERED'),'connect'),/TG_SESSION/);
});
