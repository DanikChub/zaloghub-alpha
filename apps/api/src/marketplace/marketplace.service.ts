import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { parseOffer } from './parse-offer.js';
import {
  integer,
  range,
  type RawPublication,
} from './marketplace.validation.js';
export type Upload = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};
const photoSelect = { id: true, externalMessageId: true, mimeType: true };
@Injectable()
export class MarketplaceService {
  constructor(private readonly db: PrismaService) {}
  sources() {
    return this.db.marketplaceSource.findMany({
      where: { enabled: true },
      orderBy: { title: 'asc' },
    });
  }
  async ingest(raw: RawPublication, files: Upload[]) {
    const source = await this.db.marketplaceSource.findUnique({
      where: { id: raw.sourceId },
    });
    if (!source) throw new NotFoundException('Источник не найден');
    if (!source.enabled)
      throw new BadRequestException(
        'Источник отключён; сообщение оставлено в очереди сборщика',
      );
    const photos = files.map((file) => {
      const id = file.originalname.match(/^(\d+)\.(?:jpg|png|webp)$/i)?.[1];
      const b = file.buffer;
      const mime =
        b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
          ? 'image/jpeg'
          : b
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ? 'image/png'
            : b.subarray(0, 4).toString() === 'RIFF' &&
                b.subarray(8, 12).toString() === 'WEBP'
              ? 'image/webp'
              : null;
      if (
        !id ||
        !raw.messageIds.includes(id) ||
        !mime ||
        b.length > 5 * 1024 * 1024
      )
        throw new BadRequestException('Некорректная фотография');
      return {
        externalMessageId: id,
        mimeType: mime,
        content: new Uint8Array(b),
      };
    });
    const parsed = parseOffer(source.key, raw.text, source.contactUrl);
    const channel = source.channelUsername
      ? source.channelUsername.replace(/^@/, '')
      : `c/${source.channelId.replace(/^-100/, '')}`;
    const publicationUrl = `https://t.me/${channel}/${raw.externalMessageId}`;
    // Serialize all deliveries from a source, including concurrent first deliveries.
    // Album ID remains stable when caption or first observed album member changes.
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${source.id}))`;
      const existing = await tx.marketplaceOffer.findFirst({
        where: {
          sourceId: source.id,
          OR: [
            { externalMessageId: raw.externalMessageId },
            ...(raw.albumId ? [{ albumId: raw.albumId }] : []),
          ],
        },
      });
      const stale = existing && existing.revisionAt > new Date(raw.revisionAt);
      const data = {
        ...parsed,
        rawText: raw.text,
        publicationUrl: existing
          ? `https://t.me/${channel}/${existing.externalMessageId}`
          : publicationUrl,
        publishedAt:
          existing && existing.publishedAt < new Date(raw.publishedAt)
            ? existing.publishedAt
            : new Date(raw.publishedAt),
        revisionAt: new Date(raw.revisionAt),
        albumId: raw.albumId ?? null,
        messageIds: Array.from(
          new Set([
            ...((existing?.messageIds as string[]) ?? []),
            ...raw.messageIds,
          ]),
        ),
      };
      // Partial late album fragments must not erase the caption already received.
      const update =
        existing && !raw.text.trim() && existing.rawText.trim()
          ? {
              messageIds: Array.from(
                new Set([
                  ...(existing.messageIds as string[]),
                  ...raw.messageIds,
                ]),
              ),
            }
          : data;
      const offer = existing
        ? stale
          ? existing
          : await tx.marketplaceOffer.update({
              where: { id: existing.id },
              data: update,
            })
        : await tx.marketplaceOffer.create({
            data: {
              ...data,
              sourceId: source.id,
              externalMessageId: raw.externalMessageId,
            },
          });
      for (const photo of photos)
        await tx.marketplacePhoto.upsert({
          where: {
            offerId_externalMessageId: {
              offerId: offer.id,
              externalMessageId: photo.externalMessageId,
            },
          },
          create: { offerId: offer.id, ...photo },
          update: stale
            ? {}
            : { mimeType: photo.mimeType, content: photo.content },
        });
      return { id: offer.id, parseStatus: offer.parseStatus, stale: !!stale };
    });
  }
  async list(userId: string, q: Record<string, string>) {
    if (Object.values(q).some((value) => typeof value !== 'string'))
      throw new BadRequestException('Параметры должны быть строками');
    const page = integer(q.page, 1, 100000),
      limit = integer(q.limit, 12, 60);
    if (q.view && !['all', 'saved', 'hidden'].includes(q.view))
      throw new BadRequestException('Некорректный вид');
    const where: Prisma.MarketplaceOfferWhereInput = {
      source: { enabled: true },
      ...(q.view === 'hidden'
        ? { marks: { some: { userId, hidden: true } } }
        : { marks: { none: { userId, hidden: true } } }),
      ...(q.view === 'saved'
        ? { AND: [{ marks: { some: { userId, saved: true } } }] }
        : {}),
      ...(q.sourceId ? { sourceId: q.sourceId } : {}),
      ...(q.city ? { city: { equals: q.city, mode: 'insensitive' } } : {}),
      ...(q.objectType ? { objectType: q.objectType } : {}),
      ...(q.borrowerType ? { borrowerType: q.borrowerType } : {}),
      ...(q.search
        ? {
            OR: ['rawText', 'address', 'objectName'].map((field) => ({
              [field]: {
                contains: q.search.slice(0, 200),
                mode: 'insensitive',
              },
            })),
          }
        : {}),
      loanAmount: range(q.minAmount, q.maxAmount),
      collateralValue: range(q.minValue, q.maxValue),
      interestRateMonthly: range(q.minRate, q.maxRate),
      loanTermMonths: range(q.minTerm, q.maxTerm),
      ltv: range(q.minLtv, q.maxLtv),
    };
    const sort = q.sort ?? 'publishedAt';
    if (
      ![
        'publishedAt',
        'loanAmount',
        'collateralValue',
        'interestRateMonthly',
        'loanTermMonths',
        'ltv',
      ].includes(sort) ||
      (q.order && !['asc', 'desc'].includes(q.order))
    )
      throw new BadRequestException('Некорректная сортировка');
    const order = q.order === 'asc' ? 'asc' : 'desc';
    const [items, total] = await this.db.$transaction([
      this.db.marketplaceOffer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          {
            [sort]:
              sort === 'publishedAt' ? order : { sort: order, nulls: 'last' },
          },
          { id: 'asc' },
        ],
        include: {
          source: true,
          photos: {
            select: photoSelect,
            orderBy: { externalMessageId: 'asc' },
          },
          marks: { where: { userId }, select: { saved: true, hidden: true } },
        },
      }),
      this.db.marketplaceOffer.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  async one(userId: string, id: string) {
    const offer = await this.db.marketplaceOffer.findUnique({
      where: { id },
      include: {
        source: true,
        photos: { select: photoSelect, orderBy: { externalMessageId: 'asc' } },
        marks: { where: { userId }, select: { saved: true, hidden: true } },
      },
    });
    if (!offer) throw new NotFoundException('Предложение не найдено');
    return offer;
  }
  async mark(
    userId: string,
    offerId: string,
    data: { saved?: boolean; hidden?: boolean },
  ) {
    await this.one(userId, offerId);
    return this.db.marketplaceMark.upsert({
      where: { userId_offerId: { userId, offerId } },
      create: { userId, offerId, ...data },
      update: data,
    });
  }
  async photo(id: string) {
    const photo = await this.db.marketplacePhoto.findUnique({ where: { id } });
    if (!photo) throw new NotFoundException();
    return photo;
  }
  async dictionaries() {
    const [sources, cities, types] = await Promise.all([
      this.sources(),
      this.db.marketplaceOffer.findMany({
        where: { city: { not: null } },
        distinct: ['city'],
        select: { city: true },
        orderBy: { city: 'asc' },
      }),
      this.db.marketplaceOffer.findMany({
        where: { objectType: { not: null } },
        distinct: ['objectType'],
        select: { objectType: true },
        orderBy: { objectType: 'asc' },
      }),
    ]);
    return {
      sources,
      cities: cities.map((x) => x.city),
      objectTypes: types.map((x) => x.objectType),
      borrowerTypes: [
        'individual',
        'self_employed',
        'sole_proprietor',
        'company',
      ],
    };
  }
}
