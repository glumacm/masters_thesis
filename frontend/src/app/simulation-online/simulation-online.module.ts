import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationOnlineComponent } from './simulation-online.component';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';



@NgModule({
  declarations: [SimulationOnlineComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(
      [{ path: '', component: SimulationOnlineComponent }]
    ),
  ]
})
export class SimulationOnlineModule { }
