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

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CoreAppProvider } from '@services/app';
import { CoreEvents } from '@services/events';
import { CoreLogger } from '@singletons/logger';
import { CoreSitesProvider } from '@services/sites';
import { CoreSyncProvider } from '@services/sync';
import { CoreUtils } from '@services/utils/utils';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreTimeUtilsProvider } from '@services/utils/time';
import { CoreCourse } from '@core/course/providers/course';
import { CoreCourseLogHelper } from '@core/course/providers/log-helper';
import { CoreCourseModulePrefetchDelegate } from '@core/course/providers/module-prefetch-delegate';
import { CoreCourseActivitySyncBaseProvider } from '@core/course/classes/activity-sync';
import { CoreXAPI } from '@core/xapi/providers/xapi';
import { CoreXAPIOffline } from '@core/xapi/providers/offline';
import { AddonModH5PActivity, AddonModH5PActivityProvider } from './h5pactivity';
import { AddonModH5PActivityPrefetchHandler } from './prefetch-handler';

import { makeSingleton } from '@singletons/core.singletons';

/**
 * Service to sync H5P activities.
 */
@Injectable({ providedIn: 'root' })
export class AddonModH5PActivitySyncProvider extends CoreCourseActivitySyncBaseProvider {

    static readonly AUTO_SYNCED = 'addon_mod_h5pactivity_autom_synced';
    protected componentTranslate: string;

    constructor(sitesProvider: CoreSitesProvider,

            appProvider: CoreAppProvider,
            translate: TranslateService,
            textUtils: CoreTextUtilsProvider,
            syncProvider: CoreSyncProvider,
            timeUtils: CoreTimeUtilsProvider,
            prefetchHandler: AddonModH5PActivityPrefetchHandler,
            prefetchDelegate: CoreCourseModulePrefetchDelegate) {

        super('AddonModH5PActivitySyncProvider', loggerProvider, sitesProvider, appProvider, syncProvider, textUtils, translate,
                timeUtils, prefetchDelegate, prefetchHandler);

        this.componentTranslate = CoreCourse.translateModuleName('h5pactivity');
    }

    /**
     * Try to synchronize all the H5P activities in a certain site or in all sites.
     *
     * @param siteId Site ID to sync. If not defined, sync all sites.
     * @param force Wether to force sync not depending on last execution.
     * @return Promise resolved if sync is successful, rejected if sync fails.
     */
    syncAllActivities(siteId?: string, force?: boolean): Promise<void> {
        return this.syncOnSites('H5P activities', this.syncAllActivitiesFunc.bind(this), [force], siteId);
    }

    /**
     * Sync all H5P activities on a site.
     *
     * @param siteId Site ID to sync. If not defined, sync all sites.
     * @param force Wether to force sync not depending on last execution.
     * @return Promise resolved if sync is successful, rejected if sync fails.
     */
    protected async syncAllActivitiesFunc(siteId?: string, force?: boolean): Promise<void> {
        const entries = await CoreXAPIOffline.getAllStatements(siteId);

        // Sync all responses.
        const promises = entries.map((response) => {
            const promise = force ? this.syncActivity(response.contextid, siteId) :
                    this.syncActivityIfNeeded(response.contextid, siteId);

            return promise.then((result) => {
                if (result && result.updated) {
                    // Sync successful, send event.
                    CoreEvents.trigger(AddonModH5PActivitySyncProvider.AUTO_SYNCED, {
                        contextId: response.contextid,
                        warnings: result.warnings,
                    }, siteId);
                }
            });
        });

        await Promise.all(promises);
    }

    /**
     * Sync an H5P activity only if a certain time has passed since the last time.
     *
     * @param contextId Context ID of the activity.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the activity is synced or it doesn't need to be synced.
     */
    async syncActivityIfNeeded(contextId: number, siteId?: string): Promise<any> {
        const needed = await this.isSyncNeeded(contextId, siteId);

        if (needed) {
            return this.syncActivity(contextId, siteId);
        }
    }

    /**
     * Synchronize an H5P activity. If it's already being synced it will reuse the same promise.
     *
     * @param contextId Context ID of the activity.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved if sync is successful, rejected otherwise.
     */
    syncActivity(contextId: number, siteId?: string): Promise<any> {
        siteId = siteId || CoreSites.getCurrentSiteId();

        if (!CoreApp.isOnline()) {
            // Cannot sync in offline.
            throw Translate.instant('core.networkerrormsg');
        }

        if (this.isSyncing(contextId, siteId)) {
            // There's already a sync ongoing for this discussion, return the promise.
            return this.getOngoingSync(contextId, siteId);
        }

        return this.addOngoingSync(contextId, this.syncActivityData(contextId, siteId), siteId);
    }

    /**
     * Synchronize an H5P activity.
     *
     * @param contextId Context ID of the activity.
     * @param siteId Site ID.
     * @return Promise resolved if sync is successful, rejected otherwise.
     */
    protected async syncActivityData(contextId: number, siteId: string): Promise<{warnings: string[], updated: boolean}> {

        this.logger.debug(`Try to sync H5P activity with context ID '${contextId}'`);

        const result = {
            warnings: [],
            updated: false,
        };

        // Get all the statements stored for the activity.
        const entries = await CoreXAPIOffline.getContextStatements(contextId, siteId);

        if (!entries || !entries.length) {
            // Nothing to sync.
            await this.setSyncTime(contextId, siteId);

            return result;
        }

        // Get the activity instance.
        const courseId = entries[0].courseid;

        const h5pActivity = await AddonModH5PActivity.getH5PActivityByContextId(courseId, contextId, {siteId});

        // Sync offline logs.
        try {
            await CoreCourseLogHelper.syncIfNeeded(AddonModH5PActivityProvider.COMPONENT, h5pActivity.id, siteId);
        } catch (error) {
            // Ignore errors.
        }

        // Send the statements in order.
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            try {
                await CoreXAPI.postStatementsOnline(entry.component, entry.statements, siteId);

                result.updated = true;

                await CoreXAPIOffline.deleteStatements(entry.id, siteId);
            } catch (error) {
                if (CoreUtils.isWebServiceError(error)) {
                    // The WebService has thrown an error, this means that statements cannot be submitted. Delete them.
                    result.updated = true;

                    await CoreXAPIOffline.deleteStatements(entry.id, siteId);

                    // Responses deleted, add a warning.
                    result.warnings.push(Translate.instant('core.warningofflinedatadeleted', {
                        component: this.componentTranslate,
                        name: entry.extra,
                        error: CoreTextUtils.getErrorMessageFromError(error),
                    }));
                } else {
                    // Stop synchronizing.
                    throw error;
                }
            }
        }

        if (result.updated) {
            try {
                // Data has been sent to server, invalidate attempts.
                await AddonModH5PActivity.invalidateUserAttempts(h5pActivity.id, undefined, siteId);
            } catch (error) {
                // Ignore errors.
            }
        }

        // Sync finished, set sync time.
        await this.setSyncTime(contextId, siteId);

        return result;
    }
}

export class AddonModH5PActivitySync extends makeSingleton(AddonModH5PActivitySyncProvider) {}
