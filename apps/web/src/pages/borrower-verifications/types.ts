export type RecordData = Record<string, unknown>
export interface Identity {
  id: string
  versionNo: number
  firstName: string
  lastName: string
  middleName: string | null
  hasNoMiddleName: boolean
  birthDate: string | null
  birthPlace: string | null
  passportSeries: string | null
  passportNumber: string | null
  passportIssuedOn: string | null
  passportIssuedBy: string | null
  passportDepartmentCode: string | null
  registrationAddress: RecordData | null
  residentialAddress: RecordData | null
  previousNames: RecordData[]
  previousRegions: string[]
  inn: string | null
  snils: string | null
  ogrnip: string | null
  sourceDocumentId: string | null
  confirmedAt: string
}
export interface Evidence {
  id: string
  itemId: string | null
  runId: string | null
  findingId: string | null
  documentId: string | null
  kind: string
  title: string
  sourceUrl: string | null
  issuedOn: string | null
  capturedAt: string | null
  validUntil: string | null
  authenticityStatus: string
  reviewComment: string | null
  ocrStatus: string
  ocrResult: RecordData | null
  ocrError: string | null
  document?: {
    id: string
    originalFilename: string | null
    mimeType: string
    sizeBytes: string | null
  } | null
}
export interface Finding {
  id: string
  findingType: string
  title: string
  referenceNumber: string | null
  recordStatus: string | null
  personRole: string | null
  claimAmount: string | null
  outstandingAmount: string | null
  currency: string | null
  identityMatch: string
  matchComment: string | null
  authorityName: string | null
  sourceUrl: string | null
}
export interface Risk {
  id: string
  itemId: string
  runId: string
  title: string
  description: string
  severity: string
  status: string
  requiredAction: string | null
  resolutionComment: string | null
  dueAt: string | null
  remediability: string
}
export interface CheckRun {
  id: string
  itemId: string
  identityVersionId: string
  attemptNo: number
  mode: 'MANUAL' | 'AUTOMATIC'
  status: string
  resultBoolean: boolean | null
  resultCode: string | null
  resultAmount: string | null
  currency: string | null
  summary: string | null
  riskAssessment: string
  resultData: RecordData
  coverage: RecordData
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  finishedAt: string | null
  sourceAsOfAt: string | null
  validUntil: string | null
  reviewedAt: string | null
  findings?: Finding[]
  risks?: Risk[]
  evidence?: Evidence[]
}
export interface CheckItem {
  id: string
  checkCode: string
  title: string
  sortOrder: number
  isRequired: boolean
  resultType: 'BOOLEAN' | 'CATEGORY' | 'MONEY' | 'DOCUMENT' | 'RECORD_LIST'
  status: string
  executionMode: string
  instructions: string | null
  sourceUrl: string | null
  acceptedRunId: string | null
  notApplicableReason: string | null
  resultSchema: {
    type: string
    categories: string[]
    documentRequired: boolean
  }
  acceptedRun: CheckRun | null
  runs?: CheckRun[]
}
export interface Readiness {
  itemId: string
  checkCode: string
  missingFields: string[]
  automaticAvailable: boolean
  canRunAutomatic: boolean
  manualAvailable: boolean
  canRecordManual: boolean
  reason: string | null
}
export interface VerificationSummary {
  id: string
  workspaceId: string
  partyId: string
  status: string
  overallRisk: string
  decision: string
  createdAt: string
  updatedAt: string
  party: { id: string; displayName: string; taxId: string | null }
  _count?: { items: number }
}
export interface Verification extends VerificationSummary {
  identityVersion: Identity | null
  items: CheckItem[]
  evidence: Evidence[]
  memberRole: string
  assignedToId: string | null
  decisionComment: string | null
  decisionConditions: string | null
  completedAt: string | null
  previousVerificationId: string | null
  allowedActions: {
    edit: boolean
    runChecks: boolean
    submitReview: boolean
    complete: boolean
    recheck: boolean
  }
  capabilities: { automaticChecks: string[]; ocrAvailable: boolean }
  readiness: { items: Readiness[] }
}
