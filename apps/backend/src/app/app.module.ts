import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SetupModule } from './setup/setup.module';
import { SeedModule } from './common/seed/seed.module';
import { AuditModule } from './common/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/backend/.env', '.env'],
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri:
          process.env.MONGODB_URI ||
          'mongodb://localhost:27017/rice_mill_erp',
      }),
    }),
    AuditModule,
    UsersModule,
    AuthModule,
    SetupModule,
    SeedModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
