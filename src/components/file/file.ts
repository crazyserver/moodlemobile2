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

import { Component, Input, Output, OnInit, OnDestroy, EventEmitter } from '@angular/core';
import { CoreAppProvider } from '@services/app';
import { CoreEvents } from '@singletons/events';
import { CoreFilepoolProvider } from '@services/filepool';
import { CoreFileHelperProvider } from '@services/file-helper';
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreMimetypeUtilsProvider } from '@services/utils/mimetype';
import { CoreUrlUtilsProvider } from '@services/utils/url';
import { CoreUtilsProvider } from '@services/utils/utils';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreConstants } from '@core/constants';
import { CorePluginFileDelegate } from '@services/plugin-file-delegate';

/**
 * Component to handle a remote file. Shows the file name, icon (depending on mimetype) and a button
 * to download/refresh it.
 */
@Component({
    selector: 'core-file',
    templateUrl: 'core-file.html'
})
export class CoreFileComponent implements OnInit, OnDestroy {
    @Input() file: any; // The file. Must have a property 'filename' and a 'fileurl' or 'url'
    @Input() component?: string; // Component the file belongs to.
    @Input() componentId?: string | number; // Component ID.
    @Input() canDelete?: boolean | string; // Whether file can be deleted.
    @Input() alwaysDownload?: boolean | string; // Whether it should always display the refresh button when the file is downloaded.
                                                // Use it for files that you cannot determine if they're outdated or not.
    @Input() canDownload?: boolean | string = true; // Whether file can be downloaded.
    @Input() showSize?: boolean | string = true; // Whether show filesize.
    @Input() showTime?: boolean | string = true; // Whether show file time modified.
    @Output() onDelete?: EventEmitter<void>; // Will notify when the delete button is clicked.

    isDownloading: boolean;
    fileIcon: string;
    fileName: string;
    fileSizeReadable: string;

    protected fileUrl: string;
    protected siteId: string;
    protected fileSize: number;
    protected state: string;
    protected timemodified: number;
    protected observer;

    constructor(protected sitesProvider: CoreSitesProvider,
            protected utils: CoreUtilsProvider,
            protected domUtils: CoreDomUtilsProvider,
            protected filepoolProvider: CoreFilepoolProvider,
            protected appProvider: CoreAppProvider,
            protected fileHelper: CoreFileHelperProvider,
            protected mimeUtils: CoreMimetypeUtilsProvider,

            protected textUtils: CoreTextUtilsProvider,
            protected pluginFileDelegate: CorePluginFileDelegate,
            protected urlUtils: CoreUrlUtilsProvider) {
        this.onDelete = new EventEmitter();
    }

    /**
     * Component being initialized.
     */
    ngOnInit(): void {
        this.canDelete = CoreUtils.isTrueOrOne(this.canDelete);
        this.alwaysDownload = CoreUtils.isTrueOrOne(this.alwaysDownload);
        this.canDownload = CoreUtils.isTrueOrOne(this.canDownload);

        this.fileUrl = this.fileHelper.getFileUrl(this.file);
        this.timemodified = this.fileHelper.getFileTimemodified(this.file);
        this.siteId = CoreSites.getCurrentSiteId();
        this.fileSize = this.file.filesize;
        this.fileName = this.file.filename;

        if (CoreUtils.isTrueOrOne(this.showSize) && this.fileSize >= 0) {
            this.fileSizeReadable = CoreTextUtils.bytesToSize(this.fileSize, 2);
        }

        this.showTime = CoreUtils.isTrueOrOne(this.showTime) && this.timemodified > 0;

        if (this.file.isexternalfile) {
            this.alwaysDownload = true; // Always show the download button in external files.
        }

        this.fileIcon = this.mimeUtils.getFileIcon(this.file.filename);

        if (this.canDownload) {
            this.calculateState();

            // Update state when receiving events about this file.
            CoreFilepool.getFileEventNameByUrl(this.siteId, this.fileUrl).then((eventName) => {
                this.observer = CoreEvents.on(eventName, () => {
                    this.calculateState();
                });
            }).catch(() => {
                // File not downloadable.
            });
        }
    }

