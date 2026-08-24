import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './app/common/filters/http-exception.filter';
import { TransformInterceptor } from './app/common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('RiceMillBackend');

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Enable CORS for frontend integration
  app.enableCors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe with transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Global exception filter for standardized error formatting
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global response transformer for standardized API envelopes
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🌾 Rice Mill Management API running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
