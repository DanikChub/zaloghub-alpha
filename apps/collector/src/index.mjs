import { proxyOptions, telegramTransport, requireConnected } from "./telegram-transport.mjs";
import { withDeadline, startupFailure } from "./deadline.mjs";
import { resolve } from "node:path";
import { Outbox, groupMessages } from "./outbox.mjs";
import { apiUrl } from './api-url.mjs';
const url = apiUrl(process.env);
const token = process.env.MARKETPLACE_COLLECTOR_TOKEN;
if (!token || token.length < 32)
  throw new Error(
    "Задайте MARKETPLACE_COLLECTOR_TOKEN длиной не менее 32 символов",
  );
async function request(path, options = {}) {
  const response = await fetch(`${url.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: { "x-collector-token": token, ...options.headers },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`API HTTP ${response.status}`);
  return response.json();
}
const outbox = new Outbox(
  resolve(process.env.COLLECTOR_STORAGE ?? ".local/collector", "outbox"),
  async (payload) => {
    const form = new FormData();
    form.set("raw", JSON.stringify(payload.raw));
    for (const photo of payload.photos)
      form.append(
        "photos",
        new Blob([Buffer.from(photo.base64, "base64")], { type: "image/jpeg" }),
        `${photo.id}.jpg`,
      );
    await request("/internal/marketplace/messages", {
      method: "POST",
      body: form,
    });
  },
);
const mode = process.argv[2] ?? "live";
if (!["live", "history", "retry"].includes(mode))
  throw new Error("Режим: live, history или retry");
if (mode === "retry") {
  process.exitCode = (await outbox.drain()) ? 1 : 0;
} else {
  const apiId = Number(process.env.TG_API_ID),
    apiHash = process.env.TG_API_HASH,
    session = process.env.TG_SESSION;
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash || !session)
    throw new Error(
      "Нужны TG_API_ID, TG_API_HASH и уже авторизованная TG_SESSION. Авторизация автоматически не запускается.",
    );
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");
  const { NewMessage } = await import("telegram/events/index.js");
  const { EditedMessage } = await import("telegram/events/EditedMessage.js");
  const { ConnectionTCPObfuscated } = await import("telegram/network/index.js");
  const TelegramConnection = telegramTransport(ConnectionTCPObfuscated, message => console.log(message));
  const proxy = proxyOptions(process.env);
  const client = new TelegramClient(
    new StringSession(session.trim()),
    apiId,
    apiHash,
    {
      connection: TelegramConnection,
      useWSS: false,
      connectionRetries: 5,
      floodSleepThreshold: 0,
      proxy,
    },
  );
  client.setLogLevel("none");
  client.onError = async error => {
    console.error(startupFailure(error, "Сетевой транспорт Telegram"));
  };
  const buffers = new Map(),
    active = new Map();
  let failed = false;
  async function store(source, messages) {
    const sorted = [...messages].sort((a, b) => a.id - b.id);
    const main = sorted.find((m) => m.message?.trim()) ?? sorted[0];
    const raw = {
      sourceId: source.id,
      externalMessageId: String(sorted[0].id),
      ...(main.groupedId ? { albumId: String(main.groupedId) } : {}),
      messageIds: sorted.map((m) => String(m.id)),
      text: sorted
        .map((m) => m.message || "")
        .filter(Boolean)
        .join("\n"),
      publishedAt: new Date(
        Math.min(...sorted.map((m) => m.date)) * 1000,
      ).toISOString(),
      revisionAt: new Date(
        Math.max(...sorted.map((m) => m.editDate ?? m.date)) * 1000,
      ).toISOString(),
    };
    // Persist text before any media operation; media errors cannot lose the publication.
    await outbox.put({ raw, photos: [] });
    const photos = [];
    if (source.parseImages)
      for (const message of sorted) {
        if (!message.photo) continue;
        try {
          const bytes = await client.downloadMedia(message, {});
          if (!Buffer.isBuffer(bytes) || bytes.length > 5 * 1024 * 1024)
            throw new Error("photo");
          photos.push({
            id: String(message.id),
            base64: bytes.toString("base64"),
          });
        } catch {
          failed = true;
          console.warn(
            `Не загружено фото сообщения ${message.id}. Повторите историю для этого источника.`,
          );
        }
      }
    if (photos.length) await outbox.put({ raw, photos });
    await outbox.drain();
  }
  async function flush(key) {
    const entry = buffers.get(key);
    if (!entry) return;
    buffers.delete(key);
    clearTimeout(entry.timer);
    await store(entry.source, [...entry.messages.values()]);
  }
  async function receive(source, message) {
    if (!message.groupedId) return store(source, [message]);
    const key = `${source.id}:${message.groupedId}`;
    const entry = buffers.get(key) ?? { source, messages: new Map() };
    entry.messages.set(message.id, message);
    clearTimeout(entry.timer);
    entry.timer = setTimeout(
      () =>
        flush(key).catch(() => {
          failed = true;
          console.error(
            "Не удалось записать альбом. Проверьте диск; повторите историю.",
          );
        }),
      1500,
    );
    buffers.set(key, entry);
  }
  async function sync() {
    const sources = await request("/internal/marketplace/sources");
    const ids = new Set(sources.map((s) => s.id));
    for (const [id, entry] of active)
      if (
        !ids.has(id) ||
        JSON.stringify(entry.source) !==
          JSON.stringify(sources.find((s) => s.id === id))
      ) {
        for (const [handler, event] of entry.handlers)
          client.removeEventHandler(handler, event);
        active.delete(id);
      }
    for (const source of sources)
      if (!active.has(source.id)) {
        const ref =
          source.channelUsername ||
          (source.channelId.startsWith("-100")
            ? source.channelId
            : `-100${source.channelId}`);
        await client.getEntity(ref);
        const handler = (event) =>
          receive(source, event.message).catch(() => {
            failed = true;
            console.error(
              `Ошибка сбора источника ${source.id}; повторите историю.`,
            );
          });
        const handlers = [NewMessage, EditedMessage].map((Event) => [
          handler,
          new Event({ chats: [ref] }),
        ]);
        for (const [fn, event] of handlers) client.addEventHandler(fn, event);
        active.set(source.id, { source, handlers });
      }
  }
  let timer, retryTimer;
  async function shutdown() {
    clearInterval(timer);
    clearInterval(retryTimer);
    for (const key of [...buffers.keys()]) await flush(key);
    await outbox.drain();
    await client.disconnect();
  }
  let startupStage = "Получение источников API";
  try {
    // Fail before Telegram connection if API/configuration is unavailable.
    const sources = await request("/internal/marketplace/sources");
    startupStage = "Подключение к Telegram";
    console.log("Подключение к Telegram (таймаут 45 секунд)…");
    const connected = await withDeadline(() => client.connect(), 45000, startupStage);
    requireConnected(connected, client);
    startupStage = "Проверка Telegram-сессии";
    if (!(await withDeadline(() => client.checkAuthorization(), 20000, startupStage)))
      throw new Error("Сессия Telegram недействительна");
    await outbox.drain();
    if (mode === "history") {
      const sourceId = process.argv[3],
        from = process.argv[4],
        limit = Number(process.argv[5] ?? 100);
      if (
        !sourceId ||
        !from ||
        !Number.isFinite(Date.parse(from)) ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 10000
      )
        throw new Error("history <sourceId> <YYYY-MM-DD> <limit 1..10000>");
      const source = sources.find((s) => s.id === sourceId);
      if (!source) throw new Error("Активный источник не найден");
      const ref = source.channelUsername || (source.channelId.startsWith("-100") ? source.channelId : `-100${source.channelId}`);
      const collected = [];
      for await (const message of client.iterMessages(ref, { limit })) {
        if (message.date * 1000 < Date.parse(from)) break;
        collected.push(message);
      }
      // Complete albums at the date/limit boundary using neighbouring IDs.
      const boundary = collected.filter((m) => m.groupedId);
      if (boundary.length) {
        const ids = new Set();
        for (const m of [boundary[0], boundary.at(-1)])
          for (let id = Math.max(1, m.id - 10); id <= m.id + 10; id++)
            ids.add(id);
        const extra = await client.getMessages(ref, { ids: [...ids] });
        const albums = new Set(boundary.map((m) => String(m.groupedId)));
        const seen = new Set(collected.map((m) => m.id));
        for (const m of extra)
          if (
            m?.groupedId &&
            albums.has(String(m.groupedId)) &&
            !seen.has(m.id)
          )
            collected.push(m);
      }
      for (const group of groupMessages(collected)) {
        await store(source, group);
        await new Promise((r) => setTimeout(r, 200));
      }
      const pending = await outbox.drain();
      process.exitCode = failed || pending ? 1 : 0;
      await client.disconnect();
    } else {
      startupStage = "Подписка на каналы";
      console.log("Telegram подключён. Подписка на каналы…");
      await withDeadline(() => sync(), 60000, startupStage);
      timer = setInterval(
        () =>
          sync().catch(() =>
            console.warn(
              "Не удалось обновить источники; текущие подписки сохранены.",
            ),
          ),
        30000,
      );
      retryTimer = setInterval(
        () =>
          outbox
            .drain()
            .catch(() => console.warn("Очередь недоступна; проверьте диск.")),
        30000,
      );
      for (const signal of ["SIGINT", "SIGTERM"])
        process.once(signal, () =>
          shutdown()
            .then(() => process.exit(failed ? 1 : 0))
            .catch(() => process.exit(1)),
        );
      console.log(
        "Сборщик запущен. Сообщения и секреты в журнал не выводятся.",
      );
    }
  } catch (error) {
    clearInterval(timer);
    clearInterval(retryTimer);
    for (const entry of buffers.values()) clearTimeout(entry.timer);
    console.error(startupFailure(error, startupStage));
    await withDeadline(() => client.destroy(), 5000, "Остановка Telegram-клиента").catch(() => {});
    console.error(
      "Сборщик остановлен: проверьте API, параметры запуска, доступ к каналам и Telegram-сессию. Очередь сохранена.",
    );
    process.exitCode = 1;
  }
}
