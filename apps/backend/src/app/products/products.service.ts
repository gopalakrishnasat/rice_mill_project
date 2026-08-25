import {
  Injectable,
  OnApplicationBootstrap,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductCategory } from '@rice-mill-project/shared-types';

@Injectable()
export class ProductsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedDefaultProducts();
  }

  async seedDefaultProducts() {
    try {
      const count = await this.productModel.countDocuments().exec();
      if (count > 0) return;

      const defaults = [
        {
          productCode: 'PROD-001',
          name: 'Murmura - 9kg Bag',
          category: ProductCategory.PACKAGED,
          hsnCode: '80000000',
          bagWeightKg: 9,
          unit: 'BAG',
          defaultRate: 490.0,
          taxRatePercent: 5,
        },
        {
          productCode: 'PROD-002',
          name: 'Sona Masoori Rice - 25kg Bag',
          category: ProductCategory.RICE,
          hsnCode: '1006',
          bagWeightKg: 25,
          unit: 'BAG',
          defaultRate: 1450.0,
          taxRatePercent: 5,
        },
        {
          productCode: 'PROD-003',
          name: 'Steam Rice Premium - 50kg Bag',
          category: ProductCategory.RICE,
          hsnCode: '1006',
          bagWeightKg: 50,
          unit: 'BAG',
          defaultRate: 2850.0,
          taxRatePercent: 5,
        },
        {
          productCode: 'PROD-004',
          name: 'Raw Rice (Kolam) - 25kg Bag',
          category: ProductCategory.RICE,
          hsnCode: '1006',
          bagWeightKg: 25,
          unit: 'BAG',
          defaultRate: 1650.0,
          taxRatePercent: 5,
        },
        {
          productCode: 'PROD-005',
          name: 'Broken Rice (Kani) - 50kg Bag',
          category: ProductCategory.BY_PRODUCT,
          hsnCode: '1006',
          bagWeightKg: 50,
          unit: 'BAG',
          defaultRate: 1150.0,
          taxRatePercent: 5,
        },
        {
          productCode: 'PROD-006',
          name: 'Rice Bran (Bhusa) - 50kg Bag',
          category: ProductCategory.BY_PRODUCT,
          hsnCode: '2302',
          bagWeightKg: 50,
          unit: 'BAG',
          defaultRate: 850.0,
          taxRatePercent: 5,
        },
      ];

      for (const item of defaults) {
        await this.productModel.create(item);
      }
      this.logger.log(`🌾 Seeded ${defaults.length} default rice mill products.`);
    } catch (err) {
      this.logger.error('Failed to seed default products', err);
    }
  }

  async findAll(): Promise<ProductDocument[]> {
    return this.productModel.find({ isActive: true }).sort({ productCode: 1 }).exec();
  }

  async findById(id: string): Promise<ProductDocument | null> {
    return this.productModel.findById(id).exec();
  }

  async create(dto: CreateProductDto): Promise<ProductDocument> {
    const count = await this.productModel.countDocuments().exec();
    const productCode =
      dto.productCode || `PROD-${String(count + 1).padStart(3, '0')}`;

    const newProd = new this.productModel({
      ...dto,
      productCode,
      isActive: true,
    });

    return newProd.save();
  }
}
