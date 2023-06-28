import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { NotAuthorizedGuard } from '@guards';
import { PageNotFoundComponent } from '@components';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./map/map.module').then((m) => m.MapPageModule),
    // pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then((m) => m.AuthPageModule),
    canActivate: [NotAuthorizedGuard],
  },
  {
    path: 'settings',
    loadChildren: () => import('./settings/settings.module').then((m) => m.SettingsPageModule),
  },
  {
    path: 'walkthrough',
    loadChildren: () =>
      import('./walkthrough/walkthrough.module').then((m) => m.WalkthroughPageModule),
  },
  {
    path: 'deployment',
    loadChildren: () =>
      import('./deployment/deployment.module').then((m) => m.DeploymentPageModule),
  },
  {
    path: 'deployment-search',
    loadChildren: () =>
      import('./deployment/deployment-search/deployment-search.module').then(
        (m) => m.DeploymentSearchPageModule,
      ),
  },
  // {
  //   path: '',
  //   loadChildren: () => import('./post/post-edit/post-edit.module').then((m) => m.PostEditModule),
  //   pathMatch: 'full',
  // },
  {
    path: 'post-edit',
    loadChildren: () => import('./post/post-edit/post-edit.module').then((m) => m.PostEditModule),
    data: {
      breadcrumb: 'nav.posts',
      ogTitle: 'nav.posts',
    },
  },
  {
    path: ':id',
    loadChildren: () => import('./post/post.module').then((m) => m.PostPageModule),
  },
  {
    path: '**',
    pathMatch: 'full',
    component: PageNotFoundComponent,
    data: {
      breadcrumb: 'app.page-not-found',
      ogTitle: 'app.page-not-found',
    },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
