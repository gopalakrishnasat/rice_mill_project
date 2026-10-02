import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  readonly dialogService = inject(ConfirmDialogService);
  readonly state = this.dialogService.state;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.state().isOpen) {
      this.dialogService.handleCancel();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('confirm-backdrop')) {
      this.dialogService.handleCancel();
    }
  }

  onConfirm(): void {
    this.dialogService.handleConfirm();
  }

  onCancel(): void {
    this.dialogService.handleCancel();
  }
}
