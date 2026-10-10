import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompanyService } from '../../core/services/company.service';
import { AuthService } from '../../core/services/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import {
  ICompanyDetails,
  UpdateCompanyDetailsDto,
  UserRole,
} from '@rice-mill-project/shared-types';

@Component({
  selector: 'app-company-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './company-details.component.html',
  styleUrls: ['./company-details.component.scss'],
})
export class CompanyDetailsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly authService = inject(AuthService);
  private readonly snackbarService = inject(SnackbarService);

  readonly currentUser = this.authService.currentUser;
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  companyForm!: FormGroup;

  get canEdit(): boolean {
    const role = this.currentUser()?.role;
    return role === UserRole.SUPER_ADMIN;
  }

  get hasChanges(): boolean {
    return !!this.companyForm && this.companyForm.dirty;
  }

  get termsArray(): FormArray {
    return this.companyForm.get('termsAndConditions') as FormArray;
  }

  ngOnInit(): void {
    this.initForm();
    this.loadCompanyDetails();
  }

  private initForm(): void {
    this.companyForm = this.fb.group({
      millName: ['', [Validators.required, Validators.minLength(3)]],
      tagline: [''],
      gstin: [
        '',
        [
          Validators.required,
          Validators.pattern('^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
        ],
      ],
      fssaiNumber: ['', [Validators.required, Validators.pattern('^[0-9]{14}$')]],
      mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      alternatePhone: [''],
      email: ['', [Validators.email]],
      contactPerson: [''],
      jurisdiction: ['Pune', [Validators.required]],
      address: this.fb.group({
        street: ['', [Validators.required]],
        taluka: [''],
        district: [''],
        state: ['Maharashtra', [Validators.required]],
        pincode: ['', [Validators.required, Validators.pattern('^[0-9]{6}$')]],
      }),
      bankDetails: this.fb.group({
        bankName: ['', [Validators.required]],
        accountNumber: ['', [Validators.required]],
        ifsc: ['', [Validators.required]],
        branch: ['', [Validators.required]],
        upiId: [''],
      }),
      devotionalHeaders: this.fb.group({
        left: ['|| Perantal Mata Prasana ||'],
        center: ['|| Shree Ganeshya Namha ||'],
        right: ['|| Shree Mukatai Prasana ||'],
      }),
      termsAndConditions: this.fb.array([]),
    });

    if (!this.canEdit) {
      this.companyForm.disable();
    }
  }

  loadCompanyDetails(): void {
    this.isLoading.set(true);

    this.companyService.getCompanyDetails().subscribe({
      next: (details: ICompanyDetails) => {
        this.populateForm(details);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.snackbarService.error(
          err?.error?.message || 'Failed to load company details. Using default values.',
        );
        this.isLoading.set(false);
      },
    });
  }

  private populateForm(details: ICompanyDetails): void {
    this.companyForm.patchValue({
      millName: details.millName || '',
      tagline: details.tagline || '',
      gstin: details.gstin || '',
      fssaiNumber: details.fssaiNumber || '',
      mobile: details.mobile || '',
      alternatePhone: details.alternatePhone || '',
      email: details.email || '',
      contactPerson: details.contactPerson || '',
      jurisdiction: details.jurisdiction || 'Pune',
      address: {
        street: details.address?.street || '',
        taluka: details.address?.taluka || '',
        district: details.address?.district || '',
        state: details.address?.state || 'Maharashtra',
        pincode: details.address?.pincode || '',
      },
      bankDetails: {
        bankName: details.bankDetails?.bankName || '',
        accountNumber: details.bankDetails?.accountNumber || '',
        ifsc: details.bankDetails?.ifsc || '',
        branch: details.bankDetails?.branch || '',
        upiId: details.bankDetails?.upiId || '',
      },
      devotionalHeaders: {
        left: details.devotionalHeaders?.left || '|| Perantal Mata Prasana ||',
        center: details.devotionalHeaders?.center || '|| Shree Ganeshya Namha ||',
        right: details.devotionalHeaders?.right || '|| Shree Mukatai Prasana ||',
      },
    });

    this.termsArray.clear();
    const terms = details.termsAndConditions?.length
      ? details.termsAndConditions
      : [
          '1. Goods once sold will not be taken back.',
          '2. Interest @ 18% p.a. will be charged if bill is not paid on due date.',
          '3. Subject to Pune jurisdiction.',
        ];

    terms.forEach((term) => {
      this.termsArray.push(this.fb.control(term));
    });

    if (!this.canEdit) {
      this.companyForm.disable();
    } else {
      this.companyForm.enable();
    }
    this.companyForm.markAsPristine();
  }

  addTerm(): void {
    if (!this.canEdit) return;
    const nextNumber = this.termsArray.length + 1;
    this.termsArray.push(this.fb.control(`${nextNumber}. `));
    this.companyForm.markAsDirty();
  }

  removeTerm(index: number): void {
    if (!this.canEdit) return;
    this.termsArray.removeAt(index);
    this.companyForm.markAsDirty();
  }

  onSubmit(): void {
    if (!this.canEdit) return;
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      this.snackbarService.error('Please correct the highlighted fields in the form.');
      return;
    }

    this.isSaving.set(true);

    const raw = this.companyForm.getRawValue();
    const dto: UpdateCompanyDetailsDto = {
      millName: raw.millName.trim(),
      tagline: raw.tagline?.trim(),
      gstin: raw.gstin.trim().toUpperCase(),
      fssaiNumber: raw.fssaiNumber.trim(),
      mobile: raw.mobile.trim(),
      alternatePhone: raw.alternatePhone?.trim() || undefined,
      email: raw.email?.trim() || undefined,
      contactPerson: raw.contactPerson?.trim() || undefined,
      jurisdiction: raw.jurisdiction?.trim() || 'Pune',
      address: {
        street: raw.address.street.trim(),
        taluka: raw.address.taluka?.trim() || undefined,
        district: raw.address.district?.trim() || undefined,
        state: raw.address.state.trim(),
        pincode: raw.address.pincode.trim(),
      },
      bankDetails: {
        bankName: raw.bankDetails.bankName.trim(),
        accountNumber: raw.bankDetails.accountNumber.trim(),
        ifsc: raw.bankDetails.ifsc.trim().toUpperCase(),
        branch: raw.bankDetails.branch.trim(),
        upiId: raw.bankDetails.upiId?.trim() || undefined,
      },
      devotionalHeaders: {
        left: raw.devotionalHeaders.left?.trim() || undefined,
        center: raw.devotionalHeaders.center?.trim() || undefined,
        right: raw.devotionalHeaders.right?.trim() || undefined,
      },
      termsAndConditions: (raw.termsAndConditions || [])
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0),
    };

    this.companyService.updateCompanyDetails(dto).subscribe({
      next: (updated) => {
        this.populateForm(updated);
        this.isSaving.set(false);
        this.snackbarService.success('Company details & mill profile saved successfully!');
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err?.error?.message || 'Failed to update company details. Please try again.';
        this.snackbarService.error(msg);
      },
    });
  }
}
