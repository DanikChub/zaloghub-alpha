
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
  );

    app.enableCors({
        origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
          .split(',').map((origin) => origin.trim()).filter(Boolean),
    })

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
