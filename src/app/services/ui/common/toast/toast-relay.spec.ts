import { TestBed } from '@angular/core/testing';

import { ToastRelayService } from './toast-relay';

describe('ToastRelayService', () => {
  let service: ToastRelayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastRelayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
