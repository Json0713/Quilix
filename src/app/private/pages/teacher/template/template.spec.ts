import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeacherTemplate } from './template';

describe('TeacherTemplate', () => {
  let component: TeacherTemplate;
  let fixture: ComponentFixture<TeacherTemplate>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherTemplate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeacherTemplate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
