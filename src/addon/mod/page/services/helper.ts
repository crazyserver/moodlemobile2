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
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreFilepoolProvider } from '@services/filepool';
import { AddonModPageProvider } from './page';
import { CoreFileProvider } from '@services/file';
import { CoreSitesProvider } from '@services/sites';
import { CoreWSProvider } from '@services/ws';

/**
 * Service that provides some features for page.
 */
@Injectable({ providedIn: 'root' })
export class AddonModPageHelperProvider {

    protected logger: CoreLogger;

    constructor(
            protected domUtils: CoreDomUtilsProvider,
            protected filepoolProvider: CoreFilepoolProvider,
            protected fileProvider: CoreFileProvider,
            protected textUtils: CoreTextUtilsProvider,
            protected wsProvider: CoreWSProvider,
            protected sitesProvider: CoreSitesProvider) {
        this.logger = CoreLogger.getInstance('AddonModPageHelperProvider');
    }

    /**
     * Gets the page HTML.
     *
     * @param contents The module contents.
     * @param moduleId The module ID.
     * @return The HTML of the page.
     */
    getPageHtml(contents: any, moduleId: number): Promise<string> {
        let indexUrl,
            promise;
        const paths = {};

        // Extract the information about paths from the module contents.
        contents.forEach((content) => {
            const url = content.fileurl;

            if (this.isMainPage(content)) {
                // This seems to be the most reliable way to spot the index page.
                indexUrl = url;
            } else {
                let key = content.filename;
                if (content.filepath !== '/') {
                    // Add the folders without the leading slash.
                    key = content.filepath.substr(1) + key;
                }
                paths[CoreTextUtils.decodeURIComponent(key)] = url;
            }
        });

        // Promise handling when we are in a browser.
        if (!indexUrl) {
            // If ever that happens.
            this.logger.debug('Could not locate the index page');
            promise = Promise.reject(null);
        } else if (CoreFile.isAvailable()) {
            // The file system is available.
            promise = CoreFilepool.downloadUrl(CoreSites.getCurrentSiteId(), indexUrl, false,
                AddonModPageProvider.COMPONENT, moduleId);
        } else {
            // We return the live URL.
            promise = CoreSites.getCurrentSite().checkAndFixPluginfileURL(indexUrl);
        }

        return promise.then(async (url) => {
            const content = await this.wsProvider.getText(url);

            // Now that we have the content, we update the SRC to point back to the external resource.
            // That will be caught by core-format-text.
            return CoreDomUtils.restoreSourcesInHtml(content, paths);
        });
    }

    /**
     * Returns whether the file is the main page of the module.
     *
     * @param file An object returned from WS containing file info.
     * @return Whether the file is the main page or not.
     */
    protected isMainPage(file: any): boolean {
        const filename = file.filename || '',
            fileurl = file.fileurl || '',
            url = '/mod_page/content/index.html',
            encodedUrl = encodeURIComponent(url);

        return (filename === 'index.html' && (fileurl.indexOf(url) > 0 || fileurl.indexOf(encodedUrl) > 0 ));
    }
}