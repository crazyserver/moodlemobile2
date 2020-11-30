// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Code based on https://github.com/martinpritchardelevate/ionic-split-pane-demo

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Route, RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { CoreComponentsModule } from '../../components.module';

import { CoreSplitViewPlaceholderPage } from './placeholder.page';

const placeholderRoute: Route = {
    path: '',
    component: CoreSplitViewPlaceholderPage,
    outlet: 'main',
};

@NgModule({
    declarations: [
        CoreSplitViewPlaceholderPage,
    ],
    imports: [
        RouterModule.forChild([placeholderRoute]),
        IonicModule,
        CommonModule,
        CoreComponentsModule,
        TranslateModule.forChild(),
    ],
})
export class CorePlaceholderPageModule {}

export const addSplitViewRoutes = (routes: Routes): Routes => {
    const mainRoutes: Routes = [placeholderRoute];

    routes.forEach((route: Route) => {
        const mainRoute: Route = Object.assign(route, { outlet: 'main' });

        mainRoutes.push(mainRoute);
    });

    routes.push({
        path: '',
        loadChildren: () => import('@components/split-view/placeholder/placeholder.module').then(m => m.CorePlaceholderPageModule),
    });

    return routes;
};
