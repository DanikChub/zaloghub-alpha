import { RussianCalendarService } from '../calendar/russian-calendar.service.js';
import { DealAccessService } from '../../deals/deal-access.service.js';
import { BorrowersService } from '../../borrowers/borrowers.service.js';
import { CollateralsService } from '../../collaterals/collaterals.service.js';
import { DealFinanceService } from './deal-finance.service.js';
import { FinanceTermsService } from './finance-terms.service.js';
import { CashOperationsService } from './cash-operations.service.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FinanceInstructionStore } from './finance-instruction.store.js';
import { CreditManagementService } from './credit-management.service.js';
import { SettlementService } from './settlement.service.js';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { LoanTerms } from '../core/loan/loan.types.js';
import { DealsService } from '../../deals/deals.service.js';
function createServices(prisma: PrismaService) {
  const access = new DealAccessService(prisma);
  const deals = new DealsService(
    prisma,
    new BorrowersService(prisma),
    new CollateralsService(prisma),
    access,
  );
  const finance = new DealFinanceService(access);
  const terms = new FinanceTermsService(
    prisma,
    access,
    new RussianCalendarService(prisma),
  );
  const cash = new CashOperationsService(access);
  const store = new FinanceInstructionStore();
  const credits = new CreditManagementService(access, store);
  const settlement = new SettlementService(access, store);
  return {
    one: access.one.bind(access),
    previewTerms: terms.preview.bind(terms),
    calendars: new RussianCalendarService(prisma),
    requestRefund: credits.requestRefund.bind(credits),
    confirmRefund: credits.confirmRefund.bind(credits),
    agreeCredit: credits.agreeCredit.bind(credits),
    quote: settlement.quote.bind(settlement),
    agreeSettlement: settlement.agree.bind(settlement),
    executeSettlement: settlement.execute.bind(settlement),
    update: deals.update.bind(deals),
    finance: finance.finance.bind(finance),
    setFinanceTerms: terms.setFinanceTerms.bind(terms),
    pay: cash.pay.bind(cash),
    disburse: cash.disburse.bind(cash),
    deletePayment: cash.deletePayment.bind(cash),
  };
}

