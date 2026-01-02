import { TestBed } from '@angular/core/testing';

import { UserExportImportService } from './user-export-import';

describe('UserExportImportService', () => {
  let service: UserExportImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserExportImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
