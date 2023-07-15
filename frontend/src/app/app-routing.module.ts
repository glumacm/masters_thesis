import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'simulation-online-with-steps/:dataAsBase64', loadChildren: () => import('./simulation-online-with-steps/simulation-online-with-steps.module').then(m => m.SimulationOnlineWithStepsModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
