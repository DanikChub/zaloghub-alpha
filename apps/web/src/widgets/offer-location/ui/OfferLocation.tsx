import { EnvironmentOutlined, ExportOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Typography } from "antd";
import type { Offer } from "../../../entities/marketplace-offer";
import "./offer-location.css";

export function OfferLocation({
  offer,
}: {
  offer: Pick<Offer, "city" | "address">;
}) {
  // The original address is often more complete than the inferred city name.
  const query = offer.address?.trim() || offer.city?.trim();
  const search = query ? new URLSearchParams({ text: query }).toString() : null;
  return (
    <Card
      className="offer-location"
      title={
        <>
          <EnvironmentOutlined /> Расположение
        </>
      }
    >
      {search ? (
        <>
          <Typography.Paragraph strong>{query}</Typography.Paragraph>
          <iframe
            key={search}
            className="offer-location__map"
            title={`Расположение на карте: ${query}`}
            src={`https://yandex.ru/map-widget/v1/?mode=search&${search}`}
            loading="lazy"
            allowFullScreen
          />
          <div className="offer-location__footer">
            <Typography.Text type="secondary">
              Поиск по месту из объявления. Результат карты и точный адрес нужно
              сверить.
            </Typography.Text>
            <Button
              href={`https://yandex.ru/maps/?${search}`}
              target="_blank"
              rel="noopener noreferrer"
              icon={<ExportOutlined />}
            >
              Открыть Яндекс Карты
            </Button>
          </div>
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Город и адрес не указаны — показать расположение пока нельзя"
        />
      )}
    </Card>
  );
}
