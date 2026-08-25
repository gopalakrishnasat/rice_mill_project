import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@rice-mill-project/shared-types';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.STORE_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.MANAGER,
    UserRole.OPERATOR,
  )
  async listProducts() {
    const products = await this.productsService.findAll();
    return {
      success: true,
      message: 'Products catalog retrieved successfully.',
      data: products,
    };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.STORE_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.MANAGER,
  )
  async getProductById(@Param('id') id: string) {
    const product = await this.productsService.findById(id);
    return {
      success: true,
      message: 'Product retrieved successfully.',
      data: product,
    };
  }

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.STORE_MANAGER,
    UserRole.SALES_MANAGER,
  )
  @HttpCode(HttpStatus.CREATED)
  async createProduct(@Body() createDto: CreateProductDto) {
    const product = await this.productsService.create(createDto);
    return {
      success: true,
      message: `Product "${product.name}" created successfully.`,
      data: product,
    };
  }
}
