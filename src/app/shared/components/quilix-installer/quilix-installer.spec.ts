import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuilixInstaller } from './quilix-installer';

describe('QuilixInstaller', () => {
  let component: QuilixInstaller;
  let fixture: ComponentFixture<QuilixInstaller>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuilixInstaller]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuilixInstaller);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
