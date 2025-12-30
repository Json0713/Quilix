import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentIndex } from './index';

describe('StudentIndex', () => {
  let component: StudentIndex;
  let fixture: ComponentFixture<StudentIndex>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentIndex]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentIndex);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
