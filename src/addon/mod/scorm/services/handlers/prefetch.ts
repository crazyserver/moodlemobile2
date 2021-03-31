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

import { Injectable, Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CoreAppProvider } from '@services/app';
import { CoreFilepoolProvider } from '@services/filepool';
import { CoreSitesProvider, CoreSitesReadingStrategy } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreUtilsProvider } from '@services/utils/utils';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreFileProvider } from '@services/file';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreCourseActivityPrefetchHandlerBase } from '@core/course/classes/activity-prefetch-handler';
import { AddonModScormProvider } from './scorm';
import { AddonModScormSyncProvider } from './scorm-sync';
import { CoreFilterHelperProvider } from '@core/filter/providers/helper';
import { CorePluginFileDelegate } from '@services/plugin-file-delegate';

/**
 * Progress event used when downloading a SCORM.
 */
export interface AddonModScormProgressEvent {
    /**
     * Whether the event is due to the download of a chunk of data.
     */
    downloading?: boolean;

    /**
     * Progress event sent by the download.
     */
    progress?: ProgressEvent;

    /**
     * A message related to the progress. This is usually used to notify that a certain step of the download has started.
     */
    message?: string;
}

/**
 * Handler to prefetch SCORMs.
 */
@Injectable({ providedIn: 'root' })
export class AddonModScormPrefetchHandler extends CoreCourseActivityPrefetchHandlerBase {
    name = 'AddonModScorm';
    modName = 'scorm';
    component = AddonModScormProvider.COMPONENT;
    updatesNames = /^configuration$|^.*files$|^tracks$/;

    protected syncProvider: AddonModScormSyncProvider; // It will be injected later to prevent circular dependencies.

    constructor(translate: TranslateService,
            appProvider: CoreAppProvider,
            utils: CoreUtilsProvider,
            courseProvider: CoreCourseProvider,
            filepoolProvider: CoreFilepoolProvider,
            sitesProvider: CoreSitesProvider,
            domUtils: CoreDomUtilsProvider,
            filterHelper: CoreFilterHelperProvider,
            pluginFileDelegate: CorePluginFileDelegate,
            protected fileProvider: CoreFileProvider,
            protected textUtils: CoreTextUtilsProvider,
            protected scormProvider: AddonModScormProvider,
            protected injector: Injector) {

        super(translate, appProvider, utils, courseProvider, filepoolProvider, sitesProvider, domUtils, filterHelper,
                pluginFileDelegate);
    }

    /**
     * Download the module.
     *
     * @param module The module object returned by WS.
     * @param courseId Course ID.
     * @param dirPath Path of the directory where to store all the content files.
     * @param onProgress Function to call on progress.
     * @return Promise resolved when all content is downloaded.
     */
    download(module: any, courseId: number, dirPath?: string, onProgress?: (event: AddonModScormProgressEvent) => any)
            : Promise<any> {

        const siteId = CoreSites.getCurrentSiteId();

        return this.prefetchPackage(module, courseId, true, this.downloadOrPrefetchScorm.bind(this), siteId, false, onProgress);
    }

    /**
     * Download or prefetch a SCORM.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @param single True if we're downloading a single module, false if we're downloading a whole section.
     * @param siteId Site ID.
     * @param prefetch True to prefetch, false to download right away.
     * @param onProgress Function to call on progress.
     * @return Promise resolved with the "extra" data to store: the hash of the file.
     */
    protected downloadOrPrefetchScorm(module: any, courseId: number, single: boolean, siteId: string, prefetch: boolean,
            onProgress?: (event: AddonModScormProgressEvent) => any): Promise<string> {

        let scorm;

        return this.scormProvider.getScorm(courseId, module.id, {moduleUrl: module.url, siteId}).then((scormData) => {
            scorm = scormData;

            const promises = [],
                introFiles = this.getIntroFilesFromInstance(module, scorm);

            // Download WS data.
            promises.push(this.fetchWSData(scorm, siteId).catch(() => {
                // If prefetchData fails we don't want to fail the whole download, so we'll ignore the error for now.
                // @todo Implement a warning system so the user knows which SCORMs have failed.
            }));

            // Download the package.
            promises.push(this.downloadOrPrefetchMainFileIfNeeded(scorm, prefetch, onProgress, siteId));

            // Download intro files.
            promises.push(CoreFilepool.downloadOrPrefetchFiles(siteId, introFiles, prefetch, false, this.component,
                    module.id).catch(() => {
                // Ignore errors.
            }));

            return Promise.all(promises);
        }).then(() => {
            // Success, return the hash.
            return scorm.sha1hash;
        });
    }

