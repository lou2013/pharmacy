import { Logger, Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from '../user/service/user.service';
import { UserModule } from '../user/user.module';
import { AuthenticationController } from './controller/authentication.controller';
import { AuthenticationService } from './service/authentication.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { PassportModule } from '@nestjs/passport';
import { SmsModule } from '../../../../shared/sms/sms.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/model/user.entity';
import { DatabaseModule } from '../../../../shared/database/database.module';
import { RedisModule } from '../../../../shared/redis/redis.module';
import { AppConfigs } from '../../../../constants/app.configs';
import { AppConfig } from '../../../../common/config/app.config';
import { AuthorizationModule } from '../authorizaation/authorization.module';
import { PresenceModule } from '../presence/presence.module';
// this service is used to authenticate the users and getting their profiles it uses passport and jwt token strategy to handle the authentication of a user
// the sms is sent through a kave negar service which sends sms to the user
// the refrsh token is handled the same way
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    UserModule,
    RedisModule,
    SmsModule,
    forwardRef(() => AuthorizationModule),
    forwardRef(() => PresenceModule),
    PassportModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<AppConfig>(AppConfigs.APP).secret,
        signOptions: {
          expiresIn: configService.get<AppConfig>(AppConfigs.APP)
            .token_expiresIn,
        },
      }),
    }),
  ],
  providers: [
    AuthenticationService,
    Logger,
    JwtStrategy,
    RefreshStrategy,
    LocalStrategy,
    UserService,
  ],
  controllers: [AuthenticationController],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
