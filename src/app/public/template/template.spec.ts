import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicTemplate } from './template';

describe('Template', () => {
  let component: PublicTemplate;
  let fixture: ComponentFixture<PublicTemplate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicTemplate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PublicTemplate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
