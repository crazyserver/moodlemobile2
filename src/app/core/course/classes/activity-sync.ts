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

import { TranslateService } from '@ngx-translate/core';
import { CoreSitesProvider } from '@services/sites';
import { CoreSyncProvider } from '@services/sync';
import { CoreLogger } from '@services/logger';
import { CoreAppProvider } from '@services/app';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreTimeUtilsProvider } from '@services/utils/time';
import { CoreSyncBaseProvider } from '@classes/base-sync';
import { CoreCourseModulePrefetchDelegate } from '@core/course/providers/module-prefetch-delegate';
import { CoreCourseModulePrefetchHandlerBase } from './module-prefetch-handler';

/**
 * Base class to create activity sync providers. It provides some common functions.
 */
export class CoreCourseActivitySyncBaseProvider extends CoreSyncBaseProvider {

    constructor(component: string, loggerProvider: CoreLoggerProvider, protected sitesProvider: CoreSitesProvider,
            protected appProvider: CoreAppProvider, protected syncProvider: CoreSyncProvider,
            protected textUtils: CoreTextUtilsProvider, protected translate: TranslateService,
            protected timeUtils: CoreTimeUtilsProvider, protected prefetchDelegate: CoreCourseModulePrefetchDelegate,
            protected prefetchHandler: CoreCourseModulePrefetchHandlerBase) {

        super(component, loggerProvider, sitesProvider, appProvider, syncProvider, textUtils, translate, timeUtils);
    }

    /**
     * Conveniece function to prefetch data after an update.
     *
     * @param module Module.
     * @param courseId Course ID.
     * @param regex If regex matches, don't download the data. Defaults to check files.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when done.
     */
    prefetchAfterUpdate(module: any, courseId: number, regex?: RegExp, siteId?: string): Promise<any> {
        regex = regex || /^.*files$/;

        // Get the module updates to check if the data was updated or not.
        return this.prefetchDelegate.getModuleUpdates(module, courseId, true, siteId).then((result) => {

            if (result && result.updates && result.updates.length > 0) {
                // Only prefetch if files haven't changed.
                const shouldDownload = !result.updates.find((entry) => {
                    return entry.name.match(regex);
                });

                if (shouldDownload) {
                    return this.prefetchHandler.download(module, courseId);
                }
            }
        });
    }
}
