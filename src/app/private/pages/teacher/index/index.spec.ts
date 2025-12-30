import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeacherIndex } from './index';

describe('TeacherIndex', () => {
  let component: TeacherIndex;
  let fixture: ComponentFixture<TeacherIndex>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherIndex]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeacherIndex);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
