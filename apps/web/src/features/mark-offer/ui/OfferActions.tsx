import { Alert, Button, Space, Tooltip } from "antd";
import {
  HeartOutlined,
  HeartFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type { Offer } from "../../../entities/marketplace-offer";
import { useMarkOfferMutation } from "../api/markOfferApi";

export function OfferActions({ offer }: { offer: Offer }) {
  const [mark, { isLoading, isError }] = useMarkOfferMutation();
  const value = offer.marks[0] ?? { saved: false, hidden: false };

  const savedLabel = value.saved
      ? "Убрать из избранного"
      : "В избранное";

  const hiddenLabel = value.hidden ? "Вернуть в ленту" : "Скрыть";

  return (
      <>
        <Space onClick={(event) => event.stopPropagation()}>
          <Tooltip title={savedLabel}>
            <Button
                type="text"
                shape="circle"
                size="large"
                aria-label={savedLabel}
                aria-pressed={value.saved}
                disabled={isLoading}
                icon={
                  value.saved ? (
                      <HeartFilled style={{ color: "#eb2f96" }} />
                  ) : (
                      <HeartOutlined />
                  )
                }
                onClick={() =>
                    void mark({ id: offer.id, saved: !value.saved })
                }
            />
          </Tooltip>

          <Tooltip title={hiddenLabel}>
            <Button
                type="text"
                shape="circle"
                size="large"
                aria-label={hiddenLabel}
                aria-pressed={value.hidden}
                disabled={isLoading}
                icon={
                  value.hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
                onClick={() =>
                    void mark({ id: offer.id, hidden: !value.hidden })
                }
            />
          </Tooltip>
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