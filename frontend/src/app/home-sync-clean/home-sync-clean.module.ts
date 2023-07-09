import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReactiveFormsModule } from '@angular/forms';
import { ConflictManagerService } from '../packages/conflict-manager.service';
import { HomeSyncCleanComponent } from './home-sync-clean.component';
import { HomeSyncCleanRoutingModule } from './home-sync-clean-routing.module';


@NgModule({
  declarations: [
    HomeSyncCleanComponent
  ],
  imports: [
    CommonModule,
    HomeSyncCleanRoutingModule,
    ReactiveFormsModule
  ],
  providers: []
})
export class HomeSyncCleanModule { }
