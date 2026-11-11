import type { LoanTerms } from '../core/loan/loan.types.js';
import { decimal } from '../core/money.js';

export function describeFinanceTerms(t: LoanTerms): string[] {
  const percent = (rate: string) => decimal(rate).times(100).toFixed();
  const labels = {
    PENALTY: 'пени',
    INTEREST: 'проценты',
    PRINCIPAL: 'тело займа',
    EXPENSE: 'расходы',
  };
  const result = [
    `Сумма договора: ${t.contractAmount} ₽.`,
    `Проценты: ${percent(t.interest.rate)}% в месяц на остаток тела. Делитель: ${t.interest.dailyRateDivisor === 'FIXED_30_DAYS' ? '30, фактическое число дней' : 'число дней соответствующего календарного месяца'}.`,
    `Начало начисления: ${t.schedule.accrualStartOn}. Первый платёж: ${t.schedule.firstPaymentOn}. Далее — ${t.schedule.paymentDay}-е число; возврат тела по сроку: ${t.schedule.maturityOn}.`,
    `Если дня нет в месяце: ${t.schedule.missingPaymentDay === 'LAST_DAY_OF_MONTH' ? 'последний день месяца' : 'ошибка, график требует исправления'}.`,
    `Просрочка начинается со следующего дня после срока оплаты. Перенос срока из-за выходного автоматически не применяется.`,
    `Очередность наступивших обязательств: ${t.allocation.componentOrder.map((c) => labels[c]).join(' → ')}.`,
    `Ранняя оплата процентов: ${t.allocation.earlyInterest === 'CURRENT_PERIOD' ? 'в счёт текущего процентного периода' : 'хранится отдельным остатком до решения инвестора'}.`,
    `Обычное досрочное тело: ${t.allocation.earlyPrincipal === 'BLOCKED' ? 'заблокировано, требуется отдельное согласованное закрытие' : 'разрешено после окончания установленного моратория'}.`,
    `Округление до копеек: ${{ HALF_UP: 'к ближайшему значению, точная половина — вверх', HALF_EVEN: 'к ближайшему значению, точная половина — к чётной копейке', DOWN: 'отбрасывание долей копейки' }[t.roundingMode]}.`,
    `Переплата хранится отдельно. Возврат и зачёт будущих процентов — только по явному распоряжению инвестора.`,
  ];
  if (t.principalRepaymentFromOn)
    result.push(
      `Мораторий на обычный возврат тела до ${t.principalRepaymentFromOn}. Сам входящий перевод не отменяет мораторий.`,
    );
  if (t.penalty) {
    result.push(
      `Пени: ${percent(t.penalty.dailyRate)}% в день. База: ${{ CONTRACT_AMOUNT: 'сумма договора', OUTSTANDING_PRINCIPAL: 'остаток тела', OVERDUE_BALANCE: 'просроченные тело и проценты' }[t.penalty.base]}. День оплаты ${t.penalty.paymentDay === 'INCLUDED' ? 'включён' : 'исключён при полном погашении просрочки'}.`,
    );
    if (t.penalty.increase)
      result.push(
        `Повышение пени после ${t.penalty.increase.afterMonths} календарных месяцев непогашенных процентов: ${percent(t.penalty.increase.dailyRate)}% в день, ${t.penalty.increase.retrospective ? 'с перерасчётом с начала соответствующей просрочки' : 'только с даты повышения'}.`,
      );
  }
  if (t.rateLoss)
    result.push(
      `Льгота прекращается при просрочке более ${t.rateLoss.graceWorkingDays} рабочих дней${t.rateLoss.partialPaymentTriggers ? ' или неполной оплате к сроку' : ''}. Ставка ${percent(t.rateLoss.standardRate)}% применяется с начала месяца нарушения. Рабочие дни — по сохранённым версиям федерального календаря РФ с праздниками и переносами.`,
    );
  if (t.settlement)
    result.push(
      `Согласованное закрытие во время моратория: тело + минимум ${percent(t.settlement.minimumInterestRate)}% × ${t.settlement.minimumInterestMonths} месяцев от суммы договора. Уже оплаченные проценты засчитываются; начисленные проценты сверх минимума и непогашенные пени сохраняются.`,
    );
  return result;
}
