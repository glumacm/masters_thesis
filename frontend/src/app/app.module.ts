import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeTestComponent } from './home-test/home-test.component';
import { ConflictManagerService } from './packages/conflict-manager.service';
import { NetworkService } from './packages/network.service';
import { HomeSyncCleanComponent } from './home-sync-clean/home-sync-clean.component';
import { HomeSyncCleanModule } from './home-sync-clean/home-sync-clean.module';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [
    AppComponent,
    // HomeTestComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    HomeSyncCleanModule,
    NoopAnimationsModule,
  ],
  providers: [NetworkService, ConflictManagerService],
  bootstrap: [AppComponent]
})
export class AppModule { }
