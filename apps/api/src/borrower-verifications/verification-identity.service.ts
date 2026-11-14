import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { VerificationAccessService } from './verification-access.service.js';
import { array, date, json, object, text } from './verification.validation.js';
@Injectable()
export class VerificationIdentityService {
  constructor(private readonly access: VerificationAccessService) {}
  async get(actor: string, id: string) {
    await this.access.verification(this.access.db, actor, id);
    return this.access.db.borrowerVerification.findUniqueOrThrow({
      where: { id },
      select: {
        identityVersion: true,
        evidence: {
          where: { kind: 'PASSPORT' },
          select: {
            id: true,
            title: true,
            ocrStatus: true,
            ocrResult: true,
            ocrError: true,
          },
        },
      },
    });
  }
  async history(actor: string, id: string) {
    const row = await this.access.verification(this.access.db, actor, id);
    return this.access.db.partyIdentityVersion.findMany({
      where: { partyId: row.partyId, workspaceId: row.workspaceId },
      orderBy: { versionNo: 'desc' },
      take: 100,
    });
  }
  async confirm(actor: string, id: string, body: unknown) {
    const v = object(body, [
      'lastName',
      'firstName',
      'middleName',
      'hasNoMiddleName',
      'birthDate',
      'birthPlace',
      'passportSeries',
      'passportNumber',
      'passportIssuedOn',
      'passportIssuedBy',
      'passportDepartmentCode',
      'registrationAddress',
      'residentialAddress',
      'previousNames',
      'previousRegions',
      'inn',
      'snils',
      'ogrnip',
      'sourceDocumentId',
    ]);
    const firstName = text(v.firstName, 'firstName', true, 100)!,
      lastName = text(v.lastName, 'lastName', true, 100)!,
      middleName = text(v.middleName, 'middleName', false, 100);
    if (
      v.hasNoMiddleName !== undefined &&
      typeof v.hasNoMiddleName !== 'boolean'
    )
      throw new BadRequestException('hasNoMiddleName должен быть boolean');
    const hasNoMiddleName = v.hasNoMiddleName === true;
    if (hasNoMiddleName && middleName)
      throw new BadRequestException('Отчество отмечено как отсутствующее');
    const birthDate = date(v.birthDate, 'birthDate'),
      passportIssuedOn = date(v.passportIssuedOn, 'passportIssuedOn');
    if (
      (birthDate && birthDate > new Date()) ||
      (passportIssuedOn && passportIssuedOn > new Date()) ||
      (birthDate && passportIssuedOn && passportIssuedOn < birthDate)
    )
      throw new BadRequestException('Некорректные даты паспорта');
    const numeric = (field: string, pattern: RegExp) => {
      const x = text(v[field], field, false, 30);
      if (x && !pattern.test(x))
        throw new BadRequestException(`Некорректное поле ${field}`);
      return x;
    };
    const passportSeries = numeric('passportSeries', /^\d{4}$/),
      passportNumber = numeric('passportNumber', /^\d{6}$/),
      passportDepartmentCode = numeric(
        'passportDepartmentCode',
        /^\d{3}-\d{3}$/,
      ),
      inn = numeric('inn', /^\d{12}$/),
      snils = numeric('snils', /^\d{11}$/),
      ogrnip = numeric('ogrnip', /^\d{15}$/);
    if (Boolean(passportSeries) !== Boolean(passportNumber))
      throw new BadRequestException(
        'Серия и номер паспорта заполняются вместе',
      );
    const previousNames =
      v.previousNames === undefined
        ? []
        : array(v.previousNames, 'previousNames', 20).map((x) => {
            const n = object(x, [
              'lastName',
              'firstName',
              'middleName',
              'from',
              'to',
              'reason',
            ]);
            return {
              lastName: text(n.lastName, 'lastName', true, 100)!,
              firstName: text(n.firstName, 'firstName', true, 100)!,
              middleName: text(n.middleName, 'middleName', false, 100) ?? null,
              from: date(n.from, 'from')?.toISOString().slice(0, 10) ?? null,
              to: date(n.to, 'to')?.toISOString().slice(0, 10) ?? null,
              reason: text(n.reason, 'reason', false) ?? null,
            };
          });
    const previousRegions =
      v.previousRegions === undefined
        ? []
        : array(v.previousRegions, 'previousRegions', 30).map((x) =>
            text(x, 'region', true, 300)!,
          );
    const registrationAddress =
        v.registrationAddress == null
          ? Prisma.DbNull
          : json(v.registrationAddress),
      residentialAddress =
        v.residentialAddress == null
          ? Prisma.DbNull
          : json(v.residentialAddress);
    const sourceDocumentId = text(
      v.sourceDocumentId,
      'sourceDocumentId',
      false,
      100,
    );
    return this.access.write(actor, id, async (tx, row) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM parties WHERE id=${row.partyId} FOR UPDATE`,
      );
      if (
        sourceDocumentId &&
        !(await tx.borrowerVerificationEvidence.findFirst({
          where: {
            verificationId: id,
            workspaceId: row.workspaceId,
            documentId: sourceDocumentId,
            kind: 'PASSPORT',
          },
        }))
      )
        throw new BadRequestException(
          'Паспорт должен быть загружен в эту проверку',
        );
      const previous = await tx.partyIdentityVersion.findFirst({
        where: { partyId: row.partyId },
        orderBy: { versionNo: 'desc' },
      });
      const identity = await tx.partyIdentityVersion.create({
        data: {
          workspaceId: row.workspaceId,
          partyId: row.partyId,
          versionNo: (previous?.versionNo ?? 0) + 1,
          supersedesId: previous?.id,
          firstName,
          lastName,
          middleName,
          hasNoMiddleName,
          birthDate,
          passportIssuedOn,
          birthPlace: text(v.birthPlace, 'birthPlace', false, 500),
          passportIssuedBy: text(
            v.passportIssuedBy,
            'passportIssuedBy',
            false,
            1000,
          ),
          passportSeries,
          passportNumber,
          passportDepartmentCode,
          registrationAddress,
          residentialAddress,
          previousNames,
          previousRegions,
          inn,
          snils,
          ogrnip,
          sourceDocumentId,
          confirmedById: actor,
        },
      });
      const party = await tx.party.findUniqueOrThrow({
        where: { id: row.partyId },
      });
      let borrowerId = party.legacyBorrowerId;
      if (borrowerId)
        await tx.borrower.update({
          where: { id: borrowerId },
          data: { firstName, lastName, middleName: middleName ?? null },
        });
      else {
        const borrower = await tx.borrower.create({
          data: {
            workspaceId: row.workspaceId,
            userId: actor,
            firstName,
            lastName,
            middleName,
          },
        });
        borrowerId = borrower.id;
      }
      await tx.party.update({
        where: { id: row.partyId },
        data: {
          displayName: [lastName, firstName, middleName]
            .filter(Boolean)
            .join(' '),
          taxId: inn ?? null,
          legacyBorrowerId: borrowerId,
        },
      });
      await tx.borrowerVerification.update({
        where: { id },
        data: {
          identityVersionId: identity.id,
          status: 'IN_PROGRESS',
          overallRisk: 'NOT_ASSESSED',
        },
      });
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_IDENTITY_CONFIRMED',
        id,
        { identityVersionId: identity.id, versionNo: identity.versionNo },
      );
      return identity;
    });
  }
}