    /**
     * Downloads/Prefetches and unzips the SCORM package.
     *
     * @param scorm SCORM object.
     * @param prefetch True if prefetch, false otherwise.
     * @param onProgress Function to call on progress.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the file is downloaded and unzipped.
     */
    protected downloadOrPrefetchMainFile(scorm: any, prefetch?: boolean, onProgress?: (event: AddonModScormProgressEvent) => any,
            siteId?: string): Promise<any> {

        const packageUrl = this.scormProvider.getPackageUrl(scorm);
        let dirPath;

        // Get the folder where the unzipped files will be.
        return this.scormProvider.getScormFolder(scorm.moduleurl).then((path) => {
            dirPath = path;

            // Notify that the download is starting.
            onProgress && onProgress({message: 'core.downloading'});

            // Download the ZIP file to the filepool.
            if (prefetch) {
               return CoreFilepool.addToQueueByUrl(siteId, packageUrl, this.component, scorm.coursemodule, undefined,
                        undefined, this.downloadProgress.bind(this, true, onProgress));
            } else {
                return CoreFilepool.downloadUrl(siteId, packageUrl, true, this.component, scorm.coursemodule,
                        undefined, this.downloadProgress.bind(this, true, onProgress));
            }
        }).then(() => {
            // Get the ZIP file path.
            return CoreFilepool.getFilePathByUrl(siteId, packageUrl);
        }).then((zipPath) => {
            // Notify that the unzip is starting.
            onProgress && onProgress({message: 'core.unzipping'});

            // Unzip and delete the zip when finished.
            return CoreFile.unzipFile(zipPath, dirPath, this.downloadProgress.bind(this, false, onProgress)).then(() => {
                return CoreFilepool.removeFileByUrl(siteId, packageUrl).catch(() => {
                    // Ignore errors.
                });
            });
        });
    }

    /**
     * Downloads/Prefetches and unzips the SCORM package if it should be downloaded.
     *
     * @param scorm SCORM object.
     * @param prefetch True if prefetch, false otherwise.
     * @param onProgress Function to call on progress.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the file is downloaded and unzipped.
     */
    protected downloadOrPrefetchMainFileIfNeeded(scorm: any, prefetch?: boolean,
            onProgress?: (event: AddonModScormProgressEvent) => any, siteId?: string): Promise<any> {

        siteId = siteId || CoreSites.getCurrentSiteId();

        const result = this.scormProvider.isScormUnsupported(scorm);

        if (result) {
            return Promise.reject(Translate.instant(result));
        }

        // First verify that the file needs to be downloaded.
        // It needs to be checked manually because the ZIP file is deleted after unzipped, so the filepool will always download it.
        return this.scormProvider.shouldDownloadMainFile(scorm, undefined, siteId).then((download) => {
            if (download) {
                return this.downloadOrPrefetchMainFile(scorm, prefetch, onProgress, siteId);
            }
        });
    }

    /**
     * Function that converts a regular ProgressEvent into a AddonModScormProgressEvent.
     *
     * @param downloading True when downloading, false when unzipping.
     * @param onProgress Function to call on progress.
     * @param progress Event returned by the download function.
     */
    protected downloadProgress(downloading: boolean, onProgress?: (event: AddonModScormProgressEvent) => any,
            progress?: ProgressEvent): void {

        if (onProgress && progress && progress.loaded) {
            onProgress({
                downloading: downloading,
                progress: progress
            });
        }
    }

    /**
     * Get WS data for SCORM.
     *
     * @param scorm SCORM object.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the data is prefetched.
     */
    fetchWSData(scorm: any, siteId?: string): Promise<any> {
        siteId = siteId || CoreSites.getCurrentSiteId();

        const promises = [];
        const modOptions = {
            cmId: scorm.coursemodule,
            readingStrategy: CoreSitesReadingStrategy.OnlyNetwork,
            siteId,
        };

        // Prefetch number of attempts (including not completed).
        promises.push(this.scormProvider.getAttemptCountOnline(scorm.id, modOptions).catch(() => {
            // If it fails, assume we have no attempts.
            return 0;
        }).then((numAttempts) => {
            if (numAttempts > 0) {
                // Get user data for each attempt.
                const dataPromises = [];

                for (let i = 1; i <= numAttempts; i++) {
                    dataPromises.push(this.scormProvider.getScormUserDataOnline(scorm.id, i, modOptions).catch((err) => {
                        // Ignore failures of all the attempts that aren't the last one.
                        if (i == numAttempts) {
                            return Promise.reject(err);
                        }
                    }));
                }

                return Promise.all(dataPromises);
            } else {
                // No attempts. We'll still try to get user data to be able to identify SCOs not visible and so.
                return this.scormProvider.getScormUserDataOnline(scorm.id, 0, modOptions);
            }
        }));

        // Prefetch SCOs.
        promises.push(this.scormProvider.getScos(scorm.id, modOptions));

        // Prefetch access information.
        promises.push(this.scormProvider.getAccessInformation(scorm.id, modOptions));

        return Promise.all(promises);
    }

