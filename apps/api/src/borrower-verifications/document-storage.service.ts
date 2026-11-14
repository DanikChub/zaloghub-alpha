import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
export type VerificationUpload = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};
@Injectable()
export class DocumentStorageService {
  private get root() {
    return resolve(
      process.env.VERIFICATION_STORAGE_PATH ?? '.local/verification-documents',
    );
  }
  async save(file: VerificationUpload) {
    if (!file?.buffer?.length || file.buffer.length > 10 * 1024 * 1024)
      throw new BadRequestException('Загрузите файл до 10 МБ');
    const b = file.buffer;
    const mimeType =
      b.subarray(0, 5).toString() === '%PDF-'
        ? 'application/pdf'
        : b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? 'image/png'
          : b[0] === 255 && b[1] === 216 && b[2] === 255
            ? 'image/jpeg'
            : null;
    if (!mimeType || file.mimetype !== mimeType)
      throw new BadRequestException(
        'Допускаются PDF, PNG и JPEG; содержимое должно соответствовать формату',
      );
    // Control bytes and path separators must not reach download headers.
    const originalFilename = (file.originalname ?? 'document')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f/\\]/g, '_')
      .slice(0, 200);
    const storageKey = `verification-${randomUUID()}`;
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const handle = await open(join(this.root, storageKey), 'wx', 0o600);
    try {
      await handle.writeFile(b);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return {
      storageKey,
      mimeType,
      sha256: createHash('sha256').update(b).digest('hex'),
      sizeBytes: BigInt(b.length),
      originalFilename,
    };
  }
  private path(key: string) {
    if (!/^verification-[a-f0-9-]{36}$/.test(key))
      throw new NotFoundException('Файл не найден');
    return join(this.root, key);
  }
  async read(key: string) {
    try {
      return await readFile(this.path(key));
    } catch {
      throw new NotFoundException('Файл не найден');
    }
  }
  async remove(key: string) {
    await unlink(this.path(key)).catch(() => {});
  }
}
