import { Injectable, signal } from '@angular/core';

export type SnackbarType = 'success' | 'error' | 'info';

export interface SnackbarMessage {
  id: number;
  text: string;
  type: SnackbarType;
}

@Injectable({
  providedIn: 'root',
})
export class SnackbarService {
  readonly currentMessage = signal<SnackbarMessage | null>(null);
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageCounter = 0;

  show(text: string, type: SnackbarType = 'success', duration = 4500): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const id = ++this.messageCounter;
    this.currentMessage.set({ id, text, type });

    if (duration > 0) {
      this.timeoutId = setTimeout(() => {
        if (this.currentMessage()?.id === id) {
          this.currentMessage.set(null);
        }
      }, duration);
    }
  }

  success(text: string, duration = 4500): void {
    this.show(text, 'success', duration);
  }

  error(text: string, duration = 5500): void {
    this.show(text, 'error', duration);
  }

  info(text: string, duration = 4500): void {
    this.show(text, 'info', duration);
  }

  dismiss(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.currentMessage.set(null);
  }
}
