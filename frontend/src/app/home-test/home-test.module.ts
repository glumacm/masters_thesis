import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// import { HomeTestRoutingModule } from './home-test-routing.module';
import { HomeTestComponent } from './home-test.component';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';


@NgModule({
  declarations: [
    HomeTestComponent
  ],
  imports: [
    CommonModule,
    // HomeTestRoutingModule,
    RouterModule.forChild([
        { path: '', component: HomeTestComponent }
    ]),
    ReactiveFormsModule,
  ]
})
export class HomeTestModule { }
