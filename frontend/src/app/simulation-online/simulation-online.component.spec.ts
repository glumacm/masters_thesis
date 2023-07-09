import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimulationOnlineComponent } from './simulation-online.component';

describe('SimulationOnlineComponent', () => {
  let component: SimulationOnlineComponent;
  let fixture: ComponentFixture<SimulationOnlineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SimulationOnlineComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimulationOnlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
