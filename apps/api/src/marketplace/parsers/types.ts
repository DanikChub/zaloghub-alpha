export type UploadedDealImage = {
  filename: string;
  mimeType: string | null;
  path?: string | null;
  url?: string | null;
};

export type RawMessageImage = {
  tempPath: string;
  filename: string;
  mimeType: string | null;
};

export type RawMessage = {
  sourceType: 'telegram';
  sourceId: number;

  sourceChannelId: string | null;
  sourceTitle: string | null;

  externalMessageId: string;
  publishedAt?: string | null;
  text: string;
  url?: string | null;
  images?: RawMessageImage[];

  metadata?: Record<string, unknown>;
};

export type ParsedDealFields = {
  objectName: string | null;
  type: string | null;
  address: string | null;

  loanAmount: number | null;
  collateralValue: number | null;

  interestRateMonthly: number | null;
  interestRateMonthlySource: 'provided' | 'parsed' | 'estimated' | null;
  loanTermMonths: number | null;

  borrowerType:
    'individual' | 'self_employed' | 'sole_proprietor' | 'company' | null;

  ltv?: number | null;
  monthlyIncome?: number | null;
  totalIncome?: number | null;

  objectParams: string | null;
  contactUrl: string | null;
};
