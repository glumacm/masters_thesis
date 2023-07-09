import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationOfflineComponent } from './simulation-offline.component';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';



@NgModule({
  declarations: [SimulationOfflineComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(
      [{ path: '', component: SimulationOfflineComponent }]
    )
  ]
})
export class SimulationOfflineModule { }
