import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SnackbarService } from '../../../core/services/snackbar.service';

@Component({
  selector: 'app-snackbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './snackbar.component.html',
  styleUrls: ['./snackbar.component.scss'],
})
export class SnackbarComponent {
  readonly snackbarService = inject(SnackbarService);
  readonly message = this.snackbarService.currentMessage;

  dismiss(): void {
    this.snackbarService.dismiss();
  }
}