    /**
     * Get the download size of a module.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @param single True if we're downloading a single module, false if we're downloading a whole section.
     * @return Promise resolved with the size and a boolean indicating if it was able
     *         to calculate the total size.
     */
    getDownloadSize(module: any, courseId: any, single?: boolean): Promise<{ size: number, total: boolean }> {
        return this.scormProvider.getScorm(courseId, module.id, {moduleUrl: module.url}).then((scorm) => {
            if (this.scormProvider.isScormUnsupported(scorm)) {
                return {size: -1, total: false};
            } else if (!scorm.packagesize) {
                // We don't have package size, try to calculate it.
                return this.scormProvider.calculateScormSize(scorm).then((size) => {
                    return {size: size, total: true};
                });
            } else {
                return {size: scorm.packagesize, total: true};
            }
        });
    }

    /**
     * Get the downloaded size of a module. If not defined, we'll use getFiles to calculate it (it can be slow).
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @return Size, or promise resolved with the size.
     */
    getDownloadedSize(module: any, courseId: number): number | Promise<number> {
        return this.scormProvider.getScorm(courseId, module.id, {moduleUrl: module.url}).then((scorm) => {
            // Get the folder where SCORM should be unzipped.
            return this.scormProvider.getScormFolder(scorm.moduleurl);
        }).then((path) => {
            return CoreFile.getDirectorySize(path);
        });
    }

    /**
     * Get list of files. If not defined, we'll assume they're in module.contents.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @param single True if we're downloading a single module, false if we're downloading a whole section.
     * @return Promise resolved with the list of files.
     */
    getFiles(module: any, courseId: number, single?: boolean): Promise<any[]> {
        return this.scormProvider.getScorm(courseId, module.id, {moduleUrl: module.url}).then((scorm) => {
            return this.scormProvider.getScormFileList(scorm);
        }).catch(() => {
            // SCORM not found, return empty list.
            return [];
        });
    }

    /**
     * Invalidate the prefetched content.
     *
     * @param moduleId The module ID.
     * @param courseId The course ID the module belongs to.
     * @return Promise resolved when the data is invalidated.
     */
    invalidateContent(moduleId: number, courseId: number): Promise<any> {
        return this.scormProvider.invalidateContent(moduleId, courseId);
    }

    /**
     * Invalidate WS calls needed to determine module status.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @return Promise resolved when invalidated.
     */
    invalidateModule(module: any, courseId: number): Promise<any> {
        // Invalidate the calls required to check if a SCORM is downloadable.
        return this.scormProvider.invalidateScormData(courseId);
    }

    /**
     * Check if a module can be downloaded. If the function is not defined, we assume that all modules are downloadable.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @return Whether the module can be downloaded. The promise should never be rejected.
     */
    isDownloadable(module: any, courseId: number): boolean | Promise<boolean> {
        return this.scormProvider.getScorm(courseId, module.id, {moduleUrl: module.url}).then((scorm) => {
            if (scorm.warningMessage) {
                // SCORM closed or not opened yet.
                return false;
            }

            if (this.scormProvider.isScormUnsupported(scorm)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Prefetch a module.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @param single True if we're downloading a single module, false if we're downloading a whole section.
     * @param dirPath Path of the directory where to store all the content files.
     * @param onProgress Function to call on progress.
     * @return Promise resolved when done.
     */
    prefetch(module: any, courseId?: number, single?: boolean, dirPath?: string,
            onProgress?: (event: AddonModScormProgressEvent) => any): Promise<any> {

        const siteId = CoreSites.getCurrentSiteId();

        return this.prefetchPackage(module, courseId, single, this.downloadOrPrefetchScorm.bind(this), siteId, true, onProgress);
    }

    /**
     * Remove module downloaded files. If not defined, we'll use getFiles to remove them (slow).
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @return Promise resolved when done.
     */
    removeFiles(module: any, courseId: number): Promise<any> {
        const siteId = CoreSites.getCurrentSiteId();
        let scorm;

        return this.scormProvider.getScorm(courseId, module.id, {moduleUrl: module.url, siteId}).then((scormData) => {
            scorm = scormData;

            // Get the folder where SCORM should be unzipped.
            return this.scormProvider.getScormFolder(scorm.moduleurl);
        }).then((path) => {
            const promises = [];

            // Remove the unzipped folder.
            promises.push(CoreFile.removeDir(path).catch((error) => {
                if (error && (error.code == 1 || !CoreApp.isMobile())) {
                    // Not found, ignore error.
                } else {
                    return Promise.reject(error);
                }
            }));

            // Delete other files.
            promises.push(CoreFilepool.removeFilesByComponent(siteId, this.component, module.id));

            return Promise.all(promises);
        });
    }

    /**
     * Sync a module.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when done.
     */
    sync(module: any, courseId: number, siteId?: any): Promise<any> {
        if (!this.syncProvider) {
            this.syncProvider = this.injector.get(AddonModScormSyncProvider);
        }

        return this.scormProvider.getScorm(courseId, module.id, {moduleUrl: module.url, siteId}).then((scorm) => {
            return this.syncProvider.syncScorm(scorm, siteId);
        });
    }
}