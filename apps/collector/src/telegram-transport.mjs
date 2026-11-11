export function proxyOptions(env) {
  const host=env.TG_PROXY_HOST?.trim();
  const enabled=env.TG_PROXY_ENABLED === undefined ? !!host : env.TG_PROXY_ENABLED === 'true';
  if (!enabled) return undefined;
  const type=env.TG_PROXY_TYPE?.trim().toLowerCase() || 'socks5';
  const port=Number(env.TG_PROXY_PORT);
  if(!host || host.includes('://') || /\s/.test(host) || !Number.isInteger(port) || port<1 || port>65535)throw new Error('Проверьте TG_PROXY_HOST и TG_PROXY_PORT: нужны отдельные имя/IP и порт');
  if(type==='socks5')return {ip:host,port,socksType:5,timeout:20,username:env.TG_PROXY_USERNAME || undefined,password:env.TG_PROXY_PASSWORD || undefined};
  if(type!=='mtproto')throw new Error('TG_PROXY_TYPE должен быть socks5 или mtproto');
  const secret=env.TG_PROXY_SECRET?.trim() || '';
  const decoded=Buffer.from(secret,/^[0-9a-f]+$/i.test(secret)?'hex':'base64');
  if(decoded.length!==16 && !(decoded.length===17 && decoded[0]===0xdd))throw new Error('TG_PROXY_SECRET: нужен обычный MTProto secret на 16 байт или dd-secret. Fake-TLS не поддерживается этой GramJS.');
  return {ip:host,port,MTProxy:true,secret};
}
export function telegramTransport(Base,report) {
  return class TelegramConnection extends Base {
    constructor(options){super({...options,port:443});this.firstPacket=false;}
    async _connect(){
      report('Установка TCP-транспорта Telegram на порту 443…');
      await super._connect();
      report('TCP-транспорт установлен. Ожидание ответа протокола Telegram…');
    }
    async recv(){
      const packet=await super.recv();
      if(!this.firstPacket){this.firstPacket=true;report('Получен ответ протокола Telegram.');}
      return packet;
    }
  };
}
export function requireConnected(result,client){
  if(!result || !client.connected)throw new Error('TELEGRAM_CONNECT_FAILED');
}
