import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
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
    UserRole.VIEW_ONLY_ADMIN,
  )
  async listProducts(@Query('all') all?: string) {
    const includeInactive = all === 'true' || all === '1';
    const products = await this.productsService.findAll(includeInactive);
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
    UserRole.VIEW_ONLY_ADMIN,
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createProduct(@Body() createDto: CreateProductDto) {
    const product = await this.productsService.create(createDto);
    return {
      success: true,
      message: `Product "${product.name}" created successfully.`,
      data: product,
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async updateProduct(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductDto,
  ) {
    const product = await this.productsService.update(id, updateDto);
    return {
      success: true,
      message: `Product "${product.name}" updated successfully.`,
      data: product,
    };
  }

  @Patch(':id/toggle')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async toggleProductStatus(@Param('id') id: string) {
    const product = await this.productsService.toggleStatus(id);
    return {
      success: true,
      message: `Product "${product.name}" status changed to ${product.isActive ? 'Active' : 'Inactive'}.`,
      data: product,
    };
  }
}
