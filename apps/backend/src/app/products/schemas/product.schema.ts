import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProductCategory } from '@rice-mill-project/shared-types';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  timestamps: true,
  collection: 'products',
})
export class Product {
  @Prop({ type: String, required: true, unique: true, index: true, uppercase: true })
  productCode!: string; // e.g. "PROD-001"

  @Prop({ type: String, required: true, trim: true, index: true })
  name!: string; // e.g. "Murmura - 9kg Bag"

  @Prop({ type: String, enum: Object.values(ProductCategory), required: true, default: ProductCategory.RICE })
  category!: ProductCategory;

  @Prop({ type: String, required: true, default: '1006' })
  hsnCode!: string; // e.g. "1006" or "80000000"

  @Prop({ type: Number, required: true, default: 25 })
  bagWeightKg!: number;

  @Prop({ type: String, required: true, default: 'BAG' })
  unit!: string; // "BAG", "QUINTAL", "KG"

  @Prop({ type: Number, required: true, default: 0 })
  defaultRate!: number;

  @Prop({ type: Number, required: true, default: 5 })
  taxRatePercent!: number; // 5% GST on packaged rice/murmura or 0%

  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
