import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { VerificationAccessService } from './verification-access.service.js';
import { VerificationAdaptersRegistry } from './verification-adapters.registry.js';
import { BorrowerVerificationsService } from './borrower-verifications.service.js';
import { VerificationIdentityService } from './verification-identity.service.js';
import { VerificationEvidenceService } from './verification-evidence.service.js';
import { DocumentStorageService } from './document-storage.service.js';
import { VerificationRiskService } from './verification-risk.service.js';
import { BorrowerCheckRunsService } from './borrower-check-runs.service.js';
import { BorrowerChecksWorker } from './borrower-checks.worker.js';
import { CHECKS } from './verification.checklist.js';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import request from 'supertest';
import * as controllers from './borrower-verifications.controllers.js';
import { VerificationSerializationInterceptor } from './verification-serialization.interceptor.js';

const connectionString = process.env.TEST_DATABASE_URL;
describe.skipIf(!connectionString)(
  'Borrower verification backend — PostgreSQL + HTTP',
  () => {
    const schema = `verification_backend_${randomUUID().replaceAll('-', '')}`;
    let admin: pg.Client,
      db: PrismaClient,
      access: VerificationAccessService,
      registry: VerificationAdaptersRegistry,
      verifications: BorrowerVerificationsService,
      identity: VerificationIdentityService,
      evidence: VerificationEvidenceService,
      risks: VerificationRiskService,
      runs: BorrowerCheckRunsService,
      worker: BorrowerChecksWorker;
    let owner: string,
      stranger: string,
      viewer: string,
      manager: string,
      workspaceId: string,
      storagePath: string,
      app: INestApplication;
    const oldStorage = process.env.VERIFICATION_STORAGE_PATH;
    const jwt = new JwtService({ secret: 'verification-test-only-secret' });
    const token = (id: string) => jwt.sign({ sub: id });
    const passport = {
      firstName: 'Иван',
      lastName: 'Иванов',
      hasNoMiddleName: true,
      birthDate: '1985-04-15',
      birthPlace: 'Москва',
      passportSeries: '4500',
      passportNumber: '123456',
      passportIssuedOn: '2005-04-15',
      passportIssuedBy: 'Отдел МВД',
      passportDepartmentCode: '770-001',
      registrationAddress: { region: 'Москва', full: 'Москва' },
      inn: '123456789012',
      snils: '12345678901',
    };
    beforeAll(async () => {
      const target = new URL(connectionString!);
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
        target.pathname != '/zaloghub_migration_test'
      )
        throw Error('Only local dedicated test database');
      admin = new pg.Client({ connectionString });
      await admin.connect();
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.query(`SET search_path TO "${schema}", public`);
      const folder = new URL('../../prisma/migrations/', import.meta.url);
      for (const dir of (await readdir(folder, { withFileTypes: true }))
        .filter((x) => x.isDirectory())
        .map((x) => x.name)
        .sort())
        await admin.query(
          await readFile(new URL(`${dir}/migration.sql`, folder), 'utf8'),
        );
      db = new PrismaClient({
        adapter: new PrismaPg(
          { connectionString, options: `-c search_path=${schema},public` },
          { schema },
        ),
      });
      const users = [];
      for (let i = 0; i < 4; i++)
        users.push(
          await db.user.create({
            data: {
              email: `${randomUUID()}@example.test`,
              passwordHash: 'test',
            },
          }),
        );
      [owner, stranger, viewer, manager] = users.map((u) => u.id);
      workspaceId = (
        await db.workspace.findUniqueOrThrow({
          where: { personalOwnerId: owner },
        })
      ).id;
      await db.workspaceMember.createMany({
        data: [
          { workspaceId, userId: viewer, role: 'VIEWER' },
          { workspaceId, userId: manager, role: 'MANAGER' },
        ],
      });
      storagePath = await mkdtemp(join(tmpdir(), 'verification-backend-'));
      process.env.VERIFICATION_STORAGE_PATH = storagePath;
      access = new VerificationAccessService(db as unknown as PrismaService);
      registry = new VerificationAdaptersRegistry();
      verifications = new BorrowerVerificationsService(access, registry);
      identity = new VerificationIdentityService(access);
      evidence = new VerificationEvidenceService(
        access,
        new DocumentStorageService(),
      );
      risks = new VerificationRiskService(access, verifications);
      runs = new BorrowerCheckRunsService(
        access,
        verifications,
        risks,
        registry,
      );
      worker = new BorrowerChecksWorker(access, runs, registry);
      const test = await Test.createTestingModule({
        controllers: Object.values(controllers),
        providers: [
          { provide: BorrowerVerificationsService, useValue: verifications },
          { provide: VerificationIdentityService, useValue: identity },
          { provide: VerificationEvidenceService, useValue: evidence },
          { provide: VerificationRiskService, useValue: risks },
          { provide: BorrowerCheckRunsService, useValue: runs },
          VerificationSerializationInterceptor,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(new JwtAuthGuard(jwt))
        .compile();
      app = test.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
    }, 30000);
    afterAll(async () => {
      await app?.close();
      await db?.$disconnect();
      if (admin) {
        await admin.query('SET search_path TO public');
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await admin.end();
      }
      if (storagePath) {
        if (
          !resolve(storagePath).startsWith(resolve(tmpdir()) + sep) ||
          !storagePath.includes('verification-backend-')
        )
          throw Error('Unsafe cleanup path');
        await rm(storagePath, { recursive: true, force: true });
      }
      if (oldStorage === undefined)
        delete process.env.VERIFICATION_STORAGE_PATH;
      else process.env.VERIFICATION_STORAGE_PATH = oldStorage;
    });
    async function fixture() {
      const row = await verifications.create(owner, {
        workspaceId,
        displayName: 'Тест',
      });
      await identity.confirm(owner, row.id, passport);
      const proof = await evidence.upload(
        owner,
        row.id,
        { kind: 'PASSPORT', title: 'Документ' },
        {
          originalname: 'passport.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\nFixture'),
          size: 16,
        },
      );
      await evidence.review(owner, row.id, proof.id, {
        status: 'CONFIRMED',
        comment: 'Проверено',
      });
      const items = await runs.listItems(owner, row.id);
      return { row, proof, items };
    }
    it('authenticates HTTP and rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/borrower-verifications')
        .expect(401);
      const response = await request(app.getHttpServer())
        .post('/borrower-verifications')
        .set('Authorization', 'Bearer ' + token(owner))
        .send({ workspaceId, displayName: 'HTTP' })
        .expect(201);
      expect(response.body.status).toBe('DRAFT');
      await request(app.getHttpServer())
        .get(`/borrower-verifications/${response.body.id}`)
        .set('Authorization', 'Bearer ' + token(stranger))
        .expect(404);
      await request(app.getHttpServer())
        .get('/borrower-verifications')
        .set('Authorization', 'Bearer ' + token(owner))
        .query({ page: '0' })
        .expect(400);
    });
    it('isolates workspaces and roles; list is paginated', async () => {
      const row = await verifications.create(owner, { workspaceId });
      expect(await runs.listItems(owner, row.id)).toHaveLength(CHECKS.length);
      await expect(verifications.getOne(stranger, row.id)).rejects.toThrow();
      expect((await verifications.getOne(viewer, row.id)).id).toBe(row.id);
      await expect(
        verifications.update(viewer, row.id, { assignedToId: owner }),
      ).rejects.toThrow();
      await expect(
        verifications.create(stranger, { workspaceId }),
      ).rejects.toThrow();
      const list = await verifications.list(owner, {
        workspaceId,
        page: '1',
        limit: '2',
      });
      expect(list.items.length).toBeLessThanOrEqual(2);
      expect(list.total).toBeGreaterThan(0);
    });
    it('never fakes unavailable auto checks or OCR', async () => {
      const { row, proof, items } = await fixture();
      const before = await db.borrowerCheckRun.count({
        where: { verificationId: row.id },
      });
      const result = await runs.bulk(owner, row.id, 'unavailable');
      expect(result.started).toHaveLength(0);
      expect(
        result.skipped.every((x) => x.code === 'INTEGRATION_NOT_CONFIGURED'),
      ).toBe(true);
      expect(
        await db.borrowerCheckRun.count({ where: { verificationId: row.id } }),
      ).toBe(before);
      await expect(
        runs.enqueue(owner, row.id, items[0].id, 'auto'),
      ).rejects.toThrow();
      await expect(
        evidence.recognize(owner, row.id, proof.id),
      ).rejects.toThrow();
    });
    it('confirms versioned identity, synchronizes the borrower, rejects malformed data', async () => {
      const { row } = await fixture();
      const versions = await identity.history(owner, row.id);
      expect(versions[0].passportNumber).toBe('123456');
      const party = await db.party.findUniqueOrThrow({
        where: { id: row.partyId },
        include: { legacyBorrower: true },
      });
      expect(party.legacyBorrower?.firstName).toBe('Иван');
      expect(party.taxId).toBe(passport.inn);
      await expect(
        identity.confirm(owner, row.id, {
          ...passport,
          birthDate: '1985-02-30',
        }),
      ).rejects.toThrow();
      await expect(
        identity.confirm(owner, row.id, {
          ...passport,
          passportNumber: '12345',
        }),
      ).rejects.toThrow();
      await identity.confirm(owner, row.id, {
        ...passport,
        passportNumber: '654321',
      });
      expect(await identity.history(owner, row.id)).toHaveLength(2);
    });
    it('validates multipart signatures, downloads privately, serializes bigint metadata', async () => {
      const row = await verifications.create(owner, { workspaceId });
      await request(app.getHttpServer())
        .post(`/borrower-verifications/${row.id}/evidence`)
        .set('Authorization', 'Bearer ' + token(owner))
        .field('kind', 'PASSPORT')
        .field('title', 'Scan')
        .attach('file', Buffer.from('<script>bad</script>'), {
          filename: 'x.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
      const upload = await request(app.getHttpServer())
        .post(`/borrower-verifications/${row.id}/evidence`)
        .set('Authorization', 'Bearer ' + token(owner))
        .field('kind', 'PASSPORT')
        .field('title', 'Scan')
        .attach('file', Buffer.from('%PDF-1.4\nDocument'), {
          filename: 'passport.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      expect(typeof upload.body.document.sizeBytes).toBe('string');
      const file = await request(app.getHttpServer())
        .get(
          `/borrower-verifications/${row.id}/evidence/${upload.body.id}/content`,
        )
        .set('Authorization', 'Bearer ' + token(owner))
        .expect(200);
      expect(file.headers['cache-control']).toContain('no-store');
      await request(app.getHttpServer())
        .get(
          `/borrower-verifications/${row.id}/evidence/${upload.body.id}/content`,
        )
        .set('Authorization', 'Bearer ' + token(stranger))
        .expect(404);
    });
    it('records real manual results idempotently, requires documents and explicit acceptance', async () => {
      const { row, proof, items } = await fixture();
      const item = items.find((i) => i.checkCode === 'PASSPORT_VALIDITY')!;
      await expect(
        runs.manual(
          owner,
          row.id,
          item.id,
          { resultBoolean: 'yes', evidenceIds: [proof.id] },
          'bad',
        ),
      ).rejects.toThrow();
      await expect(
        runs.manual(
          owner,
          row.id,
          item.id,
          { resultBoolean: true },
          'no-proof',
        ),
      ).rejects.toThrow();
      const body = { resultBoolean: true, evidenceIds: [proof.id] };
      const first = await runs.manual(
        owner,
        row.id,
        item.id,
        body,
        'manual-key',
      );
      const again = await runs.manual(
        owner,
        row.id,
        item.id,
        body,
        'manual-key',
      );
      expect(again.id).toBe(first.id);
      await expect(
        runs.manual(
          owner,
          row.id,
          item.id,
          { ...body, resultBoolean: false },
          'manual-key',
        ),
      ).rejects.toThrow();
      expect((await runs.item(owner, row.id, item.id)).status).toBe(
        'AWAITING_REVIEW',
      );
      expect((await runs.accept(owner, row.id, item.id, first.id)).status).toBe(
        'COMPLETED',
      );
      await identity.confirm(owner, row.id, {
        ...passport,
        passportNumber: '654321',
      });
      expect((await runs.item(owner, row.id, item.id)).status).toBe('STALE');
      await expect(
        runs.accept(owner, row.id, item.id, first.id),
      ).rejects.toThrow();
    });
    it('separates found records, identity review and risk remediation', async () => {
      const { row, proof, items } = await fixture();
      const item = items.find((i) => i.checkCode === 'FSSP')!;
      const run = await runs.manual(
        owner,
        row.id,
        item.id,
        {
          coverage: { regions: ['ALL'] },
          evidenceIds: [proof.id],
          findings: [
            {
              findingType: 'ENFORCEMENT',
              recordKey: 'ip-1',
              title: 'Debt',
              outstandingAmount: '1000.00',
              currency: 'RUB',
            },
          ],
        },
        'fssp',
      );
      await expect(
        runs.accept(owner, row.id, item.id, run.id),
      ).rejects.toThrow();
      const found = await runs.findings(owner, row.id, item.id, run.id);
      await runs.reviewFinding(owner, row.id, item.id, run.id, found[0].id, {
        identityMatch: 'CONFIRMED',
        matchBasis: { inn: passport.inn },
        comment: 'Совпали идентификаторы',
      });
      await runs.accept(owner, row.id, item.id, run.id);
      const list = await risks.list(owner, row.id);
      expect(list).toHaveLength(1);
      expect(list[0].status).toBe('OPEN');
      await expect(
        risks.change(owner, row.id, list[0].id, 'resolve', {
          comment: 'Погашено',
        }),
      ).rejects.toThrow();
      await risks.change(owner, row.id, list[0].id, 'resolve', {
        comment: 'Погашено, документ проверен',
        evidenceId: proof.id,
      });
      expect((await risks.list(owner, row.id))[0].status).toBe('RESOLVED');
    });
    it('does not allow links to replace mandatory document evidence', async () => {
      const { row, items } = await fixture();
      const link = await evidence.addLink(owner, row.id, {
        kind: 'OTHER',
        title: 'Ссылка',
        sourceUrl: 'https://example.test/proof',
      });
      const item = items.find((i) => i.checkCode === 'CRIMINAL_CERTIFICATE')!;
      await expect(
        runs.manual(
          owner,
          row.id,
          item.id,
          { resultCode: 'CLEAR', evidenceIds: [link.id] },
          'only-link',
        ),
      ).rejects.toThrow();
      await expect(
        evidence.addLink(owner, row.id, {
          kind: 'OTHER',
          title: 'Bad',
          sourceUrl: 'javascript:alert(1)',
        }),
      ).rejects.toThrow();
    });
    it('runs a registered adapter through queue and worker, without duplicate execution', async () => {
      const { row, items } = await fixture();
      const item = items.find((i) => i.checkCode === 'FSSP')!;
      let count = 0;
      registry.register({
        checkCode: 'FSSP',
        providerCode: 'test-only',
        version: 'v1',
        execute: async () => {
          count++;
          return { findings: [], coverage: { regions: ['ALL'] } };
        },
      });
      const run = await runs.enqueue(owner, row.id, item.id, 'queued');
      const repeat = await runs.enqueue(owner, row.id, item.id, 'queued');
      expect(repeat.id).toBe(run.id);
      await expect(
        runs.enqueue(owner, row.id, item.id, 'duplicate-active'),
      ).rejects.toThrow();
      expect(await worker.processOne()).toBe(true);
      expect(count).toBe(1);
      expect((await runs.run(owner, row.id, item.id, run.id)).status).toBe(
        'SUCCEEDED',
      );
      expect((await runs.item(owner, row.id, item.id)).status).toBe(
        'AWAITING_REVIEW',
      );
      await runs.accept(owner, row.id, item.id, run.id);
    });
    it('keeps provider failures distinct from negative results', async () => {
      const { row, items } = await fixture();
      const item = items.find((i) => i.checkCode === 'FSSP')!;
      registry.register({
        checkCode: 'FSSP',
        providerCode: 'test-only',
        version: 'v1',
        execute: async () => {
          throw Error('sensitive provider message');
        },
      });
      const run = await runs.enqueue(owner, row.id, item.id, 'failed');
      await worker.processOne();
      const result = await runs.run(owner, row.id, item.id, run.id);
      expect(result.status).toBe('FAILED');
      expect(result.resultBoolean).toBeNull();
      expect(result.riskAssessment).toBe('NOT_ASSESSED');
      expect(result.errorMessage).not.toContain('sensitive');
    });
    it('recovers expired worker leases and supports cancellation', async () => {
      const { row, items } = await fixture();
      const item = items.find((i) => i.checkCode === 'FSSP')!;
      const run = await runs.enqueue(owner, row.id, item.id, 'expired');
      await db.borrowerCheckRun.update({
        where: { id: run.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          leaseOwner: 'lost-worker',
          leaseExpiresAt: new Date(Date.now() - 1000),
        },
      });
      await worker.recoverExpired();
      expect((await runs.run(owner, row.id, item.id, run.id)).errorCode).toBe(
        'WORKER_LEASE_EXPIRED',
      );
      await runs.enqueue(owner, row.id, item.id, 'cancel');
      await verifications.cancel(owner, row.id);
      expect((await verifications.getOne(owner, row.id)).status).toBe(
        'CANCELLED',
      );
      await expect(identity.confirm(owner, row.id, passport)).rejects.toThrow();
    });
    it('does not save a late provider response after cancellation', async () => {
      const { row, items } = await fixture();
      const item = items.find((i) => i.checkCode === 'FSSP')!;
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      registry.register({
        checkCode: 'FSSP',
        providerCode: 'test-only',
        version: 'v1',
        execute: async () => {
          entered();
          await gate;
          return { findings: [], coverage: { regions: ['ALL'] } };
        },
      });
      const run = await runs.enqueue(owner, row.id, item.id, 'cancel-running');
      const processing = worker.processOne();
      await started;
      await verifications.cancel(owner, row.id);
      release();
      await processing;
      expect((await runs.run(owner, row.id, item.id, run.id)).status).toBe(
        'CANCELLED',
      );
      expect(
        (await runs.run(owner, row.id, item.id, run.id)).resultBoolean,
      ).toBeNull();
    });
    it('blocks automatic checks without confirmed input and exposes viewer read-only actions', async () => {
      const row = await verifications.create(owner, { workspaceId });
      const item = (await runs.listItems(owner, row.id)).find(
        (i) => i.checkCode === 'FSSP',
      )!;
      await expect(
        runs.enqueue(owner, row.id, item.id, 'missing-input'),
      ).rejects.toThrow();
      const readiness = await verifications.readiness(owner, row.id);
      expect(
        readiness.items.find((i) => i.itemId === item.id)?.missingFields,
      ).toContain('identity');
      const view = await verifications.getOne(viewer, row.id);
      expect(view.allowedActions.edit).toBe(false);
      expect(view.readiness.items[0].reason).toBe('READ_ONLY');
      expect(
        await db.borrowerCheckRun.count({ where: { verificationId: row.id } }),
      ).toBe(0);
    });
    it('completes the mandatory checklist, protects decisions and creates fresh rechecks', async () => {
      const { row, proof, items } = await fixture();
      await expect(
        verifications.submitForReview(owner, row.id),
      ).rejects.toThrow();
      await expect(
        runs.notApplicable(owner, row.id, items[0].id, { reason: 'skip' }),
      ).rejects.toThrow();
      for (const item of items.filter((i) => i.isRequired)) {
        const d = CHECKS.find((c) => c.code === item.checkCode)!;
        const body = {
          evidenceIds: [proof.id],
          ...(d.resultType === 'BOOLEAN'
            ? { resultBoolean: true }
            : d.resultType === 'CATEGORY'
              ? { resultCode: d.categories![0] }
              : d.resultType === 'MONEY'
                ? { resultAmount: '0.00', currency: 'RUB' }
                : { findings: [], coverage: { regions: ['ALL'] } }),
        };
        const run = await runs.manual(
          owner,
          row.id,
          item.id,
          body,
          'complete-' + item.checkCode,
        );
        await runs.accept(owner, row.id, item.id, run.id);
      }
      const submitted = await verifications.submitForReview(owner, row.id);
      expect(submitted.status).toBe('READY_FOR_REVIEW');
      const body = {
        decision: 'APPROVED',
        comment: 'Обязательные проверки завершены',
        expectedUpdatedAt: submitted.updatedAt.toISOString(),
      };
      await expect(
        verifications.complete(manager, row.id, body),
      ).rejects.toThrow();
      await verifications.update(owner, row.id, { assignedToId: owner });
      await expect(
        verifications.complete(owner, row.id, body),
      ).rejects.toThrow();
      await verifications.submitForReview(owner, row.id);
      const latest = await verifications.getOne(owner, row.id);
      expect(
        (
          await verifications.complete(owner, row.id, {
            ...body,
            expectedUpdatedAt: latest.updatedAt.toISOString(),
          })
        ).status,
      ).toBe('COMPLETED');
      await expect(
        verifications.update(owner, row.id, { assignedToId: manager }),
      ).rejects.toThrow();
      const next = await verifications.recheck(owner, row.id);
      expect(next.previousVerificationId).toBe(row.id);
      expect(
        (await runs.listItems(owner, next.id)).every(
          (i) => i.acceptedRunId === null,
        ),
      ).toBe(true);
      expect(
        await db.auditEntry.count({ where: { entityId: row.id } }),
      ).toBeGreaterThan(10);
    }, 30000);
  },
);
