/**
 * Run from apps/api after npm run build.
 * Preview: node scripts/seed-finance-scenarios.mjs --email investor@example.com
 * Insert:  same command with --apply. No existing data is updated or deleted.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const allowed = new Set(['--email', '--as-of', '--apply']);
for (let i = 0; i < args.length; i++) {
  assert.ok(allowed.has(args[i]), `Unknown argument: ${args[i]}`);
  if (args[i] !== '--apply') {
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value: ${args[i]}`);
    i++;
  }
}
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const email = option('--email');
assert.ok(email, 'Pass --email with the existing investor account email');
const apply = args.includes('--apply');
const load = (path) => import(pathToFileURL(resolve('dist', path)).href);
const { calculateDealFinance, financeToday } = await load('finance/infrastructure/deal-finance.mapper.js');
const { decimal } = await load('finance/core/money.js');
const { validateLocalDate } = await load('finance/core/dates.js');
const { quoteSettlement } = await load('finance/core/loan/settlement-quote.js');
const asOf = option('--as-of') ?? financeToday();
validateLocalDate(asOf);
assert.ok(asOf <= financeToday(), 'Scenario date cannot be in the future');
const month = (offset) => {
  const d = new Date(`${asOf}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString().slice(0, 10);
};
const at = (value) => new Date(`${value}T00:00:00.000Z`);
const uuid = (key) => {
  const h = createHash('sha256').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const suite = `finance-demo-v1:${asOf}`;
const positive = (value) => decimal(value).greaterThan(0);
const zero = (value) => decimal(value).isZero();

function build(owner) {
  const plans = [];
  const make = (code, title, startOffset = -1, duration = 6) => {
    const id = uuid(`${suite}:${owner}:${code}`);
    const start = month(startOffset);
    const terms = {
      version: 1,
      contractAmount: '1000000.00',
      schedule: {
        accrualStartOn: start,
        firstPaymentOn: month(startOffset + 1),
        paymentDay: 1,
        maturityOn: month(startOffset + duration),
        missingPaymentDay: 'LAST_DAY_OF_MONTH',
      },
      interest: {
        kind: 'MONTHLY', rate: '0.03',
        accrualBase: 'OUTSTANDING_PRINCIPAL', dailyRateDivisor: 'FIXED_30_DAYS',
      },
      roundingMode: 'HALF_UP',
      allocation: {
        priority: 'DUE_FIRST', componentOrder: ['PENALTY', 'INTEREST', 'PRINCIPAL', 'EXPENSE'],
        earlyInterest: 'CURRENT_PERIOD', earlyPrincipal: 'BLOCKED', unappliedFunds: 'HOLD',
      },
      penalty: { dailyRate: '0.001', base: 'OVERDUE_BALANCE', paymentDay: 'INCLUDED' },
    };
    const plan = {
      code, title, duration, checks: [],
      deal: {
        id, financeTerms: terms, principalAmount: '1000000.00', preferentialRate: '3',
        standardRate: '4', penaltyRate: '0.1', termMonths: duration, paymentDay: 1,
        moratoriumMonths: 0, signedAt: at(start), disbursements: [], payments: [],
        financeInstructions: [],
      },
    };
    plans.push(plan);
    return plan;
  };
  const calc = (p, on = asOf) => {
    const r = calculateDealFinance(p.deal, on);
    assert.equal(r.status, 'READY', p.title);
    return r;
  };
  const issue = (p, amount = '1000000.00', on = p.deal.financeTerms.schedule.accrualStartOn) => {
    const index = p.deal.disbursements.length;
    p.deal.disbursements.push({ id: uuid(`${p.deal.id}:issue:${index}`), amount, issuedAt: at(on), createdAt: new Date(at(on).getTime() + index) });
    return p;
  };
  const pay = (p, amount, on = p.deal.financeTerms.schedule.firstPaymentOn) => {
    const index = p.deal.payments.length;
    const row = {
      id: uuid(`${p.deal.id}:payment:${index}`),
      amount: decimal(amount).toString(),
      paidAt: at(on),
      createdAt: new Date(at(on).getTime() + 100 + index),
    };
    p.deal.payments.push(row);
    return row;
  };
  const firstAmount = (p) => calc(p, p.deal.financeTerms.schedule.firstPaymentOn).snapshot.dueNow;
  const check = (p, test) => p.checks.push(test);

  let p = make('01', 'Черновик: только создана сделка', 0);
  p.deal.financeTerms = null;
  p.status = 'DRAFT';

  p = make('02', 'Условия подтверждены, выдачи ещё нет', 0);
  check(p, (r) => zero(r.disbursedTotal) && zero(r.totalOutstanding));

  p = issue(make('03', 'Деньги выданы, первый платёж ещё не наступил', 0));
  check(p, (r) => zero(r.snapshot.dueNow) && positive(r.principalOutstanding));

  p = issue(make('04', 'Один процентный платёж полностью внесён'));
  pay(p, firstAmount(p));
  check(p, (r) => positive(r.interestPaid) && zero(r.snapshot.overdueTotal));

  // Due date is last month's first day: overdue even if run on day 1.
  p = issue(make('05', 'Процентный платёж внесён частично, остаток просрочен', -2));
  pay(p, decimal(firstAmount(p)).div(2).toFixed(2));
  check(p, (r) => positive(r.interestPaid) && positive(r.snapshot.overdueTotal) && positive(r.penaltyAccrued));

  p = issue(make('06', 'Нет платежей: просрочка процентов', -2));
  check(p, (r) => zero(r.receivedTotal) && positive(r.penaltyOutstanding) && r.snapshot.daysPastDue > 0);

  p = issue(make('07', 'Нет платежей: договор закончился, просрочено и тело', -8));
  check(p, (r) => r.snapshot.obligations.some((o) => o.component === 'PRINCIPAL' && o.status === 'OVERDUE') && positive(r.penaltyAccrued));

  p = issue(make('08', 'Переплата 7350 рублей хранится отдельно'));
  pay(p, decimal(firstAmount(p)).plus('7350').toFixed(2));
  check(p, (r) => decimal(r.availableCredit).equals('7350'));

  for (const executed of [false, true]) {
    p = issue(make(executed ? '10' : '09', executed ? 'Переплата фактически возвращена' : 'Переплата зарезервирована на возврат'));
    const receipt = pay(p, decimal(firstAmount(p)).plus('7350').toFixed(2));
    const on = p.deal.financeTerms.schedule.firstPaymentOn;
    p.deal.financeInstructions.push({
      id: uuid(`${p.deal.id}:refund`), kind: 'REFUND', status: executed ? 'EXECUTED' : 'AGREED',
      effectiveOn: at(on), executedOn: executed ? at(on) : null, cancelledOn: null,
      executionReference: executed ? 'DEMO: no real bank transfer' : null,
      payload: { receiptId: receipt.id, amount: '7350.00', comment: 'DEMO' },
      createdAt: new Date(at(on).getTime() + 1000),
    });
    check(p, (r) => executed ? decimal(r.refundedTotal).equals('7350') : decimal(r.reservedCredit).equals('7350'));
  }

  p = issue(make('11', 'Платёж отменён, задолженность восстановлена', -2));
  const cancelled = pay(p, firstAmount(p));
  cancelled.voidedAt = at(asOf);
  check(p, (r) => zero(r.receivedTotal) && positive(r.snapshot.overdueTotal));

  p = issue(make('12', 'Займ полностью закрыт согласованной операцией'));
  const quote = quoteSettlement(p.deal.financeTerms, calc(p));
  pay(p, quote.additionalPaymentRequired, asOf);
  p.deal.financeInstructions.push({
    id: uuid(`${p.deal.id}:settlement`), kind: 'SETTLEMENT', status: 'EXECUTED',
    effectiveOn: at(asOf), executedOn: at(asOf), cancelledOn: null,
    executionReference: 'DEMO: settlement',
    payload: { ...quote, agreementReference: 'DEMO agreement' }, createdAt: new Date(at(asOf).getTime() + 2000),
  });
  p.status = 'CLOSED';
  check(p, (r) => r.settledOn === asOf && zero(r.totalOutstanding));

  p = make('13', 'Заём выдан двумя частями', 0);
  issue(p, '600000.00');
  issue(p, '400000.00');
  check(p, (r) => decimal(r.disbursedTotal).equals('1000000'));

  p = issue(make('14', 'Несколько последовательных платежей без просрочки', -3));
  for (const offset of [-2, -1, 0]) {
    const on = month(offset);
    pay(p, calc(p, on).snapshot.dueNow, on);
  }
  check(p, (r) => zero(r.snapshot.overdueTotal) && zero(r.penaltyAccrued) && r.payments.length === 3);

  p = issue(make('15', 'Длительная просрочка с повышенной ставкой пени', -4));
  p.deal.financeTerms.penalty.increase = { afterMonths: 1, dailyRate: '0.002', retrospective: false };
  check(p, (r) => r.accruals.some((a) => a.component === 'PENALTY' && a.rate === '0.002'));

  p = issue(make('16', 'Срок первого платежа наступает сегодня'));
  p.deal.financeTerms.schedule.firstPaymentOn = asOf;
  p.deal.financeTerms.schedule.paymentDay = Number(asOf.slice(8, 10));
  p.deal.paymentDay = Number(asOf.slice(8, 10));
  check(p, (r) => positive(r.snapshot.dueNow) && zero(r.snapshot.overdueTotal) && zero(r.penaltyAccrued));

  p = issue(make('17', 'Просрочка погашена вместе с начисленной пеней', -2));
  pay(p, calc(p).snapshot.dueNow, asOf);
  check(p, (r) => zero(r.snapshot.overdueTotal) && positive(r.penaltyPaid));

  p = issue(make('18', 'Переплата направлена в согласованный зачёт'));
  const prepaid = pay(p, decimal(firstAmount(p)).plus('7350').toFixed(2));
  const creditOn = p.deal.financeTerms.schedule.firstPaymentOn;
  p.deal.financeInstructions.push({
    id: uuid(`${p.deal.id}:credit`), kind: 'CREDIT', status: 'AGREED',
    effectiveOn: at(creditOn), executedOn: null, cancelledOn: null,
    payload: { receiptId: prepaid.id, targets: [{ obligationKey: `interest:${month(1)}`, amount: '7350.00' }], agreementReference: 'DEMO agreement' },
    createdAt: new Date(at(creditOn).getTime() + 1000),
  });
  check(p, (r) => zero(r.availableCredit) && r.allocations.some((a) => a.obligationKey === ('interest:' + month(1)) && positive(a.amount)));

  p = issue(make('19', 'Действует мораторий на досрочное погашение тела', 0));
  p.deal.financeTerms.principalRepaymentFromOn = month(3);
  check(p, (r) => decimal(r.principalOutstanding).equals('1000000') && zero(r.principalReturned));

  p = issue(make('20', 'Часть тела возвращена досрочно', 0));
  p.deal.financeTerms.allocation.earlyInterest = 'NONE';
  p.deal.financeTerms.allocation.earlyPrincipal = 'ALLOWED';
  pay(p, '100000.00', month(0));
  check(p, (r) => decimal(r.principalOutstanding).equals('900000') && decimal(r.principalReturned).equals('100000'));

  p = issue(make('21', 'Закрытие в моратории с доплатой минимальных процентов'));
  p.deal.financeTerms.principalRepaymentFromOn = month(3);
  p.deal.financeTerms.settlement = { minimumInterestRate: '0.03', minimumInterestMonths: 3 };
  const minimumQuote = quoteSettlement(p.deal.financeTerms, calc(p));
  pay(p, minimumQuote.additionalPaymentRequired, asOf);
  p.deal.financeInstructions.push({
    id: uuid(`${p.deal.id}:settlement`), kind: 'SETTLEMENT', status: 'EXECUTED',
    effectiveOn: at(asOf), executedOn: at(asOf), cancelledOn: null,
    executionReference: 'DEMO: minimum settlement',
    payload: { ...minimumQuote, agreementReference: 'DEMO minimum agreement' }, createdAt: new Date(at(asOf).getTime() + 2000),
  });
  p.status = 'CLOSED';
  check(p, (r) => zero(r.totalOutstanding) && decimal(r.interestAccrued).equals('90000') && r.accruals.some((a) => a.obligationKey.startsWith('interest:minimum-settlement:')));
  for (const plan of plans) {
    plan.status ??= 'ACTIVE';
    const r = calculateDealFinance(plan.deal, asOf);
    plan.result = r;
    for (const test of plan.checks) assert.ok(test(r), `Scenario check failed: ${plan.code} ${plan.title}`);
    if (plan.code === '01') assert.equal(r.status, 'CONFIGURATION_REQUIRED');
  }
  return plans;
}

function report(plans) {
  console.table(plans.map((p) => ({
    code: p.code, scenario: p.title, status: p.status,
    principal: p.result.principalOutstanding ?? '-',
    interestDue: p.result.interestOutstanding ?? '-',
    penaltyDue: p.result.penaltyOutstanding ?? '-',
    overdueDays: p.result.snapshot?.daysPastDue ?? '-',
    credit: p.result.availableCredit ?? '-',
  })));
}

const preview = build(email);
console.log(`DEMO suite ${suite}; checks passed: ${preview.length}`);
report(preview);
if (!apply) {
  console.log('Preview only. No database connection. Use --apply to insert.');
} else {
  assert.equal(asOf, financeToday(), '--apply supports today only, so cards match the scenario date');
  if (existsSync('.env')) process.loadEnvFile('.env');
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'This demo seeder supports local databases only');
  console.log(`Database: ${target.hostname}${target.pathname}; investor: ${email}`);
  const { PrismaService } = await load('prisma/prisma.service.js');
  const { Prisma } = await load('generated/prisma/client.js');
  const { dealInclude } = await load('deals/deal-query.js');
  const { persistFinanceJournal } = await load('finance/infrastructure/persist-finance-journal.js');
  const prisma = new PrismaService();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    assert.ok(user, 'Investor not found. Register the account first; email must match exactly.');
    const plans = build(user.id);
    const summary = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`);
      let created = 0;
      let skipped = 0;
      for (const p of plans) {
        const exists = await tx.deal.findUnique({ where: { id: p.deal.id } });
        if (exists) { skipped++; continue; }
        const borrower = await tx.borrower.create({ data: {
          userId: user.id, firstName: `Сценарий ${p.code}`, lastName: 'ДЕМО',
        } });
        const collateral = await tx.collateral.create({ data: {
          userId: user.id, type: 'APARTMENT', address: `ДЕМО — ${p.title}`,
          estimatedValue: '2500000.00',
        } });
        await tx.deal.create({ data: {
          id: p.deal.id, userId: user.id, borrowerId: borrower.id, collateralId: collateral.id,
          contractNumber: `DEMO-${asOf}-${p.code}`, contractCity: 'ДЕМО', signedAt: p.deal.signedAt,
          principalAmount: p.deal.principalAmount, preferentialRate: '3', standardRate: '4',
          moratoriumMonths: 0, termMonths: p.duration, penaltyRate: '0.1', increasedPenaltyRate: '0.2',
          paymentDay: p.deal.paymentDay, status: p.status,
          financeTerms: p.deal.financeTerms ?? Prisma.DbNull,
        } });
        for (const row of p.deal.disbursements) {
          await tx.disbursement.create({ data: { ...row, dealId: p.deal.id, comment: 'DEMO: synthetic disbursement' } });
        }
        for (const row of p.deal.payments) {
          await tx.payment.create({ data: { ...row, dealId: p.deal.id, type: 'OTHER', comment: 'DEMO: synthetic receipt' } });
        }
        for (const row of p.deal.financeInstructions) {
          await tx.financeInstruction.create({ data: {
            ...row, dealId: p.deal.id, actorId: user.id, idempotencyKey: `demo:${row.id}`,
          } });
        }
        const loaded = await tx.deal.findUniqueOrThrow({ where: { id: p.deal.id }, include: dealInclude });
        const actual = calculateDealFinance(loaded, asOf);
        assert.deepEqual(actual, p.result, `DB roundtrip mismatch: ${p.code}`);
        if (actual.status === 'READY') await persistFinanceJournal(tx, loaded, actual);
        created++;
      }
      return { created, skipped };
    }, { timeout: 120000, maxWait: 10000 });
    console.log('Committed:', summary);
  } finally {
    await prisma.$disconnect();
  }
}




