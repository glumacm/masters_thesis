import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'home-test', loadChildren: () => import('./home-test/home-test.module').then(m => m.HomeTestModule) },
  { path: 'home-sync', loadChildren: () => import('./home-sync/home-sync.module').then(m => m.HomeSyncModule) },
  { path: 'home-sync-clean', loadChildren: () => import('./home-sync-clean/home-sync-clean.module').then(m => m.HomeSyncCleanModule) },
  { path: 'simulation', loadChildren: () => import('./simulation/simulation.module').then(m => m.SimulationModule) },
  { path: 'simulation-offline', loadChildren: () => import('./simulation-offline/simulation-offline.module').then(m => m.SimulationOfflineModule) },
  { path: 'simulation-online', loadChildren: () => import('./simulation-online/simulation-online.module').then(m => m.SimulationOnlineModule) },
  { path: 'simulation-online-with-steps/:dataAsBase64', loadChildren: () => import('./simulation-online-with-steps/simulation-online-with-steps.module').then(m => m.SimulationOnlineWithStepsModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
