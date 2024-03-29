import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  LoggerService,
  NotImplementedException,
} from '@nestjs/common';
import { compare, genSalt, hash } from 'bcrypt';
import { UserService } from '../../user/service/user.service';
import { UserDto } from '../../user/dto/user.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginMethods } from '../enum/login-methods.enum';
import { IloginMethod } from '../interface/login-method.interface';
import { LoginBySms } from '../methods/login-by-sms';
import { LoginMethodDto } from '../dto/login-method.dto';
import { ChangePhoneNumberDto } from '../dto/change-phoneNumber.dto';
import { UpdateUserDto } from '../../user/dto/update-user.dto';
import { BadRequestException } from '@nestjs/common';
import { RedisManager } from '@liaoliaots/nestjs-redis';
import { RedisKeys } from '../enum/reids-keys.enum';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { plainToClass } from 'class-transformer';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { TokenResponseDto } from '../dto/token-response.dto';
import { RedisClients } from '../../../../../common/enums/redis.clients.enum';
import { JwtPayloadDto } from '../dto/jwt-payload.dto';
import { changePhoneNumberStep } from '../enum/change-phone-number-step.enum';
import { SmsService } from '../../../../../shared/sms/service/sms.service';
import { FilterOptionDto } from '../../../../../common/dto/filter-option.dto';
import { AppConfig } from '../../../../../common/config/app.config';
import { AppConfigs } from '../../../../../constants/app.configs';
import { VerifyLookupDto } from '../../../../../shared/sms/dto/verify-lookup.dto';
import { FilterOperationEnum } from 'src/common/enums/filter-operation.enum';
import { Ability } from '@casl/ability';
import { ProfileDto } from '../dto/profile.dto';
import { Resource } from 'src/common/enums/resource.enum';
import { Action } from 'src/common/enums/action.enum';
import { NestedUserDto } from '../../user/dto/user-nested.dto';
import { PresenceService } from '../../presence/service/presence.service';

// all the logic of loggin is used handled in this service the login method takes the user and  creates the tokens for it and return it other methods handle finding the user thorugh passowrd or sms
// the profile method is used to get the profile of the user and its abilitied also his last presence

@Injectable()
export class AuthenticationService {
  constructor(
    @Inject(Logger)
    protected readonly logger: LoggerService,
    protected readonly userService: UserService,
    readonly redisService: RedisManager,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
    protected jwtService: JwtService,
    private readonly presenceService: PresenceService,
  ) {
    this.loginMethods = {
      sms: undefined,
      token: undefined,
    };
    this.loginMethods[LoginMethods.SMS] = new LoginBySms(
      userService,
      smsService,
      configService,
    );

    this.redisClient = redisService.getClient(RedisClients.MAIN);
  }

  private redisClient: Redis;

  private loginMethods: Record<LoginMethods, IloginMethod>;

