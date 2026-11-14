import { baseApi } from "../../../shared/api/baseApi";
const markOfferApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
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
export const { useMarkOfferMutation } = markOfferApi;
