import { useState } from 'react'
import {
    Alert,
    Button,
    Descriptions,
    Empty,
    Select,
    Space,
    Table,
    Typography,
    message,
} from 'antd'
import {
    useGetJournalVersionsQuery,
    useGetJournalVersionQuery,
    useSaveJournalVersionMutation,
} from '../../../entities/deal/api/financeJournalApi'
import type {
    JournalAccrual,
    JournalObligation,
} from '../../../entities/deal/api/financeJournalApi'
import { date, money } from '../../../entities/deal/lib/format'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { shiftDecimal } from '../model/helpers'

const componentNames = {
    PRINCIPAL: 'Тело займа',
    INTEREST: 'Проценты',
    PENALTY: 'Пеня',
    EXPENSE: 'Расходы',
}

const penaltyBases = {
    CONTRACT_AMOUNT: 'сумма договора',
    OUTSTANDING_PRINCIPAL: 'остаток тела',
    OVERDUE_BALANCE: 'просроченная задолженность',
}

const recordedAt = (value: string) =>
    new Date(value).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
    })

export function AccrualJournal({
                                   dealId,
                                   ready,
                               }: {
    dealId: string
    ready: boolean
}) {
    const [selectedId, setSelectedId] = useState<string>()
    const [component, setComponent] = useState('ALL')
    const [notify, holder] = message.useMessage()

    const versions = useGetJournalVersionsQuery(dealId, {
        pollingInterval: 60_000,
        refetchOnFocus: true,
    })

    const versionId = selectedId ?? versions.currentData?.[0]?.id ?? ''

    const version = useGetJournalVersionQuery(
        { dealId, versionId },
        { skip: !versionId },
    )

    const [save, saving] = useSaveJournalVersionMutation()

    const saved = version.currentData
    const result = saved?.payload.result
    const terms = saved?.payload.input.terms

    const rows = (result?.accruals ?? [])
        .map((row, index) => ({
            ...row,
            rowKey: `${saved?.id}:${index}`,
        }))
        .filter((row) => component === 'ALL' || row.component === component)
        .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn))

    async function saveCurrent() {
        try {
            const response = await save({ dealId }).unwrap()
            setSelectedId(response.version.id)
            notify.success(
                response.created
                    ? 'Версия журнала сохранена'
                    : 'Этот расчёт уже сохранён',
            )
        } catch (error) {
            notify.error(
                getApiErrorMessage(error, 'Не удалось сохранить журнал'),
            )
        }
    }

    function explanation(row: JournalAccrual) {
        if (!terms) return ''

        if (row.obligationKey.startsWith('interest:minimum-settlement:')) {
            return (
                'Доплата до согласованного минимума процентов при закрытии. ' +
                'Это разовая корректировка, а не дневное начисление.'
            )
        }

        if (row.component === 'PENALTY') {
            const base = terms.penalty
                ? penaltyBases[terms.penalty.base]
                : 'база из расчёта'

            return (
                `Пеня за день. Основание базы: ${base}. ` +
                `База ${money(row.base)} × ${shiftDecimal(row.rate, 2)}% в день.`
            )
        }

        const divisor =
            terms.interest.dailyRateDivisor === 'FIXED_30_DAYS'
                ? '30'
                : String(
                    new Date(
                        Date.UTC(
                            Number(row.effectiveOn.slice(0, 4)),
                            Number(row.effectiveOn.slice(5, 7)),
                            0,
                        ),
                    ).getUTCDate(),
                )

        return (
            `Проценты за день: ${money(row.base)} × ` +
            `${shiftDecimal(row.rate, 2)}% в месяц / ${divisor}.`
        )
    }

    return (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {holder}

            <Space wrap>
                <Button
                    type="primary"
                    loading={saving.isLoading}
                    disabled={!ready}
                    onClick={saveCurrent}
                >
                    Сохранить расчёт на сегодня
                </Button>

                <Select
                    aria-label="Версия журнала"
                    style={{ width: 360, maxWidth: '100%' }}
                    placeholder="Выберите сохранённую версию"
                    loading={versions.isFetching}
                    value={versionId || undefined}
                    onChange={setSelectedId}
                    options={(versions.currentData ?? []).map((item) => ({
                        value: item.id,
                        label:
                            `На ${date(item.asOfOn)} · ` +
                            `сохранено ${recordedAt(item.recordedAt)}`,
                    }))}
                />

                <Button
                    loading={versions.isFetching}
                    onClick={() => versions.refetch()}
                >
                    Обновить список
                </Button>
            </Space>

            {versions.error && (
                <Alert
                    type="error"
                    title={getApiErrorMessage(
                        versions.error,
                        'Не удалось загрузить версии',
                    )}
                />
            )}

            {version.error && (
                <Alert
                    type="error"
                    title={getApiErrorMessage(
                        version.error,
                        'Не удалось загрузить журнал',
                    )}
                />
            )}

            {!versions.isFetching && versions.currentData?.length === 0 && (
                <Empty description="Сохранённых версий пока нет" />
            )}

            {result && (
                <>
                    <Alert
                        type="info"
                        title={`Сохранённый расчёт на ${date(result.asOfOn)}`}
                        description={
                            'Новые платежи и изменения условий не меняют эту версию. ' +
                            'Чтобы увидеть обновлённые начисления, сохраните новый расчёт.'
                        }
                    />

                    <Descriptions
                        size="small"
                        column={{ xs: 1, md: 2 }}
                        items={[
                            {
                                key: 'principal',
                                label: 'Остаток тела',
                                children: money(result.principalOutstanding),
                            },
                            {
                                key: 'interest',
                                label: 'Проценты к погашению',
                                children: money(result.interestOutstanding),
                            },
                            {
                                key: 'penalty',
                                label: 'Пеня к погашению',
                                children: money(result.penaltyOutstanding),
                            },
                            {
                                key: 'total',
                                label: 'Общий долг, включая тело',
                                children: money(result.totalOutstanding),
                            },
                        ]}
                    />

                    {result.rateLossEffectiveOn && (
                        <Alert
                            type="warning"
                            title={
                                'В расчёте применена утрата льготной ставки с ' +
                                date(result.rateLossEffectiveOn)
                            }
                        />
                    )}

                    <Select
                        aria-label="Вид начислений"
                        value={component}
                        onChange={setComponent}
                        style={{ width: 220 }}
                        options={[
                            { value: 'ALL', label: 'Все начисления' },
                            { value: 'INTEREST', label: 'Проценты' },
                            { value: 'PENALTY', label: 'Пеня' },
                        ]}
                    />

                    <Table
                        rowKey="rowKey"
                        loading={version.isFetching}
                        dataSource={rows}
                        scroll={{ x: 850 }}
                        pagination={{ pageSize: 20, showSizeChanger: true }}
                        columns={[
                            {
                                title: 'Дата',
                                dataIndex: 'effectiveOn',
                                render: (value: string) => date(value),
                            },
                            {
                                title: 'Начисление',
                                render: (_, row) =>
                                    row.obligationKey.startsWith(
                                        'interest:minimum-settlement:',
                                    )
                                        ? 'Минимум процентов при закрытии'
                                        : componentNames[row.component],
                            },
                            {
                                title: 'База',
                                dataIndex: 'base',
                                render: (value: string) => money(value),
                            },
                            {
                                title: 'Ставка',
                                render: (_, row) =>
                                    `${shiftDecimal(row.rate, 2)}% ${
                                        row.component === 'PENALTY' ? 'в день' : 'в месяц'
                                    }`,
                            },
                            {
                                title: 'Начислено',
                                dataIndex: 'amount',
                                render: (value: string) => money(value),
                            },
                        ]}
                        expandable={{
                            expandedRowRender: (row) => (
                                <Space orientation="vertical">
                                    <Typography.Text>{explanation(row)}</Typography.Text>
                                    <Typography.Text type="secondary">
                                        До округления: {row.rawAmount} ₽.
                                        Итог дня учитывает накопительное округление расчёта.
                                    </Typography.Text>
                                    <Typography.Text type="secondary">
                                        Обязательство: {row.obligationKey}
                                    </Typography.Text>
                                </Space>
                            ),
                        }}
                    />

                    <Typography.Title level={5}>
                        Обязательства и их погашение
                    </Typography.Title>

                    <Typography.Text type="secondary">
                        Здесь также могут быть будущие плановые обязательства.
                        Они не являются уже начисленным долгом.
                    </Typography.Text>

                    <Table<JournalObligation>
                        rowKey="key"
                        dataSource={result.snapshot.obligations}
                        scroll={{ x: 800 }}
                        pagination={{ pageSize: 10 }}
                        columns={[
                            {
                                title: 'Срок оплаты',
                                dataIndex: 'dueOn',
                                render: (value: string) => date(value),
                            },
                            {
                                title: 'Вид',
                                render: (_, row) => componentNames[row.component],
                            },
                            {
                                title: 'Сумма',
                                dataIndex: 'amount',
                                render: (value: string) => money(value),
                            },
                            {
                                title: 'Погашено',
                                dataIndex: 'paidAmount',
                                render: (value: string) => money(value),
                            },
                            {
                                title: 'Остаток',
                                dataIndex: 'remainingAmount',
                                render: (value: string) => money(value),
                            },
                        ]}
                        expandable={{
                            expandedRowRender: (obligation) => (
                                <Table
                                    rowKey="id"
                                    size="small"
                                    pagination={false}
                                    locale={{ emptyText: 'Распределений платежей нет' }}
                                    dataSource={result.allocations.filter(
                                        (item) => item.obligationKey === obligation.key,
                                    )}
                                    columns={[
                                        {
                                            title: 'Дата зачёта',
                                            dataIndex: 'effectiveOn',
                                            render: (value: string) => date(value),
                                        },
                                        {
                                            title: 'Платёж',
                                            dataIndex: 'paymentId',
                                        },
                                        {
                                            title: 'Зачтено',
                                            dataIndex: 'amount',
                                            render: (value: string) => money(value),
                                        },
                                    ]}
                                />
                            ),
                        }}
                    />
                </>
            )}
        </Space>
    )
}