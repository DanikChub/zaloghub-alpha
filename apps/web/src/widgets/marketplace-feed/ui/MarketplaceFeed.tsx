import {
  Alert,
  Button,
  Col,
  Empty,
  Row,
  Skeleton,
  Spin,
  Typography,
} from "antd";
import { OfferCard } from "../../../entities/marketplace-offer";
import { OfferActions } from "../../../features/mark-offer";
import { useMarketplaceFeed } from "../model/useMarketplaceFeed";
import "./marketplace-feed.css";

export function MarketplaceFeed({
  filters,
}: {
  filters: Record<string, string>;
}) {
  const {
    offers,
    total,
    currentData,
    isFetching,
    isFetchingNextPage,
    isError,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
    sentinelRef,
  } = useMarketplaceFeed(filters);

  if (!currentData) {
    return isError ? (
      <Alert
        type="error"
        title="Не удалось загрузить предложения. Проверьте фильтры или повторите запрос."
        action={<Button onClick={() => void refetch()}>Повторить</Button>}
      />
    ) : (
      <Skeleton active />
    );
  }

  return (
    <>
      <Typography.Paragraph type="secondary">
        Найдено: {total} · Показано: {offers.length}
        {isFetching && !isFetchingNextPage ? " · Обновление…" : ""}
      </Typography.Paragraph>
      {!offers.length ? (
        <Empty description="Предложений по выбранным условиям пока нет" />
      ) : (
        <Row gutter={[16, 16]}>
          {offers.map((offer) => (
            <Col key={offer.id} xs={24} sm={12} xl={8}>
              <OfferCard
                offer={offer}
                href={`/marketplace/${offer.id}`}
                actions={<OfferActions offer={offer} />}
              />
            </Col>
          ))}
        </Row>
      )}
      <div
        ref={sentinelRef}
        className="market-feed-footer"
        aria-live="polite"
        aria-busy={isFetching}
      >
        {isError ? (
          <Alert
            type="error"
            title={
              isFetchNextPageError
                ? "Не удалось загрузить следующие предложения"
                : "Не удалось обновить предложения"
            }
            action={
              <Button
                disabled={isFetching}
                onClick={() =>
                  void (isFetchNextPageError ? fetchNextPage() : refetch())
                }
              >
                Повторить
              </Button>
            }
          />
        ) : isFetchingNextPage ? (
          <Spin description="Загружаем предложения…" />
        ) : hasNextPage ? (
          <Button disabled={isFetching} onClick={() => void fetchNextPage()}>
            Загрузить ещё
          </Button>
        ) : offers.length > 0 ? (
          <Typography.Text type="secondary">
            Все предложения загружены
          </Typography.Text>
        ) : null}
      </div>
    </>
  );
}
