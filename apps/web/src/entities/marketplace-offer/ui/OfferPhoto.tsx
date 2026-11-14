import { useEffect, useState } from "react";
import { Image, Skeleton } from "antd";
import { useSelector } from "react-redux";
import { apiConfig } from "../../../shared/config/api";
import "./offer.css";
export function OfferPhoto({ id }: { id: string }) {
  const token = useSelector(
    (s: { auth: { accessToken: string | null } }) => s.auth.accessToken,
  );
  const [state, setState] = useState<{
    url?: string;
    mime?: string;
    error?: boolean;
  }>({});
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
    <video
      controls
      preload="metadata"
      src={state.url}
      className="market-photo"
      aria-label="Видео из объявления"
      style={{ maxWidth: "100%" }}
    />
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
