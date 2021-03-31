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
import { CoreFileProvider } from '@services/file';
import { CoreSitesProvider, CoreSiteSchema } from '@services/sites';
import { CoreUtilsProvider } from '@services/utils/utils';
import { CoreTextUtilsProvider } from '@services/utils/text';

/**
 * Service to handle offline glossary.
 */
@Injectable({ providedIn: 'root' })
export class AddonModGlossaryOfflineProvider {

    // Variables for database.
    static readonly ENTRIES_TABLE = 'addon_mod_glossary_entrues';

    protected siteSchema: CoreSiteSchema = {
        name: 'AddonModGlossaryOfflineProvider',
        version: 1,
        tables: [
            {
                name: AddonModGlossaryOfflineProvider.ENTRIES_TABLE,
                columns: [
                    {
                        name: 'glossaryid',
                        type: 'INTEGER',
                    },
                    {
                        name: 'courseid',
                        type: 'INTEGER',
                    },
                    {
                        name: 'concept',
                        type: 'TEXT',
                    },
                    {
                        name: 'definition',
                        type: 'TEXT',
                    },
                    {
                        name: 'definitionformat',
                        type: 'TEXT',
                    },
                    {
                        name: 'userid',
                        type: 'INTEGER',
                    },
                    {
                        name: 'timecreated',
                        type: 'INTEGER',
                    },
                    {
                        name: 'options',
                        type: 'TEXT',
                    },
                    {
                        name: 'attachments',
                        type: 'TEXT',
                    },
                ],
                primaryKeys: ['glossaryid', 'concept', 'timecreated']
            }
        ]
    };

    constructor(private fileProvider: CoreFileProvider,
            private sitesProvider: CoreSitesProvider,
            private textUtils: CoreTextUtilsProvider,
            private utils: CoreUtilsProvider) {
        CoreSites.registerSiteSchema(this.siteSchema);
    }

    /**
     * Delete a new entry.
     *
     * @param glossaryId Glossary ID.
     * @param concept Glossary entry concept.
     * @param timeCreated The time the entry was created.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved if deleted, rejected if failure.
     */
    deleteNewEntry(glossaryId: number, concept: string, timeCreated: number, siteId?: string): Promise<any> {
        return CoreSites.getSite(siteId).then((site) => {
            const conditions = {
                glossaryid: glossaryId,
                concept: concept,
                timecreated: timeCreated,
            };

            return site.getDb().deleteRecords(AddonModGlossaryOfflineProvider.ENTRIES_TABLE, conditions);
        });
    }

    /**
     * Get all the stored new entries from all the glossaries.
     *
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with entries.
     */
    getAllNewEntries(siteId?: string): Promise<any[]> {
        return CoreSites.getSite(siteId).then((site) => {
            return site.getDb().getRecords(AddonModGlossaryOfflineProvider.ENTRIES_TABLE).then((records: any[]) => {
                return records.map(this.parseRecord.bind(this));
            });
        });
    }

    /**
     * Get a stored new entry.
     *
     * @param glossaryId Glossary ID.
     * @param concept Glossary entry concept.
     * @param timeCreated The time the entry was created.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with entry.
     */
    getNewEntry(glossaryId: number, concept: string, timeCreated: number, siteId?: string): Promise<any> {
        return CoreSites.getSite(siteId).then((site) => {
            const conditions = {
                glossaryid: glossaryId,
                concept: concept,
                timecreated: timeCreated,
            };

            return site.getDb().getRecord(AddonModGlossaryOfflineProvider.ENTRIES_TABLE, conditions)
                    .then(this.parseRecord.bind(this));
        });
    }

    /**
     * Get all the stored add entry data from a certain glossary.
     *
     * @param glossaryId Glossary ID.
     * @param siteId Site ID. If not defined, current site.
     * @param userId User the entries belong to. If not defined, current user in site.
     * @return Promise resolved with entries.
     */
    getGlossaryNewEntries(glossaryId: number, siteId?: string, userId?: number): Promise<any[]> {
        return CoreSites.getSite(siteId).then((site) => {
            const conditions = {
                glossaryid: glossaryId,
                userId: userId || site.getUserId(),
            };

            return site.getDb().getRecords(AddonModGlossaryOfflineProvider.ENTRIES_TABLE, conditions).then((records: any[]) => {
                return records.map(this.parseRecord.bind(this));
            });
        });
    }

