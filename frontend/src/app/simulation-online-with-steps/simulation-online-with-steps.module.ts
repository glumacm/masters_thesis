import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SimulationOnlineWithStepsComponent } from './simulation-online-with-steps.component';



@NgModule({
  declarations: [SimulationOnlineWithStepsComponent],
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatCardModule,
    ReactiveFormsModule,
    RouterModule.forChild(
      [{ path: '', component: SimulationOnlineWithStepsComponent }]
    )
  ]
})
export class SimulationOnlineWithStepsModule { }
