import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  private readonly STORAGE_KEY = 'rm_sidebar_collapsed';

  readonly isCollapsed = signal<boolean>(
    typeof window !== 'undefined' && localStorage.getItem(this.STORAGE_KEY) === 'true'
  );

  toggle(): void {
    const next = !this.isCollapsed();
    this.isCollapsed.set(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, String(next));
    }
  }

  setCollapsed(collapsed: boolean): void {
    this.isCollapsed.set(collapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, String(collapsed));
    }
  }
}
