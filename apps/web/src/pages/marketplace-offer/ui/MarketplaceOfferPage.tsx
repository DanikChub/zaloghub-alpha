import { Alert, Button, Card, Collapse, Skeleton, Typography } from "antd";
import { ArrowLeftOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { Link, useParams } from "react-router";
import { AppShell } from "../../../widgets/app-shell/ui/AppShell";
import { OfferGallery } from "../../../widgets/offer-gallery";
import { OfferLocation } from "../../../widgets/offer-location";
import { OfferSummary } from "../../../widgets/offer-summary";
import { OfferActions } from "../../../features/mark-offer";
import {
  useOfferQuery,
  formatOfferDate,
  formatOfferNumber,
} from "../../../entities/marketplace-offer";
import "./marketplace-offer.css";

export function MarketplaceOfferPage() {
  const { id = "" } = useParams();
  const { data: offer, isLoading, isError, refetch } = useOfferQuery(id);
  return (
    <AppShell title="Маркетплейс">
      <div className="offer-detail">
        <Link to="/marketplace" className="offer-detail__back">
          <ArrowLeftOutlined /> К предложениям
        </Link>
        {isLoading ? (
          <Skeleton active />
        ) : isError || !offer ? (
          <Alert
            type="error"
            title="Предложение недоступно"
            action={<Button onClick={() => void refetch()}>Повторить</Button>}
          />
        ) : (
          <>
            <header className="offer-detail__heading">
              <div>
                <Typography.Title level={2}>
                  {offer.objectName ??
                    offer.objectType ??
                    "Предложение без названия"}
                </Typography.Title>
                <a
                  className="offer-detail__location-link"
                  href="#offer-location"
                >
                  <EnvironmentOutlined />{" "}
                  {offer.address || offer.city || "Расположение не указано"}
                </a>
                <Typography.Text
                  type="secondary"
                  className="offer-detail__published"
                >
                  Опубликовано {formatOfferDate(offer.publishedAt)}
                </Typography.Text>
              </div>
              <div className="offer-detail__actions">
                <OfferActions offer={offer} />
              </div>
            </header>
            {offer.parseStatus !== "PARSED" && (
              <Alert
                className="offer-detail__warning"
                showIcon
                type="warning"
                title="Не все параметры удалось определить"
                description="Сверьте условия с исходным текстом объявления ниже."
              />
            )}
            <div className="offer-detail__layout">
              <main className="offer-detail__main">
                <OfferGallery key={offer.id} photos={offer.photos} />
                <Card
                  title="Описание из объявления"
                  className="offer-detail__description"
                >
                  <Typography.Paragraph className="offer-detail__raw">
                    {offer.rawText || "В публикации нет текстового описания."}
                  </Typography.Paragraph>
                </Card>
                <section id="offer-location" className="offer-detail__location">
                  <OfferLocation offer={offer} />
                </section>
                <Card title="Расчёты и происхождение данных">
                  <dl className="offer-detail__income">
                    <div>
                      <dt>Предполагаемый доход в месяц</dt>
                      <dd>{formatOfferNumber(offer.monthlyIncome, " ₽")}</dd>
                    </div>
                    <div>
                      <dt>Предполагаемый доход за срок</dt>
                      <dd>{formatOfferNumber(offer.totalIncome, " ₽")}</dd>
                    </div>
                  </dl>
                  <Collapse
                    ghost
                    items={[
                      {
                        key: "method",
                        label: "Как получены параметры и расчёты",
                        children: (
                          <Typography.Paragraph type="secondary">
                            Стоимость залога указана автором объявления и не
                            является независимой оценкой. LTV рассчитан по этой
                            стоимости. Явно указанная годовая ставка делится на
                            12; ставка без периода остаётся неизвестной. Доход
                            рассчитан по простым процентам без комиссий и
                            погашения основного долга. Город, тип объекта и
                            остальные извлечённые параметры требуют
                            подтверждения.
                          </Typography.Paragraph>
                        ),
                      },
                    ]}
                  />
                  <Typography.Text
                    type="secondary"
                    className="offer-detail__received"
                  >
                    Получено {formatOfferDate(offer.receivedAt)} ·{" "}
                    {offer.source.title}
                  </Typography.Text>
                </Card>
              </main>
              <aside
                className="offer-detail__sidebar"
                aria-label="Условия займа и связь с брокером"
              >
                <OfferSummary offer={offer} />
              </aside>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
