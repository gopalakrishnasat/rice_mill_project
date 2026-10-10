import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@rice-mill-project/shared-types';

@Controller('company')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  async getCompanyDetails() {
    const company = await this.companyService.getCompanyDetails();
    return {
      success: true,
      message: 'Company profile details retrieved successfully.',
      data: company,
    };
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async updateCompanyDetails(
    @Body() updateDto: UpdateCompanyDto,
    @Req() req: any,
  ) {
    const updated = await this.companyService.updateCompanyDetails(
      updateDto,
      req.user,
    );
    return {
      success: true,
      message: 'Mill profile and company details updated successfully.',
      data: updated,
    };
  }
}