    /**
     * Check if a concept is used offline.
     *
     * @param glossaryId Glossary ID.
     * @param concept Concept to check.
     * @param timeCreated Time of the entry we are editing.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with true if concept is found, false otherwise.
     */
    isConceptUsed(glossaryId: number, concept: string, timeCreated?: number, siteId?: string): Promise<boolean> {
        return CoreSites.getSite(siteId).then((site) => {
            const conditions = {
                glossaryid: glossaryId,
                concept: concept,
            };

            return site.getDb().getRecords(AddonModGlossaryOfflineProvider.ENTRIES_TABLE, conditions).then((entries) => {
                if (!entries.length) {
                    return false;
                }

                if (entries.length > 1 || !timeCreated) {
                    return true;
                }

                // If there's only one entry, check that is not the one we are editing.
                return CoreUtils.promiseFails(this.getNewEntry(glossaryId, concept, timeCreated, siteId));
            });
        }).catch(() => {
            // No offline data found, return false.
            return false;
        });
    }

    /**
     * Save a new entry to be sent later.
     *
     * @param glossaryId Glossary ID.
     * @param concept Glossary entry concept.
     * @param definition Glossary entry concept definition.
     * @param courseId Course ID of the glossary.
     * @param options Options for the entry.
     * @param attachments Result of CoreFileUploaderProvider#storeFilesToUpload for attachments.
     * @param timeCreated The time the entry was created. If not defined, current time.
     * @param siteId Site ID. If not defined, current site.
     * @param userId User the entry belong to. If not defined, current user in site.
     * @param discardEntry The entry provided will be discarded if found.
     * @return Promise resolved if stored, rejected if failure.
     */
    addNewEntry(glossaryId: number, concept: string, definition: string, courseId: number, options?: any, attachments?: any,
            timeCreated?: number, siteId?: string, userId?: number, discardEntry?: any): Promise<false> {
        return CoreSites.getSite(siteId).then((site) => {
            const entry = {
                glossaryid: glossaryId,
                courseid: courseId,
                concept: concept,
                definition: definition,
                definitionformat: 'html',
                options: JSON.stringify(options),
                attachments: JSON.stringify(attachments),
                userid: userId || site.getUserId(),
                timecreated: timeCreated || new Date().getTime()
            };

            // If editing an offline entry, delete previous first.
            let discardPromise;
            if (discardEntry) {
                discardPromise = this.deleteNewEntry(glossaryId, discardEntry.concept, discardEntry.timecreated, site.getId());
            } else {
                discardPromise = Promise.resolve();
            }

            return discardPromise.then(() => {
                return site.getDb().insertRecord(AddonModGlossaryOfflineProvider.ENTRIES_TABLE, entry).then(() => false);
            });
        });
    }

    /**
     * Get the path to the folder where to store files for offline attachments in a glossary.
     *
     * @param glossaryId Glossary ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the path.
     */
    getGlossaryFolder(glossaryId: number, siteId?: string): Promise<string> {
        return CoreSites.getSite(siteId).then((site) => {
            const siteFolderPath = CoreFile.getSiteFolder(site.getId());
            const folderPath = 'offlineglossary/' + glossaryId;

            return CoreTextUtils.concatenatePaths(siteFolderPath, folderPath);
        });
    }

    /**
     * Get the path to the folder where to store files for a new offline entry.
     *
     * @param glossaryId Glossary ID.
     * @param concept The name of the entry.
     * @param timeCreated Time to allow duplicated entries.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with the path.
     */
    getEntryFolder(glossaryId: number, concept: string, timeCreated: number, siteId?: string): Promise<string> {
        return this.getGlossaryFolder(glossaryId, siteId).then((folderPath) => {
            return CoreTextUtils.concatenatePaths(folderPath, 'newentry_' + concept + '_' + timeCreated);
        });
    }

    /**
     * Parse "options" and "attachments" columns of a fetched record.
     *
     * @param records Record object
     * @return Record object with columns parsed.
     */
    protected parseRecord(record: any): any {
        record.options = CoreTextUtils.parseJSON(record.options);
        record.attachments = CoreTextUtils.parseJSON(record.attachments);

        return record;
    }
}