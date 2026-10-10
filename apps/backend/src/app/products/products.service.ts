import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(includeInactive = false): Promise<ProductDocument[]> {
    const query = includeInactive ? {} : { isActive: true };
    return this.productModel.find(query).sort({ productCode: 1 }).exec();
  }

  async findById(id: string): Promise<ProductDocument> {
    const prod = await this.productModel.findById(id).exec();
    if (!prod) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }
    return prod;
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

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    const updated = await this.productModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }
    return updated;
  }

  async toggleStatus(id: string): Promise<ProductDocument> {
    const prod = await this.findById(id);
    prod.isActive = !prod.isActive;
    return prod.save();
  }
}
