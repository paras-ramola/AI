import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatDashboard } from './chat-dashboard';

describe('ChatDashboard', () => {
  let component: ChatDashboard;
  let fixture: ComponentFixture<ChatDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
