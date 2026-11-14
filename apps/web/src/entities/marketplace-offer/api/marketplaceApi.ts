import { baseApi } from "../../../shared/api/baseApi";
import type { Offer, OfferPage, MarketplaceDictionaries } from "../model/types";
export const marketplaceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    offersFeed: builder.infiniteQuery<
      OfferPage,
      Record<string, string>,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (lastPage) =>
          lastPage.items.length > 0 &&
          lastPage.page * lastPage.limit < lastPage.total
            ? lastPage.page + 1
            : undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        url: "/marketplace/offers",
        params: { ...queryArg, page: pageParam },
      }),
      providesTags: ["Marketplace"],
    }),
    offers: builder.query<OfferPage, Record<string, string>>({
      query: (params) => ({ url: "/marketplace/offers", params }),
      providesTags: ["Marketplace"],
    }),
    offer: builder.query<Offer, string>({
      query: (id) => `/marketplace/offers/${id}`,
      providesTags: ["Marketplace"],
    }),
    dictionaries: builder.query<MarketplaceDictionaries, void>({
      query: () => "/marketplace/dictionaries",
    }),
  }),
});
export const {
  useOffersFeedInfiniteQuery,
  useOffersQuery,
  useOfferQuery,
  useDictionariesQuery,
} = marketplaceApi;
