import * as mongoose from 'mongoose';
import { Gender } from '../../src/api/v1/modules/user/enum/gender.enum';

export default [
  {
    username: 'manager',
    fullName: 'manager',
    phoneNumber: '09381893855',
    password: '$2b$10$0ZIl8Fv22KG7tzzdBGtpnOpXq06zzAzkZVDIBTOzlfayVt3L4TrwK',
    createdAt: new Date(),
    updatedAt: new Date(),
    gender: Gender.MALE,
    birthDate: new Date(),
    rolesId: [new mongoose.Types.ObjectId('222222222222')],
  },
  {
    username: 'manager2',
    fullName: 'iman mgh',
    phoneNumber: '09360074042',
    password: '$2b$10$0ZIl8Fv22KG7tzzdBGtpnOpXq06zzAzkZVDIBTOzlfayVt3L4TrwK',
    createdAt: new Date(),
    updatedAt: new Date(),
    gender: Gender.MALE,
    birthDate: new Date(),
    rolesId: [new mongoose.Types.ObjectId('222222222222')],
  },
  {
    username: 'alireza',
    fullName: 'hn',
    phoneNumber: '09030746745',
    password: '$2b$10$3nGlI5hpigokCLPei1F1weE.rkQJk2EWTqQHDEeU/yiptRZZ4Cl3u',
    createdAt: new Date(),
    updatedAt: new Date(),
    gender: Gender.MALE,
    rolesId: [new mongoose.Types.ObjectId('222222222222')],
  },
];
