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
import { CoreLogger } from '@singletons/logger';
import { CoreSitesProvider } from '@services/sites';
import { CoreAppProvider } from '@services/app';
import { CoreUtilsProvider } from '@services/utils/utils';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreTimeUtilsProvider } from '@services/utils/time';
import { AddonModChoiceOfflineProvider } from './offline';
import { AddonModChoiceProvider } from './choice';
import { CoreEvents } from '@singletons/events';
import { TranslateService } from '@ngx-translate/core';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreCourseLogHelperProvider } from '@core/course/providers/log-helper';
import { CoreCourseModulePrefetchDelegate } from '@core/course/providers/module-prefetch-delegate';
import { CoreCourseActivitySyncBaseProvider } from '@core/course/classes/activity-sync';
import { CoreSyncProvider } from '@services/sync';
import { AddonModChoicePrefetchHandler } from './prefetch-handler';

/**
 * Service to sync choices.
 */
@Injectable({ providedIn: 'root' })
export class AddonModChoiceSyncProvider extends CoreCourseActivitySyncBaseProvider {

    static readonly AUTO_SYNCED = 'addon_mod_choice_autom_synced';
    protected componentTranslate: string;

    constructor(protected sitesProvider: CoreSitesProvider,
            protected appProvider: CoreAppProvider, private choiceOffline: AddonModChoiceOfflineProvider,
             private choiceProvider: AddonModChoiceProvider,
            translate: TranslateService, private utils: CoreUtilsProvider, protected textUtils: CoreTextUtilsProvider,
            private courseProvider: CoreCourseProvider, syncProvider: CoreSyncProvider, timeUtils: CoreTimeUtilsProvider,
            private logHelper: CoreCourseLogHelperProvider, prefetchHandler: AddonModChoicePrefetchHandler,
            prefetchDelegate: CoreCourseModulePrefetchDelegate) {

        super('AddonModChoiceSyncProvider', loggerProvider, sitesProvider, appProvider, syncProvider, textUtils, translate,
                timeUtils, prefetchDelegate, prefetchHandler);

        this.componentTranslate = courseProvider.translateModuleName('choice');
    }

    /**
     * Get the ID of a choice sync.
     *
     * @param choiceId Choice ID.
     * @param userId User the responses belong to.
     * @return Sync ID.
     */
    protected getSyncId(choiceId: number, userId: number): string {
        return choiceId + '#' + userId;
    }

    /**
     * Try to synchronize all the choices in a certain site or in all sites.
     *
     * @param siteId Site ID to sync. If not defined, sync all sites.
     * @param force Wether to force sync not depending on last execution.
     * @return Promise resolved if sync is successful, rejected if sync fails.
     */
    syncAllChoices(siteId?: string, force?: boolean): Promise<any> {
        return this.syncOnSites('choices', this.syncAllChoicesFunc.bind(this), [force], siteId);
    }

    /**
     * Sync all pending choices on a site.
     *
     * @param siteId Site ID to sync. If not defined, sync all sites.
     * @param force Wether to force sync not depending on last execution.
     * @return Promise resolved if sync is successful, rejected if sync fails.
     */
    protected syncAllChoicesFunc(siteId?: string, force?: boolean): Promise<any> {
        return this.choiceOffline.getResponses(siteId).then((responses) => {
            // Sync all responses.
            const promises = responses.map((response) => {
                const promise = force ? this.syncChoice(response.choiceid, response.userid, siteId) :
                    this.syncChoiceIfNeeded(response.choiceid, response.userid, siteId);

                return promise.then((result) => {
                    if (result && result.updated) {
                        // Sync successful, send event.
                        CoreEvents.trigger(AddonModChoiceSyncProvider.AUTO_SYNCED, {
                            choiceId: response.choiceid,
                            userId: response.userid,
                            warnings: result.warnings
                        }, siteId);
                    }
                });
            });

            return Promise.all(promises);
        });
    }

    /**
     * Sync an choice only if a certain time has passed since the last time.
     *
     * @param choiceId Choice ID to be synced.
     * @param userId User the answers belong to.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the choice is synced or it doesn't need to be synced.
     */
    syncChoiceIfNeeded(choiceId: number, userId: number, siteId?: string): Promise<any> {
        const syncId = this.getSyncId(choiceId, userId);

        return this.isSyncNeeded(syncId, siteId).then((needed) => {
            if (needed) {
                return this.syncChoice(choiceId, userId, siteId);
            }
        });
    }

    /**
     * Synchronize a choice.
     *
     * @param choiceId Choice ID to be synced.
     * @param userId User the answers belong to.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved if sync is successful, rejected otherwise.
     */
    syncChoice(choiceId: number, userId?: number, siteId?: string): Promise<any> {
        return CoreSites.getSite(siteId).then((site) => {
            userId = userId || site.getUserId();
            siteId = site.getId();

            const syncId = this.getSyncId(choiceId, userId);
            if (this.isSyncing(syncId, siteId)) {
                // There's already a sync ongoing for this discussion, return the promise.
                return this.getOngoingSync(syncId, siteId);
            }

            this.logger.debug(`Try to sync choice '${choiceId}' for user '${userId}'`);

            let courseId;
            const result = {
                warnings: [],
                updated: false
            };

            // Sync offline logs.
            const syncPromise = CoreCourseLogHelper.syncIfNeeded(AddonModChoiceProvider.COMPONENT, choiceId, siteId).catch(() => {
                // Ignore errors.
            }).then(() => {
                return this.choiceOffline.getResponse(choiceId, siteId, userId).catch(() => {
                    // No offline data found, return empty object.
                    return {};
                });
            }).then((data) => {
                if (!data.choiceid) {
                    // Nothing to sync.
                    return;
                }

                if (!CoreApp.isOnline()) {
                    // Cannot sync in offline.
                    return Promise.reject(null);
                }

                courseId = data.courseid;

                // Send the responses.
                let promise;

                if (data.deleting) {
                    // A user has deleted some responses.
                    promise = this.choiceProvider.deleteResponsesOnline(choiceId, data.responses, siteId);
                } else {
                    // A user has added some responses.
                    promise = this.choiceProvider.submitResponseOnline(choiceId, data.responses, siteId);
                }

                return promise.then(() => {
                    result.updated = true;

                    return this.choiceOffline.deleteResponse(choiceId, siteId, userId);
                }).catch((error) => {
                    if (CoreUtils.isWebServiceError(error)) {
                        // The WebService has thrown an error, this means that responses cannot be submitted. Delete them.
                        result.updated = true;

                        return this.choiceOffline.deleteResponse(choiceId, siteId, userId).then(() => {
                            // Responses deleted, add a warning.
                            result.warnings.push(Translate.instant('core.warningofflinedatadeleted', {
                                component: this.componentTranslate,
                                name: data.name,
                                error: this.textUtils.getErrorMessageFromError(error)
                            }));
                        });
                    }

                    // Couldn't connect to server, reject.
                    return Promise.reject(error);
                });
            }).then(() => {
                if (courseId) {
                    // Data has been sent to server, prefetch choice if needed.
                    return CoreCourse.getModuleBasicInfoByInstance(choiceId, 'choice', siteId).then((module) => {
                        return this.prefetchAfterUpdate(module, courseId, undefined, siteId);
                    }).catch(() => {
                        // Ignore errors.
                    });
                }
            }).then(() => {
                // Sync finished, set sync time.
                return this.setSyncTime(syncId, siteId);
            }).then(() => {
                // All done, return the warnings.
                return result;
            });

            return this.addOngoingSync(syncId, syncPromise, siteId);
        });
    }
}
