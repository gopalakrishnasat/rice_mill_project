import { Injectable, signal } from '@angular/core';

export type DialogType = 'danger' | 'warning' | 'primary' | 'success' | 'info';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: DialogType;
}

export interface AlertDialogOptions {
  title: string;
  message: string;
  buttonText?: string;
  type?: DialogType;
}

export interface DialogState {
  isOpen: boolean;
  isAlertOnly: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: DialogType;
  resolve?: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  readonly state = signal<DialogState>({
    isOpen: false,
    isAlertOnly: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'primary',
  });

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state.set({
        isOpen: true,
        isAlertOnly: false,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'primary',
        resolve,
      });
    });
  }

  alert(options: AlertDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state.set({
        isOpen: true,
        isAlertOnly: true,
        title: options.title,
        message: options.message,
        confirmText: options.buttonText || 'Got It',
        cancelText: '',
        type: options.type || 'info',
        resolve,
      });
    });
  }

  handleConfirm(): void {
    const s = this.state();
    if (s.resolve) s.resolve(true);
    this.close();
  }

  handleCancel(): void {
    const s = this.state();
    if (s.resolve) s.resolve(false);
    this.close();
  }

  private close(): void {
    this.state.update((curr) => ({
      ...curr,
      isOpen: false,
      resolve: undefined,
    }));
  }
}
