import { TestBed } from '@angular/core/testing';

import { UserExportImport } from './user-export-import';

describe('UserExportImport', () => {
  let service: UserExportImport;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserExportImport);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
