import { TestBed } from '@angular/core/testing';

import { BackupShareService } from './backup-share';

describe('BackupShareService', () => {
  let service: BackupShareService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BackupShareService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
