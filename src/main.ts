import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonLogger } from './common/logger/logger';
import { GlobalValidationPipe } from './common/pipes/global-validation.pipe';
import { ErrorFilter } from './common/filters/error.filter';
import { Logger } from '@nestjs/common';
import { SerializerInterceptor } from './common/Interceptors/serializer.interceptor';
import { ConfigService } from '@nestjs/config';
import { ServerConfig } from './common/config/server.config';
import { swaggerBootstrap } from './app.swagger';
import * as helmet from 'helmet';
import { AppConfigs } from './constants/app.configs';
import { SentryConfig } from './common/config/sentry.config';
import { SentryService } from '@ntegral/nestjs-sentry';
import { ErrorService } from './api/v1/modules/error/service/error.service';

async function bootstrap(): Promise<void> {
  //app is instantiated here and then the server listens to the port which is read form config service
  // all the validation and transformation is done by the dtos and their decorators
  // also the documenteation is used thorugh decorators on controllers and dtos the documentation is generated by swagger
  // the routing logic is done by nestjs router which uses express inside and uses the controller to handle the requests and responses
  // the error filter is used to handle the errors and the error service is used to save the errors
  // the serializer interceptor is used to serialize the response and deserialize the request
  // the common files rae the files that is shared between all files
  //the shared files are modules that is shared between all moduels
  //to run the project there must be a config.yaml file in the directory /configs the format is introduced in the config-example.yaml file
  //@UseGuards(JwtAuthGuard, MakeAbilityGuard, PoliciesGuard)
  //above guards are used for authentication and authorization
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService>(ConfigService);
  app.useLogger(
    WinstonLogger(configService.get<SentryConfig>(AppConfigs.SENTRY)),
  );
  const serverConfig = configService.get<ServerConfig>(AppConfigs.SERVER);

  const errorService = app.get(ErrorService);

  app.useGlobalInterceptors(SerializerInterceptor(app));

  app.useGlobalFilters(
    new ErrorFilter(
      Logger,
      app.get<SentryService>(SentryService),
      errorService,
    ),
  );

  app.useGlobalPipes(GlobalValidationPipe);
  app.use(helmet());
  app.enableCors();
  swaggerBootstrap(app);
  await app.listen(serverConfig.port, serverConfig.host);
}
bootstrap();
