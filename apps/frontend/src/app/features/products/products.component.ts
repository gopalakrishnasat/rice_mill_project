import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  IProduct,
  ProductCategory,
  CreateProductDto,
  UpdateProductDto,
  UserRole,
} from '@rice-mill-project/shared-types';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],
})
export class ProductsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);

  readonly ProductCategory = ProductCategory;

  // State Signals
  readonly products = signal<IProduct[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly searchTerm = signal<string>('');
  readonly selectedCategory = signal<string>('ALL');
  readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  readonly isModalOpen = signal<boolean>(false);
  readonly editingProductId = signal<string | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly modalError = signal<string | null>(null);

  readonly isEditMode = computed(() => !!this.editingProductId());

  // Permissions
  readonly canManageProducts = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  });

  // Metrics
  readonly totalProductsCount = computed(() => this.products().length);
  readonly activeProductsCount = computed(
    () => this.products().filter((p) => p.isActive).length,
  );
  readonly riceProductsCount = computed(
    () =>
      this.products().filter(
        (p) => p.category === ProductCategory.RICE && p.isActive,
      ).length,
  );
  readonly byProductsCount = computed(
    () =>
      this.products().filter(
        (p) => p.category === ProductCategory.BY_PRODUCT && p.isActive,
      ).length,
  );
  readonly packagedProductsCount = computed(
    () =>
      this.products().filter(
        (p) => p.category === ProductCategory.PACKAGED && p.isActive,
      ).length,
  );

  // Auto-calculated next product code (e.g., PROD-007)
  readonly nextProductCode = computed(() => {
    const prods = this.products();
    if (!prods.length) return 'PROD-001';
    let maxNum = 0;
    for (const p of prods) {
      const match = (p.productCode || '').match(/PROD-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `PROD-${String(maxNum + 1).padStart(3, '0')}`;
  });

  // Filtered List
  readonly filteredProducts = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const cat = this.selectedCategory();
    const stat = this.statusFilter();

    return this.products().filter((p) => {
      // Category filter
      if (cat !== 'ALL' && p.category !== cat) return false;

      // Status filter
      if (stat === 'ACTIVE' && !p.isActive) return false;
      if (stat === 'INACTIVE' && p.isActive) return false;

      // Search term
      if (term) {
        const nameMatch = (p.name || '').toLowerCase().includes(term);
        const codeMatch = (p.productCode || '').toLowerCase().includes(term);
        const hsnMatch = (p.hsnCode || '').toLowerCase().includes(term);
        const weightMatch = `${p.bagWeightKg}kg`.toLowerCase().includes(term);
        if (!nameMatch && !codeMatch && !hsnMatch && !weightMatch) return false;
      }

      return true;
    });
  });

  // Reactive Form
  productForm: FormGroup = this.initForm();

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    // Fetch all products (including inactive) for management
    this.productsService.getProducts(true).subscribe({
      next: (list) => {
        this.products.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.snackbar.error('Failed to load products catalog.');
      },
    });
  }

  private initForm(): FormGroup {
    return this.fb.group({
      productCode: ['', [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      category: [ProductCategory.RICE, [Validators.required]],
      hsnCode: ['1006', [Validators.required]],
      unit: ['BAG', [Validators.required]],
      bagWeightKg: [25, [Validators.required, Validators.min(0.1)]],
      defaultRate: [0, [Validators.required, Validators.min(0)]],
      taxRatePercent: [5, [Validators.required, Validators.min(0)]],
      isActive: [true],
    });
  }

  openCreateModal(): void {
    this.editingProductId.set(null);
    this.modalError.set(null);
    this.productForm.get('productCode')?.enable();
    this.productForm.reset({
      productCode: this.nextProductCode(),
      name: '',
      category: ProductCategory.RICE,
      hsnCode: '1006',
      unit: 'BAG',
      bagWeightKg: 25,
      defaultRate: 0,
      taxRatePercent: 5,
      isActive: true,
    });
    this.isModalOpen.set(true);
  }

  openEditModal(product: IProduct): void {
    this.editingProductId.set(product.id);
    this.modalError.set(null);
    this.productForm.patchValue({
      productCode: product.productCode,
      name: product.name,
      category: product.category,
      hsnCode: product.hsnCode,
      unit: product.unit || 'BAG',
      bagWeightKg: product.bagWeightKg ?? 25,
      defaultRate: product.defaultRate ?? 0,
      taxRatePercent: product.taxRatePercent ?? 5,
      isActive: product.isActive ?? true,
    });
    this.productForm.get('productCode')?.disable();
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingProductId.set(null);
    this.modalError.set(null);
    this.productForm.get('productCode')?.enable();
    this.productForm.reset();
  }

  onCategoryChange(): void {
    const cat = this.productForm.get('category')?.value;
    // Auto-suggest HSN code and default tax rate based on standard Indian Rice Mill GST regulations
    if (cat === ProductCategory.RICE) {
      this.productForm.patchValue({ hsnCode: '1006', taxRatePercent: 5 });
    } else if (cat === ProductCategory.BY_PRODUCT) {
      this.productForm.patchValue({ hsnCode: '2302', taxRatePercent: 5 });
    } else if (cat === ProductCategory.PACKAGED) {
      this.productForm.patchValue({ hsnCode: '80000000', taxRatePercent: 5 });
    }
  }

  onUnitChange(): void {
    const unit = this.productForm.get('unit')?.value;
    const bagWeightCtrl = this.productForm.get('bagWeightKg');
    if (unit === 'KG') {
      bagWeightCtrl?.clearValidators();
      bagWeightCtrl?.setValue(1);
    } else {
      bagWeightCtrl?.setValidators([Validators.required, Validators.min(0.1)]);
      if (!bagWeightCtrl?.value || bagWeightCtrl.value === 1) {
        bagWeightCtrl?.setValue(25);
      }
    }
    bagWeightCtrl?.updateValueAndValidity();
  }

  saveProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.modalError.set('Please fill in all required fields marked with *');
      return;
    }

    this.isSubmitting.set(true);
    this.modalError.set(null);
    const formVal = this.productForm.getRawValue();

    const payload: CreateProductDto = {
      productCode: formVal.productCode?.trim().toUpperCase(),
      name: formVal.name?.trim(),
      category: formVal.category,
      hsnCode: formVal.hsnCode?.trim(),
      unit: formVal.unit,
      bagWeightKg: formVal.unit === 'KG' ? 1 : Number(formVal.bagWeightKg),
      defaultRate: Number(formVal.defaultRate),
      taxRatePercent: Number(formVal.taxRatePercent),
    };

    if (this.isEditMode() && this.editingProductId()) {
      const updatePayload: UpdateProductDto = {
        ...payload,
        isActive: formVal.isActive,
      };

      this.productsService
        .updateProduct(this.editingProductId()!, updatePayload)
        .subscribe({
          next: (updated) => {
            this.isSubmitting.set(false);
            this.snackbar.success(
              `Product "${updated.name}" updated successfully!`,
            );
            this.closeModal();
            this.loadProducts();
          },
          error: (err) => {
            this.isSubmitting.set(false);
            const msg =
              err?.error?.message ||
              'Failed to update product. Please check fields.';
            this.modalError.set(msg);
          },
        });
    } else {
      this.productsService.createProduct(payload).subscribe({
        next: (created) => {
          this.isSubmitting.set(false);
          this.snackbar.success(
            `Product "${created.name}" created successfully!`,
          );
          this.closeModal();
          this.loadProducts();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg =
            err?.error?.message ||
            'Failed to create product. Check if product code already exists.';
          this.modalError.set(msg);
        },
      });
    }
  }

  toggleProductStatus(product: IProduct, event: Event): void {
    event.stopPropagation();
    if (!this.canManageProducts()) return;

    this.productsService.toggleProductStatus(product.id).subscribe({
      next: (updated) => {
        const statusStr = updated.isActive ? 'Active' : 'Inactive';
        this.snackbar.success(
          `Product "${product.name}" is now ${statusStr}.`,
        );
        this.loadProducts();
      },
      error: () => {
        this.snackbar.error('Failed to change product status.');
      },
    });
  }

  getCategoryLabel(category: ProductCategory): string {
    switch (category) {
      case ProductCategory.RICE:
        return 'Rice Variety';
      case ProductCategory.BY_PRODUCT:
        return 'By-Product';
      case ProductCategory.PACKAGED:
        return 'Packaged Food';
      default:
        return category;
    }
  }
}
