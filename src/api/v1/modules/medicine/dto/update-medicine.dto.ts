import { Expose } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { NestedShipmentDto } from '../../shipment/dto/nested-shipment.dto';
import { MedicineTypes } from '../enum/medicine-types.enum';
import { MedicineDto } from './medicine.dto';
import { PlaceDto } from './place/palce.dto';

export class UpdateMedicineDto extends MedicineDto {
  @Expose({ toPlainOnly: true })
  id: string;

  @IsOptional()
  name: string;

  @IsOptional()
  price: number;

  @IsOptional()
  type: MedicineTypes;

  @IsOptional()
  image: string;

  @IsOptional()
  count: number;

  @IsOptional()
  place: PlaceDto;

  @IsOptional()
  shipments: NestedShipmentDto[];
}
