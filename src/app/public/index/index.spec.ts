import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicIndex } from './index';

describe('PublicIndex', () => {
  let component: PublicIndex;
  let fixture: ComponentFixture<PublicIndex>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicIndex]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PublicIndex);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
