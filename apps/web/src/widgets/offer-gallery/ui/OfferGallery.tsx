import { useState } from "react";
import { CameraOutlined } from "@ant-design/icons";
import { Carousel, Image, Typography } from "antd";
import { OfferPhoto, type Offer } from "../../../entities/marketplace-offer";
import "./offer-gallery.css";

export function OfferGallery({ photos }: { photos: Offer["photos"] }) {
  const [current, setCurrent] = useState(0);
  if (!photos.length) {
    return (
      <div className="offer-gallery offer-gallery--empty">
        <CameraOutlined />
        <Typography.Title level={4}>Фотографий пока нет</Typography.Title>
        <Typography.Text type="secondary">
          Посмотрите описание или запросите фото у брокера
        </Typography.Text>
      </div>
    );
  }
  return (
    <section className="offer-gallery" aria-label="Фотографии и видео объекта">
      <Image.PreviewGroup>
        <Carousel
          arrows={photos.length > 1}
          infinite={false}
          dots={photos.length > 1}
          afterChange={setCurrent}
        >
          {photos.map((photo) => (
            <div key={photo.id}>
              <div className="offer-gallery__slide">
                <OfferPhoto id={photo.id} />
              </div>
            </div>
          ))}
        </Carousel>
      </Image.PreviewGroup>
      <span className="offer-gallery__counter" aria-live="polite">
        {current + 1} / {photos.length}
      </span>
    </section>
  );
}
