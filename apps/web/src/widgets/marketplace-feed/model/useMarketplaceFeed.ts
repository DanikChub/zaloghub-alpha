import { useEffect, useRef } from "react";
import { useOffersFeedInfiniteQuery } from "../../../entities/marketplace-offer";

export function useMarketplaceFeed(filters: Record<string, string>) {
  // Old links may contain page=N; infinite feeds always begin at page 1.
  const query = Object.fromEntries(
    Object.entries(filters).filter(([key]) => key !== "page"),
  );
  const result = useOffersFeedInfiniteQuery(query);
  const { currentData, fetchNextPage, hasNextPage, isFetching, isError } =
    result;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pages = currentData?.pages;

  useEffect(() => {
    const element = sentinelRef.current;
    if (
      !element ||
      !hasNextPage ||
      isFetching ||
      isError ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetching, isError, pages]);

  // Offset pages may overlap if a new publication arrives between requests.
  const offers = [
    ...new Map(
      pages?.flatMap((page) => page.items).map((offer) => [offer.id, offer]),
    ).values(),
  ];
  return { ...result, offers, total: pages?.[0]?.total ?? 0, sentinelRef };
}
