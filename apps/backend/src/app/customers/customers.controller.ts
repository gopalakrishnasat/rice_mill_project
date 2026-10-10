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
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, IUser } from '@rice-mill-project/shared-types';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('next-code')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getNextCustomerCode() {
    const nextCode = await this.customersService.getNextCustomerCode();
    return {
      success: true,
      message: 'Next sequential Customer Code generated successfully.',
      data: {
        nextCustomerCode: nextCode,
      },
    };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.VIEW_ONLY_ADMIN,
  )
  async listCustomers(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('hasBalance') hasBalance?: string,
    @Query('limit') limit?: string,
  ) {
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;
    const hasBalanceBool =
      hasBalance !== undefined ? hasBalance === 'true' : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    const customers = await this.customersService.findAll({
      search,
      isActive: isActiveBool,
      hasBalance: hasBalanceBool,
      limit: limitNum,
    });

    return {
      success: true,
      message: 'Customers retrieved successfully.',
      data: customers,
    };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.VIEW_ONLY_ADMIN,
  )
  async getCustomerById(@Param('id') id: string) {
    const customer = await this.customersService.findById(id);
    return {
      success: true,
      message: 'Customer details retrieved successfully.',
      data: customer,
    };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(
    @Body() createDto: CreateCustomerDto,
    @Req() req: { user: IUser },
  ) {
    const customer = await this.customersService.create(createDto, req.user);
    return {
      success: true,
      message: `Customer "${customer.companyName}" (${customer.customerCode}) created successfully.`,
      data: customer,
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async updateCustomer(
    @Param('id') id: string,
    @Body() updateDto: UpdateCustomerDto,
    @Req() req: { user: IUser },
  ) {
    const updated = await this.customersService.update(id, updateDto, req.user);
    return {
      success: true,
      message: `Customer "${updated.companyName}" updated successfully.`,
      data: updated,
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async toggleCustomerStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: { user: IUser },
  ) {
    const updated = await this.customersService.update(
      id,
      { isActive },
      req.user,
    );
    const action = isActive ? 'activated' : 'deactivated';
    return {
      success: true,
      message: `Customer "${updated.companyName}" has been ${action} successfully.`,
      data: updated,
    };
  }
}
