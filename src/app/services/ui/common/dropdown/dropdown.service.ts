import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DropdownService {
  /**
   * Signal indicating if the current open menu should be a 'dropup'.
   */
  isDropup = signal<boolean>(false);

  /**
   * Calculates whether a dropdown should open upwards based on its vertical position.
   * @param event The mouse or click event from the trigger element.
   * @param threshold The pixel distance from the bottom of the viewport that triggers a 'dropup'.
   */
  updatePosition(event: Event, threshold: number = 200) {
    const button = event.currentTarget as HTMLElement;
    if (button) {
      const rect = button.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // If the dropdown would likely extend past the bottom of the screen, open it upwards.
      this.isDropup.set(rect.bottom > viewportHeight - threshold);
    }
  }

  /**
   * Resets the dropup state. Call this when closing a menu.
   */
  reset() {
    this.isDropup.set(false);
  }
}
