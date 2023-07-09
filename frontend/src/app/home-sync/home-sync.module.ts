import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeSyncRoutingModule } from './home-sync-routing.module';
import { HomeSyncComponent } from './home-sync.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ConflictManagerService } from '../packages/conflict-manager.service';


@NgModule({
  declarations: [
    HomeSyncComponent
  ],
  imports: [
    CommonModule,
    HomeSyncRoutingModule,
    ReactiveFormsModule
  ],
  providers: []
})
export class HomeSyncModule { }
