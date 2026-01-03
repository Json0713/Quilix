import { TestBed } from '@angular/core/testing';

import { ToastRelay } from './toast-relay';

describe('ToastRelay', () => {
  let service: ToastRelay;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastRelay);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
