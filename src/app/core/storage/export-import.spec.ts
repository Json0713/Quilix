import { TestBed } from '@angular/core/testing';

import { ExportImport } from './export-import';

describe('ExportImport', () => {
  let service: ExportImport;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportImport);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
