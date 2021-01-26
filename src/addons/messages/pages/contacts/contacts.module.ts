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

import { Injector, NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule, ROUTES, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';

import { CoreSharedModule } from '@/core/shared.module';

import { ADDON_MESSAGES_CONTACTS_ROUTES } from './messages-contacts-routing.module';
import { AddonMessagesContactsPage } from './contacts.page';
import { buildTabMainRoutes } from '@features/mainmenu/mainmenu-tab-routing.module';
import { resolveModuleRoutes } from '@/app/app-routing.module';

const routes: Routes = [
    {
        path: '',
        component: AddonMessagesContactsPage,
    },
];

function buildRoutes(injector: Injector): Routes {
    const routes = resolveModuleRoutes(injector, ADDON_MESSAGES_CONTACTS_ROUTES);

    return [
        ...buildTabMainRoutes(injector, {
            path: '',
            component: AddonMessagesContactsPage,
            children: routes.children,
        }),
        ...routes.siblings,
    ];
}

@NgModule({
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        IonicModule,
        TranslateModule.forChild(),
        CoreSharedModule,
    ],
    providers: [
        { provide: ROUTES, multi: true, useFactory: buildRoutes, deps: [Injector] },
    ],
    declarations: [
        AddonMessagesContactsPage,
    ],
    exports: [RouterModule],
})
export class AddonMessagesContactsPageModule {}