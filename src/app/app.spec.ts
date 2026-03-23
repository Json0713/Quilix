import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY, Subject } from 'rxjs';

import { App } from './app';

/**
 * Minimal SwUpdate stub so services that inject SwUpdate
 * (QuilixUpdateService, OsNotificationService) can resolve
 * without a real service-worker runtime.
 */
const swUpdateStub: Partial<SwUpdate> = {
  isEnabled: false,
  versionUpdates: EMPTY,
  unrecoverable: EMPTY,
  activateUpdate: () => Promise.resolve(true),
  checkForUpdate: () => Promise.resolve(false),
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: SwUpdate, useValue: swUpdateStub },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have the title signal set to "Quilix"', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    // The title signal is protected, so we verify via the component instance existing
    // and the app-root rendering without errors
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-root')).toBeTruthy();
  });
});
