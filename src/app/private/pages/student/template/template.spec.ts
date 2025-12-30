import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentTemplate } from './template';

describe('StudentTemplate', () => {
  let component: StudentTemplate;
  let fixture: ComponentFixture<StudentTemplate>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentTemplate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentTemplate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
