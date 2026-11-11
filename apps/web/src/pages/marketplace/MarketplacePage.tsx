import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Image,
  Input,
  InputNumber,
  Pagination,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { Link, useParams, useSearchParams } from "react-router";
import { AppShell } from "../../widgets/app-shell/ui/AppShell";
import { useAppSelector } from "../../app/store/hooks";
import { apiConfig } from "../../shared/config/api";
import {
  useDictionariesQuery,
  useMarkOfferMutation,
  useOfferQuery,
  useOffersQuery,
  type Offer,
} from "./api";
import "./marketplace.css";
const number = (value: string | null, suffix = "") =>
  value === null
    ? "Не указано"
    : `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}${suffix}`;
const date = (value: string) => new Date(value).toLocaleString("ru-RU");
function Photo({ id }: { id: string }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const [state, setState] = useState<{ url?: string; mime?: string; error?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    fetch(`${apiConfig.baseUrl.replace(/\/$/, "")}/marketplace/photos/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, mime: blob.type });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ error: true });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, token]);
  return state.error ? (
    <div className="market-photo-placeholder">Фото недоступно</div>
  ) : state.url && state.mime?.startsWith("video/") ? (
    <video controls preload="metadata" src={state.url} className="market-photo" aria-label="Видео из объявления" style={{ maxWidth: "100%" }} />
  ) : state.url ? (
    <Image
      src={state.url}
      alt="Фотография из объявления"
      className="market-photo"
    />
  ) : (
    <Skeleton.Image active />
  );
}
function Actions({ offer }: { offer: Offer }) {
  const [mark, { isLoading, isError }] = useMarkOfferMutation();
  const value = offer.marks[0] ?? { saved: false, hidden: false };
  return (
    <>
      <Space wrap>
        <Button
          loading={isLoading}
          type={value.saved ? "primary" : "default"}
          onClick={() => void mark({ id: offer.id, saved: !value.saved })}
        >
          {value.saved ? "Сохранено" : "Сохранить"}
        </Button>
        <Button
          loading={isLoading}
          onClick={() => void mark({ id: offer.id, hidden: !value.hidden })}
        >
          {value.hidden ? "Вернуть в ленту" : "Скрыть"}
        </Button>
      </Space>
      {isError && (
        <Alert
          type="error"
          title="Не удалось сохранить отметку. Повторите действие."
        />
      )}
    </>
  );
}
function Parameters({ offer: o }: { offer: Offer }) {
  return (
    <Descriptions
      column={1}
      size="small"
      items={[
        {
          key: "amount",
          label: "Сумма займа",
          children: number(o.loanAmount, " ₽"),
        },
        {
          key: "value",
          label: "Стоимость залога из объявления",
          children: number(o.collateralValue, " ₽"),
        },
        {
          key: "rate",
          label: "Ставка в месяц",
          children: number(o.interestRateMonthly, " %"),
        },
        {
          key: "term",
          label: "Срок",
          children: number(o.loanTermMonths, " мес."),
        },
        { key: "ltv", label: "LTV (расчёт)", children: number(o.ltv, " %") },
      ]}
    />
  );
}
export function MarketplacePage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params);
  const { data, isLoading, isFetching, isError, refetch } =
    useOffersQuery(filters);
  const dictionaries = useDictionariesQuery();
  const change = (key: string, value: string | number | null | undefined) => {
    const next = new URLSearchParams(params);
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const select = (
    key: string,
    placeholder: string,
    values: { label: string; value: string }[],
  ) => (
    <Select
      aria-label={placeholder}
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      value={filters[key]}
      options={values}
      onChange={(v) => change(key, v)}
    />
  );
  return (
    <AppShell
      title="Маркетплейс"
      description="Предложения из Telegram. Данные объявлений не являются результатом проверки заёмщика или залога."
    >
      <Card className="market-filters">
        <div className="market-filter-grid">
          <Input.Search
            aria-label="Поиск предложений"
            placeholder="Адрес, объект или текст"
            defaultValue={filters.search}
            onSearch={(v) => change("search", v)}
            allowClear
          />
          {select(
            "city",
            "Город",
            (dictionaries.data?.cities ?? []).map((v) => ({
              value: v,
              label: v,
            })),
          )}
          {select(
            "objectType",
            "Тип объекта",
            (dictionaries.data?.objectTypes ?? []).map((v) => ({
              value: v,
              label: v,
            })),
          )}
          {select(
            "sourceId",
            "Источник",
            (dictionaries.data?.sources ?? []).map((v) => ({
              value: v.id,
              label: v.title,
            })),
          )}
          {select("view", "Все предложения", [
            { value: "all", label: "Все предложения" },
            { value: "saved", label: "Сохранённые" },
            { value: "hidden", label: "Скрытые" },
          ])}
          {select("borrowerType", "Тип заёмщика", [
            { value: "individual", label: "Физическое лицо" },
            { value: "self_employed", label: "Самозанятый" },
            { value: "sole_proprietor", label: "ИП" },
            { value: "company", label: "Компания" },
          ])}
          {select("sort", "Сортировка", [
            { value: "publishedAt", label: "Дата публикации" },
            { value: "loanAmount", label: "Сумма займа" },
            { value: "collateralValue", label: "Стоимость залога" },
            { value: "interestRateMonthly", label: "Ставка" },
            { value: "loanTermMonths", label: "Срок" },
            { value: "ltv", label: "LTV" },
          ])}
          {select("order", "По убыванию", [
            { value: "desc", label: "По убыванию" },
            { value: "asc", label: "По возрастанию" },
          ])}
        </div>
        <div className="market-filter-grid market-ranges">
          {(["Amount", "Value", "Rate", "Term", "Ltv"] as const).map(
            (key, i) => (
              <div key={key}>
                <Typography.Text>
                  {
                    [
                      "Сумма, ₽",
                      "Залог, ₽",
                      "Ставка, %/мес.",
                      "Срок, мес.",
                      "LTV, %",
                    ][i]
                  }
                </Typography.Text>
                <Space.Compact block>
                  {["min", "max"].map((prefix, j) => (
                    <InputNumber
                      key={prefix}
                      aria-label={`${["Сумма", "Залог", "Ставка", "Срок", "LTV"][i]} ${j === 0 ? "от" : "до"}`}
                      min={0}
                      placeholder={j === 0 ? "От" : "До"}
                      value={
                        filters[prefix + key] === undefined
                          ? null
                          : Number(filters[prefix + key])
                      }
                      onChange={(v) => change(prefix + key, v)}
                    />
                  ))}
                </Space.Compact>
              </div>
            ),
          )}
          <Button onClick={() => setParams({})}>Сбросить фильтры</Button>
        </div>
      </Card>
      {dictionaries.isError && (
        <Alert
          type="warning"
          title="Не удалось загрузить справочники"
          action={
            <Button onClick={() => void dictionaries.refetch()}>
              Повторить
            </Button>
          }
        />
      )}
      {isError ? (
        <Alert
          type="error"
          title="Не удалось загрузить предложения. Проверьте фильтры или повторите запрос."
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      ) : isLoading ? (
        <Skeleton active />
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            Найдено: {data?.total ?? 0}
            {isFetching ? " · Обновление…" : ""}
          </Typography.Paragraph>
          {!data?.items.length ? (
            <Empty description="Предложений по выбранным условиям пока нет" />
          ) : (
            <Row gutter={[16, 16]}>
              {data.items.map((offer) => (
                <Col key={offer.id} xs={24} sm={12} xl={8}>
                  <Card className="market-card">
                    {offer.photos[0] ? (
                      <Photo id={offer.photos[0].id} />
                    ) : (
                      <div className="market-photo-placeholder">
                        Нет фотографий
                      </div>
                    )}
                    <Typography.Title level={5}>
                      <Link to={`/marketplace/${offer.id}`}>
                        {offer.objectName ??
                          offer.objectType ??
                          "Предложение без названия"}
                      </Link>
                    </Typography.Title>
                    <Typography.Paragraph>
                      {offer.city ?? "Город не определён"}
                      {offer.city ? " · по адресу объявления" : ""}
                    </Typography.Paragraph>
                    <Parameters offer={offer} />
                    <Typography.Paragraph type="secondary">
                      {offer.source.title} · {date(offer.publishedAt)}
                    </Typography.Paragraph>
                    {offer.parseStatus !== "PARSED" && (
                      <Tag>Неполные данные</Tag>
                    )}
                    <Actions offer={offer} />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
          <Pagination
            className="market-pagination"
            current={data?.page ?? 1}
            total={data?.total ?? 0}
            pageSize={data?.limit ?? 12}
            showSizeChanger={false}
            onChange={(p) => change("page", p)}
            hideOnSinglePage
          />
        </>
      )}
    </AppShell>
  );
}
const safeLink = (value: string | null) =>
  value && /^https:\/\/t\.me\//i.test(value) ? value : undefined;
export function MarketplaceDetailPage() {
  const { id = "" } = useParams();
  const { data: o, isLoading, isError, refetch } = useOfferQuery(id);
  return (
    <AppShell
      title="Предложение"
      description="Исходные данные из публикации брокера"
    >
      <Link to="/marketplace">← К предложениям</Link>
      {isLoading ? (
        <Skeleton active />
      ) : isError || !o ? (
        <Alert
          type="error"
          title="Предложение недоступно"
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      ) : (
        <>
          <Typography.Title level={3}>
            {o.objectName ?? o.objectType ?? "Предложение без названия"}
          </Typography.Title>
          <Typography.Paragraph>
            {o.city ?? "Город не определён"} · {o.address ?? "Адрес не указан"}
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            {o.source.title} · Опубликовано {date(o.publishedAt)} · Получено{" "}
            {date(o.receivedAt)}
          </Typography.Paragraph>
          <Actions offer={o} />
          {o.parseStatus !== "PARSED" && (
            <Alert
              className="market-section"
              type="warning"
              title="Сообщение разобрано частично"
              description="Некоторые параметры не определены. Сверьте значения с исходным текстом."
            />
          )}
          <div className="market-gallery market-section">
            <Image.PreviewGroup>
              {o.photos.length ? (
                o.photos.map((photo) => <Photo key={photo.id} id={photo.id} />)
              ) : (
                <div className="market-photo-placeholder">Нет фотографий</div>
              )}
            </Image.PreviewGroup>
          </div>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Параметры объявления">
                <Parameters offer={o} />
                <Typography.Paragraph type="secondary">
                  Стоимость указана автором объявления и не является независимой
                  оценкой. Ставка с явно указанным годовым периодом делится на
                  12; ставка без периода остаётся неизвестной.
                </Typography.Paragraph>
                <Descriptions
                  column={1}
                  items={[
                    {
                      key: "income",
                      label: "Предполагаемый доход в месяц",
                      children: number(o.monthlyIncome, " ₽"),
                    },
                    {
                      key: "total",
                      label: "Предполагаемый доход за срок",
                      children: number(o.totalIncome, " ₽"),
                    },
                  ]}
                />
                <Typography.Paragraph type="secondary">
                  Расчёт простых процентов без комиссий и погашения основного
                  долга. LTV рассчитан по стоимости из объявления. Город и тип
                  объекта определены по тексту и требуют подтверждения.
                </Typography.Paragraph>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Публикация и контакт">
                <Space wrap>
                  {safeLink(o.publicationUrl) && (
                    <Button
                      href={safeLink(o.publicationUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Открыть публикацию
                    </Button>
                  )}
                  {safeLink(o.contactUrl) ? (
                    <Button
                      type="primary"
                      href={safeLink(o.contactUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Связаться с брокером
                    </Button>
                  ) : (
                    <Typography.Text>Контакт брокера не указан</Typography.Text>
                  )}
                </Space>
              </Card>
            </Col>
          </Row>
          <Card title="Исходный текст" className="market-section">
            <Typography.Paragraph className="market-raw">
              {o.rawText || "Сообщение без текста"}
            </Typography.Paragraph>
          </Card>
        </>
      )}
    </AppShell>
  );
}
