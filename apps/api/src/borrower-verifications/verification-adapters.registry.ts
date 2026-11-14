import { Injectable } from '@nestjs/common';
import type {
  BorrowerCheckRun,
  PartyIdentityVersion,
  Prisma,
} from '../generated/prisma/client.js';
import type { ResultInput } from './verification-results.js';
export type CheckInput = { identity: PartyIdentityVersion; checkCode: string };
export type AdapterResult = ResultInput & {
  rawResponse?: Buffer;
  rawMimeType?: string;
};
export interface BorrowerCheckAdapter {
  readonly checkCode: string;
  readonly providerCode: string;
  readonly version: string;
  execute(input: Prisma.JsonObject, signal: AbortSignal): Promise<unknown>;
}
export interface IdentityOcrAdapter {
  readonly version: string;
  recognize(
    content: Buffer,
    mimeType: string,
    signal: AbortSignal,
  ): Promise<Prisma.InputJsonObject>;
}
@Injectable()
export class VerificationAdaptersRegistry {
  private readonly adapters = new Map<string, BorrowerCheckAdapter>();
  // No production adapters are registered until a real provider is configured.
  register(adapter: BorrowerCheckAdapter) {
    this.adapters.set(adapter.checkCode, adapter);
  }
  get(code: string) {
    return this.adapters.get(code);
  }
  supports(code: string) {
    return this.adapters.has(code);
  }
  forRun(run: BorrowerCheckRun) {
    const a = this.get(
      (run.inputSnapshot as Prisma.JsonObject).checkCode as string,
    );
    return a?.version === run.adapterVersion &&
      a.providerCode === run.providerCode
      ? a
      : undefined;
  }
  capabilities() {
    return {
      automaticChecks: [...this.adapters.keys()],
      ocrAvailable: false,
    };
  }
}
