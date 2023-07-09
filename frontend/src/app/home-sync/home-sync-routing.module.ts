import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeSyncComponent } from './home-sync.component';

const routes: Routes = [{ path: '', component: HomeSyncComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomeSyncRoutingModule { }
