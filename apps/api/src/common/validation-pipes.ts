import { ValidationPipe } from '@nestjs/common';
export const validation = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
export const partialValidation = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  skipMissingProperties: true,
});
