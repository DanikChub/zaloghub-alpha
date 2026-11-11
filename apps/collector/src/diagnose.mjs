import net from 'node:net';
import {withDeadline} from './deadline.mjs';
const host=process.env.TG_PROXY_HOST?.trim();
const port=Number(process.env.TG_PROXY_PORT);
if (!host || !Number.isInteger(port) || port<1 || port>65535) throw new Error('Проверьте TG_PROXY_HOST и TG_PROXY_PORT');
if(host.includes('://') || /\s/.test(host)) throw new Error('TG_PROXY_HOST должен содержать только имя/IP, без протокола, логина и пароля');
let socket;
try {
 console.log('1/2: TCP-соединение с прокси…');
 await withDeadline(()=>new Promise((resolve,reject)=>{
  socket=net.createConnection({host,port});socket.once('connect',resolve);socket.once('error',reject);
 }),10000,'TCP до прокси');
 console.log('TCP до прокси: OK');
} catch(error) {
 console.error('TCP до прокси: ошибка', ['ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EHOSTUNREACH','EACCES'].includes(error.code)?error.code:'TIMEOUT/NETWORK');
 process.exitCode=1;
} finally {socket?.destroy();}
if(!process.exitCode){
 const {StringSession}=await import('telegram/sessions/index.js');
 const {PromisedNetSockets}=await import('telegram/extensions/PromisedNetSockets.js');
 const session=new StringSession(process.env.TG_SESSION?.trim() || '');
 const transport=new PromisedNetSockets({ip:host,port,socksType:5,timeout:10,username:process.env.TG_PROXY_USERNAME||undefined,password:process.env.TG_PROXY_PASSWORD||undefined});
 try{
  console.log('2/2: SOCKS5-туннель до Telegram на порту 443 (без авторизации)…');
  await withDeadline(()=>transport.connect(443,session.serverAddress || '149.154.167.91'),15000,'SOCKS5 до Telegram');
  console.log('SOCKS5 до Telegram: OK. Telegram-сессия и сообщения не использовались для авторизации.');
 }catch(error){
  const message=error?.message ?? '';
  const reason=/authentication/i.test(message)?'Прокси отклонил логин/пароль':/timed? ?out|timeout/i.test(message)?'Таймаут SOCKS5 или соединения с Telegram':/refused/i.test(message)?'Прокси или целевой адрес отклонил соединение':'Ошибка SOCKS5; проверьте протокол и параметры прокси';
  console.error(reason);process.exitCode=1;
 }finally{await transport.close();}
}
