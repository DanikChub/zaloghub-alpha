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

export interface MarketplaceDictionaries {
  sources: { id: string; title: string }[];
  cities: string[];
  objectTypes: string[];
}
export interface OfferPage {
  items: Offer[];
  total: number;
  page: number;
  limit: number;
}
