import { baseApi } from "../../shared/api/baseApi";
export interface Offer {
  id: string;
  rawText: string;
  publishedAt: string;
  receivedAt: string;
  publicationUrl: string | null;
  contactUrl: string | null;
  objectName: string | null;
  objectType: string | null;
  address: string | null;
  city: string | null;
  borrowerType: string | null;
  loanAmount: string | null;
  collateralValue: string | null;
  interestRateMonthly: string | null;
  loanTermMonths: string | null;
  ltv: string | null;
  monthlyIncome: string | null;
  totalIncome: string | null;
  parseStatus: string;
  parseError: string | null;
  declared: Record<string, unknown>;
  inferred: Record<string, unknown>;
  source: { id: string; title: string };
  photos: { id: string }[];
  marks: { saved: boolean; hidden: boolean }[];
}
export const marketplaceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    offers: builder.query<
      { items: Offer[]; total: number; page: number; limit: number },
      Record<string, string>
    >({
      query: (params) => ({ url: "/marketplace/offers", params }),
      providesTags: ["Marketplace"],
    }),
    offer: builder.query<Offer, string>({
      query: (id) => `/marketplace/offers/${id}`,
      providesTags: ["Marketplace"],
    }),
    dictionaries: builder.query<
      {
        sources: { id: string; title: string }[];
        cities: string[];
        objectTypes: string[];
      },
      void
    >({ query: () => "/marketplace/dictionaries" }),
    markOffer: builder.mutation<
      unknown,
      { id: string; saved?: boolean; hidden?: boolean }
    >({
      query: ({ id, ...body }) => ({
        url: `/marketplace/offers/${id}/mark`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Marketplace"],
    }),
  }),
});
export const {
  useOffersQuery,
  useOfferQuery,
  useDictionariesQuery,
  useMarkOfferMutation,
} = marketplaceApi;
