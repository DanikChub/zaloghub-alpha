import type { ReactNode } from "react";
import {Card, Tag, Tooltip, Typography} from "antd";
import type { Offer } from "../model/types";
import {formatOfferDate, formatOfferNumber, getOfferLtvStatus} from "../lib/format";
import { OfferPhoto } from "./OfferPhoto";
import { OfferParameters } from "./OfferParameters";
import { useNavigate } from "react-router";
import type { MouseEvent} from "react";
import "./offer.css";

interface OfferCardProps {
  offer: Offer;
  href: string;
  actions?: ReactNode;
}
export function OfferCard({ offer, href, actions }: OfferCardProps) {

    const navigate = useNavigate();

    const onCardClick = (event: MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;

        if (
            target.closest(
                'a, button, input, select, textarea, video, .ant-image, [role="button"]',
            )
        ) {
            return;
        }

        navigate(href);
    };

    const ltvStatus = getOfferLtvStatus(offer.ltv);

  return (
      <Card
          onClick={onCardClick}
          className="market-card"
          styles={{
              body: {
                  padding: "12px 16px",
              },
          }}
          cover={
              offer.photos[0] ? (
                  <OfferPhoto id={offer.photos[0].id} />
              ) : (
                  <div className="market-photo-placeholder">Нет фотографий</div>
              )
          }
      >

          <div className="market-card-heading">
              <Typography.Title level={3} className="market-card-title">
                  {offer.objectName ?? offer.objectType ?? "Предложение без названия"}
              </Typography.Title>

              <Tooltip title={`${ltvStatus.label}. ${ltvStatus.hint}`}>
                  <Tag color={ltvStatus.color} className="offer-parameters__ltv">
                      LTV {formatOfferNumber(offer.ltv, " %")}
                  </Tag>
              </Tooltip>

              <div className="market-card-actions">
                  {actions}
              </div>
          </div>
          <Typography.Paragraph>
              {offer.city ?? "Город не определён"}
              {offer.city ? " · по адресу объявления" : ""}
          </Typography.Paragraph>
          <OfferParameters offer={offer}/>
          <div className="market-card-meta">
              <Typography.Text type="secondary">
                  {offer.source.title}
              </Typography.Text>

              <Typography.Text type="secondary" className="market-card-date">
                  {formatOfferDate(offer.publishedAt)}
              </Typography.Text>
          </div>
          {offer.parseStatus !== "PARSED" && <Tag>Неполные данные</Tag>}

      </Card>
  );
}