  async validateUserWithPassword(
    phoneNumber: string,
    password: string,
  ): Promise<UserDto> {
    const user = await this.userService.findOne([
      new FilterOptionDto({
        field: 'phoneNumber',
        operation: FilterOperationEnum.EQ,
        value: phoneNumber,
      }),
    ]);

    if (user && user.password && (await compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: UserDto): Promise<LoginResponseDto> {
    if (!user) return;
    const payload: JwtPayloadDto = {
      phoneNumber: user.phoneNumber,
      sub: user.id,
    };

    const refreshExpiresIn = this.configService.get<AppConfig>(
      AppConfigs.APP,
    ).refresh_expiresIn;
    const refreshExpiresInSc = this.configService.get<AppConfig>(
      AppConfigs.APP,
    ).refresh_expiresIn_sc;

    const result = {
      accessToken: this.jwtService.sign(payload),
      refreshToken: jwt.sign(
        payload,
        this.configService.get<AppConfig>(AppConfigs.APP).refresh_secret,
        {
          expiresIn: refreshExpiresIn,
        },
      ),
      user,
    };

    await this.redisClient.set(
      `authentication:${user.phoneNumber}:${RedisKeys.REFRESH}`,
      result.refreshToken,
      'EX',
      refreshExpiresInSc,
    );
    return result;
  }

  async loginByMethod(
    loginMethodDto: LoginMethodDto,
  ): Promise<LoginResponseDto> {
    if (!this.loginMethods[loginMethodDto.method])
      throw new NotImplementedException();
    const response = await this.loginMethods[loginMethodDto.method].login(
      loginMethodDto,
    );

    if ((response as TokenResponseDto).validateToken)
      return { validateToken: (response as TokenResponseDto).validateToken };
    return this.login(response.user as UserDto);
  }

  async refresh(
    refresh_token: string,
    user: UserDto,
  ): Promise<LoginResponseDto> {
    if (
      refresh_token ===
      (await this.redisClient.get(
        `authentication:${user.phoneNumber}:${RedisKeys.REFRESH}`,
      ))
    )
      return this.login(user);
    throw new BadRequestException('invalid token');
  }

  async changePhoneNumber(
    changePhoneNumberDto: ChangePhoneNumberDto,
    user: UserDto,
  ): Promise<LoginResponseDto> {
    const { phoneNumber, id } = user;
    const { code, validateToken, step } = changePhoneNumberDto;

    if (code && validateToken) {
      if (step === changePhoneNumberStep.NEW) {
        const { isEqual, phoneNumber: newPhoneNumber } = await this._checkToken(
          code,
          validateToken,
        );

        if (isEqual) {
          this._delRedis(newPhoneNumber);

          return {
            user: await this.userService.update(
              [
                new FilterOptionDto({
                  field: '_id',
                  operation: FilterOperationEnum.EQ,
                  value: id,
                }),
              ],
              new UpdateUserDto({
                phoneNumber: newPhoneNumber,
              }),
              user,
              { new: true },
            ),
          };
        }
        throw new BadRequestException();
      }

      if (step === changePhoneNumberStep.OLD) {
        const { isEqual, phoneNumber: newPhoneNumber } = await this._checkToken(
          code,
          validateToken,
        );

        if (isEqual) {
          let user;
          try {
            user = await this.userService._findOne({
              phoneNumber: newPhoneNumber,
            });
          } catch (error) {
            user = null;
          }

          if (user)
            throw new ConflictException(
              'user with new phoneNumber already exists in the system',
            );

          this._delRedis(phoneNumber);

          const password = await this._sendCode(newPhoneNumber);

          const codeToken = await this._tokenGenerator(
            password,
            newPhoneNumber,
          );

          return { validateToken: codeToken };
        }
        throw new BadRequestException();
      }
    }

    if (!changePhoneNumberDto.newPhoneNumber)
      throw new BadRequestException('invalid inputs');

    const password = await this._sendCode(phoneNumber);

    const codeToken = await this._tokenGenerator(
      password,
      changePhoneNumberDto.newPhoneNumber,
    );

    return { validateToken: codeToken };
  }

  async changePassword(
    changePasswordDto: ChangePasswordDto,
    user: UserDto,
  ): Promise<UserDto> {
    if (
      user.password &&
      (!changePasswordDto.oldPassword ||
        !(await compare(changePasswordDto.oldPassword, user.password)))
    )
      throw new BadRequestException('old password is invalid');

    const updateUserDto = new UpdateUserDto({
      password: changePasswordDto.newPassword,
    });
    return await this.userService.update(
      [
        new FilterOptionDto({
          field: '_id',
          operation: FilterOperationEnum.EQ,
          value: user.id,
        }),
      ],
      updateUserDto,
      user,
    );
  }

  async profile(user: UserDto, ability: Ability): Promise<ProfileDto> {
    const result: Record<Resource, Record<Action, boolean>> = {} as Record<
      Resource,
      Record<Action, boolean>
    >;

    for (const resource of Object.values(Resource)) {
      if (resource === Resource.ALL) continue;

      result[resource] = {} as any;
      for (const action of Object.values(Action)) {
        result[resource][action] = ability.can(action, resource);
      }
    }
    let lastPresence;
    try {
      lastPresence = await this.presenceService.findOne(
        [
          {
            field: 'userId',
            operation: FilterOperationEnum.EQ,
            value: user.id,
          },
          {
            field: 'date',
            operation: FilterOperationEnum.GTE,
            value: new Date().toLocaleDateString('fa-IR'),
          },
        ],
        { options: { sort: { date: -1 } } },
      );
    } catch (error) {
      lastPresence = null;
    }
    return new ProfileDto({
      abilities: result,
      user: user as NestedUserDto,
      lastPresence,
    });
  }

  private async _sendCode(phoneNumber: string): Promise<string> {
    const generatedCode = (Math.floor(Math.random() * 9000) + 1000).toString();
    return (
      await this.smsService.verifyLookup(
        plainToClass(VerifyLookupDto, {
          receptor: phoneNumber,
          password: generatedCode,
        }),
      )
    ).data.password;
  }

  private async _delRedis(phoneNumber: string): Promise<void> {
    await this.smsService.verifyLookup(
      plainToClass(VerifyLookupDto, {
        receptor: phoneNumber,
        forceDelete: true,
      }),
    );
  }

  private async _tokenGenerator(
    code: string,
    phoneNumber?: string,
  ): Promise<string> {
    const salt = await genSalt(10);
    const token = await hash(code, salt);
    return this.jwtService.sign({ token, phoneNumber });
  }

  private async _checkToken(code: string, token: string): Promise<any> {
    const decodedToken = await this.jwtService.verify(token);

    const isEqual = await compare(code, decodedToken.token);
    return { isEqual, ...decodedToken };
  }
}
