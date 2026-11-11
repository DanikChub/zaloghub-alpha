import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { contentHash, downloadRussianCalendar } from './russian-calendar.js';

@Injectable()
export class RussianCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.calendarVersion.findMany({
      where: { calendarCode: 'RU-FEDERAL-5D', status: 'PUBLISHED' },
      orderBy: [{ year: 'desc' }, { importedAt: 'desc' }],
    });
  }

  async importYear(year: number, refresh = false) {
    const current = new Date().getUTCFullYear();
    if (!Number.isInteger(year) || year < 2013 || year > current + 1)
      throw new BadRequestException('Недоступный год российского календаря');
    const existing = await this.prisma.calendarVersion.findFirst({
      where: { calendarCode: 'RU-FEDERAL-5D', year, status: 'PUBLISHED' },
      orderBy: { importedAt: 'desc' },
    });
    if (
      existing &&
      (!refresh || Date.now() - existing.importedAt.getTime() < 300000)
    )
      return existing;
    let days, sourceUrl: string;
    try {
      const downloaded = await downloadRussianCalendar(year);
      days = downloaded.days;
      sourceUrl = downloaded.sourceUrl;
    } catch (error) {
      throw new ServiceUnavailableException(
        `Не удалось загрузить календарь РФ за ${year}: ${error instanceof Error ? error.message : 'ошибка источника'}`,
      );
    }
    const hash = contentHash(days);
    const version = `${year}-${hash}`;
    const same = await this.prisma.calendarVersion.findUnique({
      where: {
        calendarCode_version: { calendarCode: 'RU-FEDERAL-5D', version },
      },
    });
    if (same) return same;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.calendarVersion.create({
          data: {
            calendarCode: 'RU-FEDERAL-5D',
            version,
            timezone: 'Europe/Moscow',
            contentHash: hash,
            year,
            sourceUrl,
          },
        });
        await tx.calendarDay.createMany({
          data: days.map((d) => ({
            calendarVersionId: row.id,
            day: new Date(d.date),
            isWorking: d.isWorking,
            kind: d.kind,
          })),
        });
        return tx.calendarVersion.update({
          where: { id: row.id },
          data: { status: 'PUBLISHED' },
        });
      });
    } catch (error) {
      const concurrent = await this.prisma.calendarVersion.findUnique({
        where: {
          calendarCode_version: { calendarCode: 'RU-FEDERAL-5D', version },
        },
      });
      if (concurrent?.status === 'PUBLISHED') return concurrent;
      throw error;
    }
  }

  async coverage(fromOn: string, toOn: string, ids?: readonly string[]) {
    const years = [];
    for (
      let year = Number(fromOn.slice(0, 4));
      year <= Number(toOn.slice(0, 4));
      year++
    )
      years.push(year);
    if (years.length > 100 || !years.length)
      throw new BadRequestException('Неверный диапазон календаря');
    if (
      years.some(
        (year) => year < 2013 || year > new Date().getUTCFullYear() + 1,
      )
    )
      throw new BadRequestException(
        'Для запрошенного диапазона нет опубликованного календаря РФ',
      );
    const versions = ids
      ? await this.prisma.calendarVersion.findMany({
          where: {
            id: { in: [...ids] },
            calendarCode: 'RU-FEDERAL-5D',
            status: 'PUBLISHED',
          },
        })
      : await Promise.all(years.map((year) => this.importYear(year)));
    if (
      versions.length !== years.length ||
      years.some((year) => versions.filter((v) => v.year === year).length !== 1)
    )
      throw new BadRequestException(
        'Версии календаря не покрывают запрошенные годы',
      );
    const days = await this.prisma.calendarDay.findMany({
      where: { calendarVersionId: { in: versions.map((v) => v.id) } },
      orderBy: { day: 'asc' },
    });
    const start = `${years[0]}-01-01`,
      end = `${years.at(-1)}-12-31`;
    const expected =
      Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    if (days.length !== expected)
      throw new ServiceUnavailableException(
        'Неполная сохранённая версия календаря',
      );
    return {
      versions,
      calendar: {
        fromOn: start,
        toOn: end,
        workingDays: days
          .filter((d) => d.isWorking)
          .map((d) => d.day.toISOString().slice(0, 10)),
      },
    };
  }
}
