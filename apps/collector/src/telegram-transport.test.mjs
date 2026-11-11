import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proxyOptions,telegramTransport,requireConnected} from './telegram-transport.mjs';
test('SOCKS5 учитывает enabled и передаёт реквизиты без изменения',()=>{
 const env={TG_PROXY_HOST:'localhost',TG_PROXY_PORT:'1080',TG_PROXY_USERNAME:'fixture',TG_PROXY_PASSWORD:'fixture'};
 assert.equal(proxyOptions({...env,TG_PROXY_ENABLED:'false'}),undefined);
 assert.deepEqual(proxyOptions(env),{ip:'localhost',port:1080,socksType:5,timeout:20,username:'fixture',password:'fixture'});
 assert.throws(()=>proxyOptions({...env,TG_PROXY_PORT:'invalid'}));
});
test('MTProto не подменяется SOCKS5 и проверяет secret',()=>{
 const env={TG_PROXY_HOST:'localhost',TG_PROXY_PORT:'443',TG_PROXY_TYPE:'mtproto',TG_PROXY_SECRET:'ab'.repeat(16)};
 assert.equal(proxyOptions(env).MTProxy,true);assert.equal(proxyOptions(env).socksType,undefined);
 assert.throws(()=>proxyOptions({...env,TG_PROXY_SECRET:''}));
});
test('транспорт принудительно использует 443 и сообщает этапы без содержимого пакетов',async()=>{
 class Base{constructor(options){this.options=options;}async _connect(){}async recv(){return Buffer.from('private packet');}}
 const events=[];const Transport=telegramTransport(Base,x=>events.push(x));const connection=new Transport({port:80});
 assert.equal(connection.options.port,443);await connection._connect();await connection.recv();await connection.recv();
 assert.equal(events.length,3);assert.ok(events.every(x=>!x.includes('private packet')));
});
test('ложный результат connect не запускает проверку авторизации',()=>{
 assert.throws(()=>requireConnected(false,{connected:false}));assert.throws(()=>requireConnected(true,{connected:false}));requireConnected(true,{connected:true});
});