    /**
     * Convenience function to get the file state and set variables based on it.
     *
     * @return Promise resolved when state has been calculated.
     */
    protected calculateState(): Promise<void> {
        return CoreFilepool.getFileStateByUrl(this.siteId, this.fileUrl, this.timemodified).then((state) => {
            this.canDownload = CoreSites.getCurrentSite().canDownloadFiles();

            this.state = state;
            this.isDownloading = this.canDownload && state === CoreConstants.DOWNLOADING;
        });
    }

    /**
     * Convenience function to open a file, downloading it if needed.
     *
     * @return Promise resolved when file is opened.
     */
    protected openFile(): Promise<any> {
        return this.fileHelper.downloadAndOpenFile(this.file, this.component, this.componentId, this.state, (event) => {
            if (event && event.calculating) {
                // The process is calculating some data required for the download, show the spinner.
                this.isDownloading = true;
            }
        }).catch((error) => {
            CoreDomUtils.showErrorModalDefault(error, 'core.errordownloading', true);
        });
    }

    /**
     * Download a file and, optionally, open it afterwards.
     *
     * @param e Click event.
     * @param openAfterDownload Whether the file should be opened after download.
     */
    async download(e?: Event, openAfterDownload: boolean = false): Promise<void> {
        e && e.preventDefault();
        e && e.stopPropagation();

        if (this.isDownloading && !openAfterDownload) {
            return;
        }

        if (!this.canDownload || !this.state || this.state == CoreConstants.NOT_DOWNLOADABLE) {
            // File cannot be downloaded, just open it.
            if (this.file.toURL) {
                // Local file.
                CoreUtils.openFile(this.file.toURL());
            } else if (this.fileUrl) {
                if (this.urlUtils.isLocalFileUrl(this.fileUrl)) {
                    CoreUtils.openFile(this.fileUrl);
                } else {
                    CoreUtils.openOnlineFile(this.urlUtils.unfixPluginfileURL(this.fileUrl));
                }
            }

            return;
        }

        if (!CoreApp.isOnline() && (!openAfterDownload || (openAfterDownload &&
                !this.fileHelper.isStateDownloaded(this.state)))) {
            CoreDomUtils.showErrorModal('core.networkerrormsg', true);

            return;
        }

        if (openAfterDownload) {
            // File needs to be opened now.
            try {
                await this.openFile();
            } catch (error) {
                CoreDomUtils.showErrorModalDefault(error, 'core.errordownloading', true);
            }
        } else {
            // File doesn't need to be opened (it's a prefetch).
            if (!this.fileHelper.isOpenableInApp(this.file)) {
                try {
                    await this.fileHelper.showConfirmOpenUnsupportedFile(true);
                } catch (error) {
                    return; // Cancelled, stop.
                }
            }

            try {
                // Show confirm modal if file size is defined and it's big.
                const size = await this.pluginFileDelegate.getFileSize({fileurl: this.fileUrl, filesize: this.fileSize},
                        this.siteId);

                if (size) {
                    await CoreDomUtils.confirmDownloadSize({ size: size, total: true });
                }

                // User confirmed, add the file to queue.
                await CoreUtils.ignoreErrors(CoreFilepool.invalidateFileByUrl(this.siteId, this.fileUrl));

                this.isDownloading = true;

                try {
                    await CoreFilepool.addToQueueByUrl(this.siteId, this.fileUrl, this.component,
                            this.componentId, this.timemodified, undefined, undefined, 0, this.file);
                } catch (error) {
                    CoreDomUtils.showErrorModalDefault(error, 'core.errordownloading', true);
                    this.calculateState();
                }
            } catch (error) {
                CoreDomUtils.showErrorModalDefault(error, 'core.errordownloading', true);
            }
        }
    }

    /**
     * Delete the file.
     *
     * @param e Click event.
     */
    delete(e: Event): void {
        e.preventDefault();
        e.stopPropagation();

        if (this.canDelete) {
            this.onDelete.emit();
        }
    }

    /**
     * Component destroyed.
     */
    ngOnDestroy(): void {
        this.observer && this.observer.off();
    }
}