// No .env loading and no DATABASE_URL fallback: this suite owns only a random test schema.
const connectionString = process.env.TEST_DATABASE_URL;
describe.skipIf(!connectionString)(
  'Ручные платежи: PostgreSQL + сервис + ядро',
  () => {
    const schema = `manual_finance_${randomUUID().replaceAll('-', '')}`;
    let admin: pg.Client;
    let prisma: PrismaClient;
    let service: ReturnType<typeof createServices>;
    let userId: string;
    const terms: LoanTerms = {
      version: 1,
      contractAmount: '1500000.00',
      schedule: {
        accrualStartOn: '2026-01-10',
        firstPaymentOn: '2026-01-25',
        paymentDay: 25,
        maturityOn: '2027-01-10',
        missingPaymentDay: 'LAST_DAY_OF_MONTH',
      },
      interest: {
        kind: 'MONTHLY',
        rate: '0.04',
        accrualBase: 'OUTSTANDING_PRINCIPAL',
        dailyRateDivisor: 'FIXED_30_DAYS',
      },
      roundingMode: 'HALF_UP',
      allocation: {
        priority: 'DUE_FIRST',
        componentOrder: ['PENALTY', 'INTEREST', 'PRINCIPAL', 'EXPENSE'],
        earlyInterest: 'CURRENT_PERIOD',
        earlyPrincipal: 'BLOCKED',
        unappliedFunds: 'HOLD',
      },
      penalty: {
        dailyRate: '0.005',
        base: 'OVERDUE_BALANCE',
        paymentDay: 'INCLUDED',
      },
    };

    beforeAll(async () => {
      const target = new URL(connectionString!);
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
        target.pathname !== '/zaloghub_migration_test'
      ) {
        throw new Error(
          'Only the local zaloghub_migration_test database is allowed',
        );
      }
      admin = new pg.Client({ connectionString });
      await admin.connect();
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.query(`SET search_path TO "${schema}", public`);
      const folder = new URL('../../../prisma/migrations/', import.meta.url);
      const migrations = (await readdir(folder, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      for (const migration of migrations)
        await admin.query(
          await readFile(new URL(`${migration}/migration.sql`, folder), 'utf8'),
        );
      prisma = new PrismaClient({
        adapter: new PrismaPg(
          { connectionString, options: `-c search_path=${schema},public` },
          { schema },
        ),
      });
      service = createServices(prisma as unknown as PrismaService);
      userId = (
        await prisma.user.create({
          data: { email: `${randomUUID()}@example.test`, passwordHash: 'test' },
        })
      ).id;
    }, 30000);

    afterAll(async () => {
      await prisma?.$disconnect();
      if (admin) {
        if (!/^manual_finance_[a-f0-9]{32}$/.test(schema))
          throw new Error('Unexpected test schema');
        await admin.query('SET search_path TO public');
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await admin.end();
      }
    });

    async function fixture(configured = true) {
      const deal = await prisma.deal.create({
        data: {
          userId,
          principalAmount: '1500000',
          preferentialRate: '4',
          standardRate: '7',
          moratoriumMonths: 6,
          termMonths: 12,
          penaltyRate: '0.5',
          increasedPenaltyRate: '1.5',
          paymentDay: 25,
        },
      });
      if (configured) await service.setFinanceTerms(userId, deal.id, terms);
      await service.disburse(userId, deal.id, {
        amount: '1500000.00',
        date: '2026-01-10',
      });
      return deal.id;
    }

    it('требует подтверждения условий для старой сделки', async () => {
      expect((await service.finance(userId, await fixture(false))).status).toBe(
        'CONFIGURATION_REQUIRED',
      );
    });
    it('считает недоплату и пени из реально сохранённых операций', async () => {
      const id = await fixture();
      await service.pay(userId, id, { amount: '26000.00', date: '2026-01-25' });
      const result = await service.finance(userId, id, '2026-01-28');
      expect(result.status).toBe('READY');
      if (result.status !== 'READY')
        throw new Error('Expected ready calculation');
      expect(result.penaltyAccrued).toBe('60.00');
      expect(result.snapshot.overdueTotal).toBe('4060.00');
    });
    it('повтор запроса и два параллельных запроса не создают дубль', async () => {
      const id = await fixture();
      const request = {
        amount: '26000.00',
        date: '2026-01-25',
        idempotencyKey: randomUUID(),
      };
      const [first, second] = await Promise.all([
        service.pay(userId, id, request),
        service.pay(userId, id, request),
      ]);
      expect(first.id).toBe(second.id);
      expect(await prisma.payment.count({ where: { dealId: id } })).toBe(1);
    });
    it('отклоняет другой платёж с уже использованным ключом', async () => {
      const id = await fixture();
      const request = {
        amount: '26000.00',
        date: '2026-01-25',
        idempotencyKey: randomUUID(),
      };
      await service.pay(userId, id, request);
      await expect(
        service.pay(userId, id, { ...request, amount: '27000.00' }),
      ).rejects.toThrow('Ключ запроса');
    });
    it('сохраняет отмену и пересчитывает из оставшейся истории', async () => {
      const id = await fixture();
      const payment = await service.pay(userId, id, {
        amount: '26000.00',
        date: '2026-01-25',
      });
      await service.deletePayment(userId, id, payment.id);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
          .voidedAt,
      ).not.toBeNull();
      expect((await service.one(userId, id)).payments).toHaveLength(0);
      const result = await service.finance(userId, id, '2026-01-28');
      if (result.status !== 'READY')
        throw new Error('Expected ready calculation');
      expect(result.receivedTotal).toBe('0.00');
      expect(result.penaltyAccrued).toBe('450.00');
      await service.deletePayment(userId, id, payment.id);
    });
    it('ошибка расчёта откатывает запись операции', async () => {
      const id = await fixture();
      await expect(
        service.disburse(userId, id, { amount: '0.01', date: '2026-01-11' }),
      ).rejects.toThrow('превышают');
      expect(await prisma.disbursement.count({ where: { dealId: id } })).toBe(
        1,
      );
    });
    it('платёж задним числом даёт такой же результат, как правильный порядок ввода', async () => {
      const first = await fixture(),
        second = await fixture();
      await service.pay(userId, first, {
        amount: '4060.00',
        date: '2026-01-28',
      });
      await service.pay(userId, first, {
        amount: '26000.00',
        date: '2026-01-25',
      });
      await service.pay(userId, second, {
        amount: '26000.00',
        date: '2026-01-25',
      });
      await service.pay(userId, second, {
        amount: '4060.00',
        date: '2026-01-28',
      });
      const a = await service.finance(userId, first, '2026-01-28');
      const b = await service.finance(userId, second, '2026-01-28');
      if (a.status !== 'READY' || b.status !== 'READY')
        throw new Error('Expected ready calculation');
      expect(a.totalOutstanding).toBe(b.totalOutstanding);
      expect(a.penaltyOutstanding).toBe(b.penaltyOutstanding);
      expect(a.snapshot.overdueTotal).toBe('0.00');
    });
    it('не даёт читать и менять чужую сделку', async () => {
      const id = await fixture();
      await expect(service.finance(randomUUID(), id)).rejects.toThrow(
        'Сделка не найдена',
      );
      await expect(
        service.pay(randomUUID(), id, { amount: '1.00', date: '2026-01-25' }),
      ).rejects.toThrow('Сделка не найдена');
    });
    it('не позволяет менять подтверждённые ставки через старый PATCH', async () => {
      const id = await fixture();
      await expect(
        service.update(userId, id, { preferentialRate: 5 }),
      ).rejects.toThrow('Финансовые условия');
      expect(
        (
          await prisma.deal.findUniqueOrThrow({ where: { id } })
        ).preferentialRate.toString(),
      ).toBe('4');
      const changed = await service.update(userId, id, {
        contractCity: 'Воронеж',
      });
      expect(changed.contractCity).toBe('Воронеж');
    });
    it('не сохраняет невалидные условия и их аудит при ошибке пересчёта', async () => {
      const id = await fixture();
      await expect(
        service.setFinanceTerms(userId, id, {
          ...terms,
          version: 99,
        } as unknown as LoanTerms),
      ).rejects.toThrow('версия');
      expect(
        (await prisma.deal.findUniqueOrThrow({ where: { id } })).financeTerms,
      ).toEqual(terms);
      expect(
        await prisma.auditEntry.count({
          where: { entityId: id, action: 'DEAL_FINANCE_TERMS_REPLACED' },
        }),
      ).toBe(1);
    });
    it('резервирует и подтверждает возврат переплаты без изменения тела', async () => {
      const id = await fixture();
      const payment = await service.pay(userId, id, {
        amount: '37350.00',
        date: '2026-01-20',
      });
      const request = await service.requestRefund(userId, id, {
        receiptId: payment.id,
        amount: '7350.00',
        date: '2026-01-21',
        idempotencyKey: randomUUID(),
      });
      if (request.finance.status !== 'READY') throw new Error('Not ready');
      expect(request.finance.refundedTotal).toBe('0.00');
      expect(request.finance.availableCredit).toBe('0.00');
      await service.confirmRefund(userId, id, request.id, {
        date: '2026-01-22',
        transferReference: 'bank-transfer-123',
      });
      const result = await service.finance(userId, id, '2026-01-28');
      if (result.status !== 'READY') throw new Error('Not ready');
      expect(result.refundedTotal).toBe('7350.00');
      expect(result.principalOutstanding).toBe('1500000.00');
      await service.confirmRefund(userId, id, request.id, {
        date: '2026-01-22',
        transferReference: 'bank-transfer-123',
      });
    });
    it('не позволяет запросить возврат уже распределённых денег', async () => {
      const id = await fixture();
      const payment = await service.pay(userId, id, {
        amount: '30000.00',
        date: '2026-01-20',
      });
      await expect(
        service.requestRefund(userId, id, {
          receiptId: payment.id,
          amount: '0.01',
          date: '2026-01-21',
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow('свободного остатка');
      expect(
        await prisma.financeInstruction.count({ where: { dealId: id } }),
      ).toBe(0);
    });
    it('два параллельных запроса возврата не расходуют один остаток дважды', async () => {
      const id = await fixture();
      const payment = await service.pay(userId, id, {
        amount: '37350.00',
        date: '2026-01-20',
      });
      const request = {
        receiptId: payment.id,
        amount: '7350.00',
        date: '2026-01-21',
      };
      const results = await Promise.allSettled([
        service.requestRefund(userId, id, {
          ...request,
          idempotencyKey: randomUUID(),
        }),
        service.requestRefund(userId, id, {
          ...request,
          idempotencyKey: randomUUID(),
        }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        await prisma.financeInstruction.count({ where: { dealId: id } }),
      ).toBe(1);
    });
    it('применяет согласованный зачёт к будущему периоду из исходного поступления', async () => {
      const id = await fixture();
      const payment = await service.pay(userId, id, {
        amount: '37350.00',
        date: '2026-01-20',
      });
      await service.agreeCredit(userId, id, {
        receiptId: payment.id,
        date: '2026-01-21',
        idempotencyKey: randomUUID(),
        agreementReference: 'Согласование №1',
        targets: [{ obligationKey: 'interest:2026-02-25', amount: '7350.00' }],
      });
      const r = await service.finance(userId, id, '2026-01-28');
      if (r.status !== 'READY') throw new Error('Not ready');
      expect(
        r.allocations.some(
          (a) =>
            a.paymentId === payment.id &&
            a.obligationKey === 'interest:2026-02-25' &&
            a.amount === '7350.00',
        ),
      ).toBe(true);
      expect(r.receivedTotal).toBe('37350.00');
    });
    it('согласование само не закрывает тело, исполнение требует фактических денег', async () => {
      const id = await fixture();
      await service.setFinanceTerms(userId, id, {
        ...terms,
        principalRepaymentFromOn: '2026-07-10',
        settlement: { minimumInterestRate: '0.04', minimumInterestMonths: 6 },
      });
      const quote = await service.quote(userId, id, '2026-01-20');
      expect(quote.amountToClose).toBe('1860000.00');
      const agreement = await service.agreeSettlement(userId, id, {
        date: '2026-01-20',
        quoteHash: quote.quoteHash,
        idempotencyKey: randomUUID(),
        agreementReference: 'Подписанное соглашение №2',
      });
      await expect(
        service.executeSettlement(userId, id, agreement.id, '2026-01-20'),
      ).rejects.toThrow('Недостаточно');
      expect(
        (
          await prisma.financeInstruction.findUniqueOrThrow({
            where: { id: agreement.id },
          })
        ).status,
      ).toBe('AGREED');
      await service.pay(userId, id, {
        amount: '1860000.00',
        date: '2026-01-20',
      });
      await service.executeSettlement(userId, id, agreement.id, '2026-01-20');
      const result = await service.finance(userId, id);
      if (result.status !== 'READY') throw new Error('Not ready');
      expect(result.settledOn).toBe('2026-01-20');
      expect(result.principalOutstanding).toBe('0.00');
      expect(result.interestPaid).toBe('360000.00');
      expect(result.totalOutstanding).toBe('0.00');
      expect((await service.one(userId, id)).status).toBe('CLOSED');
    });
    it('не исполняет соглашение после изменения финансовых условий', async () => {
      const id = await fixture();
      await service.setFinanceTerms(userId, id, {
        ...terms,
        principalRepaymentFromOn: '2026-07-10',
        settlement: { minimumInterestRate: '0.04', minimumInterestMonths: 6 },
      });
      const quote = await service.quote(userId, id, '2026-01-20');
      const agreement = await service.agreeSettlement(userId, id, {
        date: '2026-01-20',
        quoteHash: quote.quoteHash,
        idempotencyKey: randomUUID(),
        agreementReference: 'agreement',
      });
      await service.setFinanceTerms(userId, id, {
        ...terms,
        principalRepaymentFromOn: '2026-07-10',
        settlement: { minimumInterestRate: '0.05', minimumInterestMonths: 6 },
      });
      await expect(
        service.executeSettlement(userId, id, agreement.id, '2026-01-20'),
      ).rejects.toThrow('изменились');
    });
    it('фиксирует календарь РФ в preview и проверяет хеш условий', async () => {
      const xml = await readFile(
        new URL('../calendar/fixtures/ru-2026.xml', import.meta.url),
        'utf8',
      );
      const fetchMock = vi.fn(async () => new Response(xml));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const id = await fixture();
        const preview = await service.previewTerms(userId, id, {
          ...terms,
          rateLoss: {
            standardRate: '0.07',
            graceWorkingDays: 5,
            partialPaymentTriggers: true,
            retrospective: 'DUE_MONTH',
          },
        } as LoanTerms);
        expect(preview.terms.calendarVersionIds).toHaveLength(1);
        expect(preview.terms.rateLoss?.calendar.workingDays).not.toContain(
          '2026-01-09',
        );
        expect(preview.description.join(' ')).toContain(
          'праздниками и переносами',
        );
        await service.setFinanceTerms(
          userId,
          id,
          preview.terms,
          preview.confirmationHash,
        );
        await expect(
          service.setFinanceTerms(
            userId,
            id,
            { ...preview.terms, interest: { ...terms.interest, rate: '0.05' } },
            preview.confirmationHash,
          ),
        ).rejects.toThrow('изменились');
        await service.calendars.importYear(2026);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const version = (await service.calendars.list())[0];
        await expect(
          prisma.calendarVersion.update({
            where: { id: version.id },
            data: { contentHash: 'b'.repeat(64) },
          }),
        ).rejects.toThrow();
      } finally {
        vi.unstubAllGlobals();
      }
    });
    it('обновление источника создаёт новую версию календаря и сохраняет старую', async () => {
      const old = await service.calendars.importYear(2026);
      const xml = await readFile(
        new URL('../calendar/fixtures/ru-2026.xml', import.meta.url),
        'utf8',
      );
      const changed = xml.replace('</days>', '<day d="07.15" t="1"/></days>');
      const actualNow = Date.now;
      const clock = vi
        .spyOn(Date, 'now')
        .mockImplementation(() => actualNow() + 300001);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(changed)),
      );
      try {
        const updated = await service.calendars.importYear(2026, true);
        expect(updated.id).not.toBe(old.id);
        const pinned = await service.calendars.coverage(
          '2026-01-01',
          '2026-12-31',
          [old.id],
        );
        expect(pinned.calendar.workingDays).toContain('2026-07-15');
        const latest = await service.calendars.coverage(
          '2026-01-01',
          '2026-12-31',
          [updated.id],
        );
        expect(latest.calendar.workingDays).not.toContain('2026-07-15');
      } finally {
        clock.mockRestore();
        vi.unstubAllGlobals();
      }
    });
    it('сохраняет старые и новые условия в неизменяемом аудите', async () => {
      const id = await fixture();
      await service.setFinanceTerms(userId, id, {
        ...terms,
        interest: { ...terms.interest, rate: '0.05' },
      });
      const history = await prisma.auditEntry.findMany({
        where: { entityId: id, action: 'DEAL_FINANCE_TERMS_REPLACED' },
      });
      expect(history).toHaveLength(2);
      expect(
        history.some(
          (row) => (row.details as { before: unknown }).before !== null,
        ),
      ).toBe(true);
    });
  },
);
