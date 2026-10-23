import { UserRole, Permission } from './shared-types';

describe('Shared Types & Contracts', () => {
  it('should export UserRole with expected roles', () => {
    expect(UserRole.SUPER_ADMIN).toBe('SUPER_ADMIN');
    expect(UserRole.ADMIN).toBe('ADMIN');
    expect(UserRole.VIEW_ONLY_ADMIN).toBe('VIEW_ONLY_ADMIN');
  });

  it('should export core permissions', () => {
    expect(Permission.USER_CREATE).toBe('USER_CREATE');
    expect(Permission.INVOICE_CREATE).toBe('INVOICE_CREATE');
  });
});

