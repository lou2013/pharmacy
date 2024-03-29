import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Types } from 'mongoose';
export class MongoBaseDto {
  @ApiProperty({ example: new Types.ObjectId() })
  @Expose()
  id?: string;

  @ApiProperty({ readOnly: true })
  @Expose({ toPlainOnly: true })
  updatedBy: string;

  @ApiProperty({ readOnly: true })
  @Expose({ toPlainOnly: true })
  createdAt: Date;

  @ApiProperty({ readOnly: true })
  @Expose({ toPlainOnly: true })
  updatedAt: Date;

  @ApiProperty({ readOnly: true })
  @Expose({ toPlainOnly: true })
  deletedAt: Date;

  constructor(partial: Partial<MongoBaseDto>) {
    Object.assign(this, partial);
  }
}
