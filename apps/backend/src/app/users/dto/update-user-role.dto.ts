import { IsEnum, IsNotEmpty } from 'class-validator';
import { UpdateUserRoleRequestDto, UserRole } from '@rice-mill-project/shared-types';

export class UpdateUserRoleDto implements UpdateUserRoleRequestDto {
  @IsNotEmpty({ message: 'Role is required.' })
  @IsEnum(UserRole, { message: 'A valid system role must be provided.' })
  role!: UserRole;
}
