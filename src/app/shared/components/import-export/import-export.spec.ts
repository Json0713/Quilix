import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportExport } from './import-export';

describe('ImportExport', () => {
  let component: ImportExport;
  let fixture: ComponentFixture<ImportExport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportExport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportExport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
