import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeSyncCleanComponent } from './home-sync-clean.component';

const routes: Routes = [{ path: '', component: HomeSyncCleanComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomeSyncCleanRoutingModule { }
