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
import { CoreSyncBaseProvider } from '@classes/base-sync';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreCourseLogHelperProvider } from '@core/course/providers/log-helper';
import { CoreFileUploaderProvider } from '@core/fileuploader/providers/fileuploader';
import { CoreAppProvider } from '@services/app';
import { CoreLogger } from '@singletons/logger';
import { CoreEvents } from '@singletons/events';
import { CoreSitesProvider } from '@services/sites';
import { CoreSyncProvider } from '@services/sync';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreTimeUtilsProvider } from '@services/utils/time';
import { CoreUtilsProvider } from '@services/utils/utils';
import { AddonModGlossaryProvider } from './glossary';
import { AddonModGlossaryHelperProvider } from './helper';
import { AddonModGlossaryOfflineProvider } from './offline';
import { CoreRatingSyncProvider } from '@core/rating/providers/sync';

/**
 * Service to sync glossaries.
 */
@Injectable({ providedIn: 'root' })
export class AddonModGlossarySyncProvider extends CoreSyncBaseProvider {

    static readonly AUTO_SYNCED = 'addon_mod_glossary_autom_synced';

    protected componentTranslate: string;

    constructor(translate: TranslateService,
            appProvider: CoreAppProvider,
            courseProvider: CoreCourseProvider,


            sitesProvider: CoreSitesProvider,
            syncProvider: CoreSyncProvider,
            textUtils: CoreTextUtilsProvider,
            timeUtils: CoreTimeUtilsProvider,
            private uploaderProvider: CoreFileUploaderProvider,
            private utils: CoreUtilsProvider,
            private glossaryProvider: AddonModGlossaryProvider,
            private glossaryHelper: AddonModGlossaryHelperProvider,
            private glossaryOffline: AddonModGlossaryOfflineProvider,
            private logHelper: CoreCourseLogHelperProvider,
            private ratingSync: CoreRatingSyncProvider) {

        super('AddonModGlossarySyncProvider', loggerProvider, sitesProvider, appProvider, syncProvider, textUtils, translate,
                timeUtils);

        this.componentTranslate = courseProvider.translateModuleName('glossary');
    }

    /**
     * Try to synchronize all the glossaries in a certain site or in all sites.
     *
     * @param siteId Site ID to sync. If not defined, sync all sites.
     * @param force Wether to force sync not depending on last execution.
     * @return Promise resolved if sync is successful, rejected if sync fails.
     */
    syncAllGlossaries(siteId?: string, force?: boolean): Promise<any> {
        return this.syncOnSites('all glossaries', this.syncAllGlossariesFunc.bind(this), [force], siteId);
    }

    /**
     * Sync all glossaries on a site.
     *
     * @param siteId Site ID to sync.
     * @param force Wether to force sync not depending on last execution.
     * @return Promise resolved if sync is successful, rejected if sync fails.
     */
    protected syncAllGlossariesFunc(siteId: string, force?: boolean): Promise<any> {
        siteId = siteId || CoreSites.getCurrentSiteId();

        const promises = [];

        // Sync all new entries
        promises.push(this.glossaryOffline.getAllNewEntries(siteId).then((entries) => {
            const promises = {};

            // Do not sync same glossary twice.
            for (const i in entries) {
                const entry = entries[i];

                if (typeof promises[entry.glossaryid] != 'undefined') {
                    continue;
                }

                promises[entry.glossaryid] = force ? this.syncGlossaryEntries(entry.glossaryid, entry.userid, siteId) :
                    this.syncGlossaryEntriesIfNeeded(entry.glossaryid, entry.userid, siteId);

                promises[entry.glossaryid].then((result) => {
                    if (result && result.updated) {
                        // Sync successful, send event.
                        CoreEvents.trigger(AddonModGlossarySyncProvider.AUTO_SYNCED, {
                            glossaryId: entry.glossaryid,
                            userId: entry.userid,
                            warnings: result.warnings
                        }, siteId);
                    }
                });
            }

            // Promises will be an object so, convert to an array first;
            return Promise.all(CoreUtils.objectToArray(promises));
        }));

        promises.push(this.syncRatings(undefined, force, siteId));

        return Promise.all(promises);
    }

    /**
     * Sync a glossary only if a certain time has passed since the last time.
     *
     * @param glossaryId Glossary ID.
     * @param userId User the entry belong to.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the glossary is synced or if it doesn't need to be synced.
     */
    syncGlossaryEntriesIfNeeded(glossaryId: number, userId: number, siteId?: string): Promise<any> {
        siteId = siteId || CoreSites.getCurrentSiteId();

        const syncId = this.getGlossarySyncId(glossaryId, userId);

        return this.isSyncNeeded(syncId, siteId).then((needed) => {
            if (needed) {
                return this.syncGlossaryEntries(glossaryId, userId, siteId);
            }
        });
    }

    /**
     * Synchronize all offline entries of a glossary.
     *
     * @param glossaryId Glossary ID to be synced.
     * @param userId User the entries belong to.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved if sync is successful, rejected otherwise.
     */
    syncGlossaryEntries(glossaryId: number, userId?: number, siteId?: string): Promise<any> {
        userId = userId || CoreSites.getCurrentSiteUserId();
        siteId = siteId || CoreSites.getCurrentSiteId();

        const syncId = this.getGlossarySyncId(glossaryId, userId);
        if (this.isSyncing(syncId, siteId)) {
            // There's already a sync ongoing for this glossary, return the promise.
            return this.getOngoingSync(syncId, siteId);
        }

        // Verify that glossary isn't blocked.
        if (this.syncProvider.isBlocked(AddonModGlossaryProvider.COMPONENT, syncId, siteId)) {
            this.logger.debug('Cannot sync glossary ' + glossaryId + ' because it is blocked.');

            return Promise.reject(Translate.instant('core.errorsyncblocked', {$a: this.componentTranslate}));
        }

        this.logger.debug('Try to sync glossary ' + glossaryId + ' for user ' + userId);

        let courseId;
        const result = {
            warnings: [],
            updated: false
        };

        // Sync offline logs.
        const syncPromise = CoreCourseLogHelper.syncIfNeeded(AddonModGlossaryProvider.COMPONENT, glossaryId, siteId).catch(() => {
            // Ignore errors.
        }).then(() => {
            // Get offline responses to be sent.
            return this.glossaryOffline.getGlossaryNewEntries(glossaryId, siteId, userId).catch(() => {
                // No offline data found, return empty object.
                return [];
            });
        }).then((entries) => {
            if (!entries.length) {
                // Nothing to sync.
                return;
            } else if (!CoreApp.isOnline()) {
                // Cannot sync in offline.
                return Promise.reject(null);
            }

            const promises = [];

            entries.forEach((data) => {
                let promise;

                courseId = data.courseid;

                // First of all upload the attachments (if any).
                promise = this.uploadAttachments(glossaryId, data, siteId).then((itemId) => {
                    // Now try to add the entry.
                    return this.glossaryProvider.addEntryOnline(
                            glossaryId, data.concept, data.definition, data.options, itemId, siteId);
                });

                promises.push(promise.then(() => {
                    result.updated = true;

                    return this.deleteAddEntry(glossaryId, data.concept, data.timecreated, siteId);
                }).catch((error) => {
                    if (CoreUtils.isWebServiceError(error)) {
                        // The WebService has thrown an error, this means that responses cannot be submitted. Delete them.
                        result.updated = true;

                        return this.deleteAddEntry(glossaryId, data.concept, data.timecreated, siteId).then(() => {
                            // Responses deleted, add a warning.
                            result.warnings.push(Translate.instant('core.warningofflinedatadeleted', {
                                component: this.componentTranslate,
                                name: data.concept,
                                error: CoreTextUtils.getErrorMessageFromError(error)
                            }));
                        });
                    } else {
                        // Couldn't connect to server, reject.
                        return Promise.reject(error);
                    }
                }));
            });

            return Promise.all(promises);
        }).then(() => {
            if (result.updated && courseId) {
                // Data has been sent to server. Now invalidate the WS calls.
                return this.glossaryProvider.getGlossaryById(courseId, glossaryId).then((glossary) => {
                    return this.glossaryProvider.invalidateGlossaryEntries(glossary, true);
                }).catch(() => {
                    // Ignore errors.
                });
            }
        }).then(() => {
            // Sync finished, set sync time.
            return this.setSyncTime(syncId, siteId).catch(() => {
                // Ignore errors.
            });
        }).then(() => {
            // All done, return the warnings.
            return result;
        });

        return this.addOngoingSync(syncId, syncPromise, siteId);
    }

    /**
     * Synchronize offline ratings.
     *
     * @param cmId Course module to be synced. If not defined, sync all glossaries.
     * @param force Wether to force sync not depending on last execution.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved if sync is successful, rejected otherwise.
     */
    syncRatings(cmId?: number, force?: boolean, siteId?: string): Promise<any> {
        siteId = siteId || CoreSites.getCurrentSiteId();

         return this.ratingSync.syncRatings('mod_glossary', 'entry', 'module', cmId, 0, force, siteId).then((results) => {
            let updated = false;
            const warnings = [];
            const promises = [];

            results.forEach((result) => {
                if (result.updated.length) {
                    updated = true;

                    // Invalidate entry of updated ratings.
                    result.updated.forEach((itemId) => {
                        promises.push(this.glossaryProvider.invalidateEntry(itemId, siteId));
                    });
                }
                if (result.warnings.length) {
                    promises.push(this.glossaryProvider.getGlossary(result.itemSet.courseId, result.itemSet.instanceId, {siteId})
                            .then((glossary) => {
                        result.warnings.forEach((warning) => {
                            warnings.push(Translate.instant('core.warningofflinedatadeleted', {
                                component: this.componentTranslate,
                                name: glossary.name,
                                error: warning
                            }));
                        });
                    }));
                }
            });

            return CoreUtils.allPromises(promises).then(() => {
                return { updated, warnings };
            });
        });
    }

    /**
     * Delete a new entry.
     *
     * @param glossaryId Glossary ID.
     * @param concept Glossary entry concept.
     * @param timeCreated Time to allow duplicated entries.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when deleted.
     */
   protected deleteAddEntry(glossaryId: number, concept: string, timeCreated: number, siteId?: string): Promise<any> {
       const promises = [];

       promises.push(this.glossaryOffline.deleteNewEntry(glossaryId, concept, timeCreated, siteId));
       promises.push(this.glossaryHelper.deleteStoredFiles(glossaryId, concept, timeCreated, siteId).catch(() => {
           // Ignore errors, maybe there are no files.
       }));

       return Promise.all(promises);
   }

    /**
     * Upload attachments of an offline entry.
     *
     * @param glossaryId Glossary ID.
     * @param entry Offline entry.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with draftid if uploaded, resolved with 0 if nothing to upload.
     */
    protected uploadAttachments(glossaryId: number, entry: any, siteId?: string): Promise<number> {
        if (entry.attachments) {
            // Has some attachments to sync.
            let files = entry.attachments.online || [];
            let promise;

            if (entry.attachments.offline) {
                // Has offline files.
                promise = this.glossaryHelper.getStoredFiles(glossaryId, entry.concept, entry.timecreated, siteId).then((atts) => {
                    files = files.concat(atts);
                }).catch(() => {
                    // Folder not found, no files to add.
                });
            } else {
                promise = Promise.resolve(0);
            }

            return promise.then(() => {
                return this.uploaderProvider.uploadOrReuploadFiles(files, AddonModGlossaryProvider.COMPONENT, glossaryId, siteId);
            });
        }

        // No attachments, resolve.
        return Promise.resolve(0);
    }

    /**
     * Get the ID of a glossary sync.
     *
     * @param glossaryId Glossary ID.
     * @param userId User the entries belong to.. If not defined, current user.
     * @return Sync ID.
     */
    protected getGlossarySyncId(glossaryId: number, userId?: number): string {
        userId = userId || CoreSites.getCurrentSiteUserId();

        return 'glossary#' + glossaryId + '#' + userId;
    }
}