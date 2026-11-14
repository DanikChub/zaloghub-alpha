import { Button, Card, Divider, Tag, Tooltip, Typography } from "antd";
import { ExportOutlined, SendOutlined } from "@ant-design/icons";
import {
  formatOfferNumber,
  getOfferLtvStatus,
  type Offer,
} from "../../../entities/marketplace-offer";
import "./offer-summary.css";

const telegramLink = (value: string | null) =>
  value && /^https:\/\/t\.me\//i.test(value) ? value : undefined;

export function OfferSummary({ offer: o }: { offer: Offer }) {
  const ltv = getOfferLtvStatus(o.ltv);
  const contact = telegramLink(o.contactUrl);
  const publication = telegramLink(o.publicationUrl);
  return (
    <Card className="offer-summary">
      <Typography.Text type="secondary">Сумма займа</Typography.Text>
      <div className="offer-summary__amount">
        {formatOfferNumber(o.loanAmount, " ₽")}
      </div>
      <div className="offer-summary__ltv">
        <Tooltip title={`${ltv.label}. ${ltv.hint}`}>
          <Tag color={ltv.color}>LTV {formatOfferNumber(o.ltv, " %")}</Tag>
        </Tooltip>
      </div>
      <dl className="offer-summary__terms">
        <div>
          <dt>Ставка в месяц</dt>
          <dd>{formatOfferNumber(o.interestRateMonthly, " %")}</dd>
        </div>
        <div>
          <dt>Срок займа</dt>
          <dd>{formatOfferNumber(o.loanTermMonths, " мес.")}</dd>
        </div>
        <div>
          <dt>Залог по объявлению</dt>
          <dd>{formatOfferNumber(o.collateralValue, " ₽")}</dd>
        </div>
      </dl>
      <Divider />
      <div className="offer-summary__contact">
        <Typography.Text type="secondary">Источник предложения</Typography.Text>
        <Typography.Text strong>{o.source.title}</Typography.Text>
        {contact ? (
          <Button
            type="primary"
            size="large"
            block
            icon={<SendOutlined />}
            href={contact}
            target="_blank"
            rel="noopener noreferrer"
          >
            Связаться с брокером
          </Button>
        ) : (
          <Typography.Text type="secondary">
            Прямой контакт не указан. Проверьте исходную публикацию.
          </Typography.Text>
        )}
        {publication && (
          <Button
            size="large"
            block
            icon={<ExportOutlined />}
            href={publication}
            target="_blank"
            rel="noopener noreferrer"
          >
            Публикация в Telegram
          </Button>
        )}
      </div>
    </Card>
  );
}
