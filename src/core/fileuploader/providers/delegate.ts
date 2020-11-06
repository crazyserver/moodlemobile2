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
import { CoreEvents } from '@singletons/events';
import { CoreLogger } from '@singletons/logger';
import { CoreSitesProvider } from '@services/sites';
import { CoreDelegate, CoreDelegateHandler } from '@classes/delegate';

/**
 * Interface that all handlers must implement.
 */
export interface CoreFileUploaderHandler extends CoreDelegateHandler {
    /**
     * Handler's priority. The highest priority, the highest position.
     */
    priority?: number;

    /**
     * Given a list of mimetypes, return the ones that are supported by the handler.
     *
     * @param mimetypes List of mimetypes.
     * @return Supported mimetypes.
     */
    getSupportedMimetypes(mimetypes: string[]): string[];

    /**
     * Get the data to display the handler.
     *
     * @return Data.
     */
    getData(): CoreFileUploaderHandlerData;
}

/**
 * Data needed to render the handler in the file picker. It must be returned by the handler.
 */
export interface CoreFileUploaderHandlerData {
    /**
     * The title to display in the handler.
     */
    title: string;

    /**
     * The icon to display in the handler.
     */
    icon?: string;

    /**
     * The class to assign to the handler item.
     */
    class?: string;

    /**
     * Action to perform when the handler is clicked.
     *
     * @param maxSize Max size of the file. If not defined or -1, no max size.
     * @param upload Whether the file should be uploaded.
     * @param allowOffline True to allow selecting in offline, false to require connection.
     * @param mimetypes List of supported mimetypes. If undefined, all mimetypes supported.
     * @return Promise resolved with the result of picking/uploading the file.
     */
    action?(maxSize?: number, upload?: boolean, allowOffline?: boolean, mimetypes?: string[])
        : Promise<CoreFileUploaderHandlerResult>;

    /**
     * Function called after the handler is rendered.
     *
     * @param maxSize Max size of the file. If not defined or -1, no max size.
     * @param upload Whether the file should be uploaded.
     * @param allowOffline True to allow selecting in offline, false to require connection.
     * @param mimetypes List of supported mimetypes. If undefined, all mimetypes supported.
     */
    afterRender?(maxSize: number, upload: boolean, allowOffline: boolean, mimetypes: string[]): void;
}

/**
 * The result of clicking a handler.
 */
export interface CoreFileUploaderHandlerResult {
    /**
     * Whether the file was treated (uploaded or copied to tmp folder).
     */
    treated: boolean;

    /**
     * The path of the file picked. Required if treated=false and fileEntry is not set.
     */
    path?: string;

    /**
     * The fileEntry of the file picked. Required if treated=false and path is not set.
     */
    fileEntry?: any;

    /**
     * Whether the file should be deleted after the upload. Ignored if treated=true.
     */
    delete?: boolean;

    /**
     * The result of picking/uploading the file. Ignored if treated=false.
     */
    result?: any;
}

/**
 * Data returned by the delegate for each handler.
 */
export interface CoreFileUploaderHandlerDataToReturn extends CoreFileUploaderHandlerData {
    /**
     * Handler's priority.
     */
    priority?: number;

    /**
     * Supported mimetypes.
     */
    mimetypes?: string[];
}

/**
 * Delegate to register handlers to be shown in the file picker.
 */
@Injectable()
export class CoreFileUploaderDelegate extends CoreDelegate {
    constructor(protected sitesProvider: CoreSitesProvider,
           ) {
        super('CoreFileUploaderDelegate', loggerProvider, sitesProvider, eventsProvider);

        CoreEvents.on(CoreEvents.LOGOUT, this.clearSiteHandlers.bind(this));
    }

    /**
     * Clear current site handlers. Reserved for core use.
     */
    protected clearSiteHandlers(): void {
        this.enabledHandlers = {};
    }

    /**
     * Get the handlers for the current site.
     *
     * @param mimetypes List of supported mimetypes. If undefined, all mimetypes supported.
     * @return List of handlers data.
     */
    getHandlers(mimetypes: string[]): CoreFileUploaderHandlerDataToReturn[] {
        const handlers = [];

        for (const name in this.enabledHandlers) {
            const handler = <CoreFileUploaderHandler> this.enabledHandlers[name];
            let supportedMimetypes;

            if (mimetypes) {
                if (!handler.getSupportedMimetypes) {
                    // Handler doesn't implement a required function, don't add it.
                    continue;
                }

                supportedMimetypes = handler.getSupportedMimetypes(mimetypes);

                if (!supportedMimetypes.length) {
                    // Handler doesn't support any mimetype, don't add it.
                    continue;
                }
            }

            const data: CoreFileUploaderHandlerDataToReturn = handler.getData();
            data.priority = handler.priority;
            data.mimetypes = supportedMimetypes;
            handlers.push(data);
        }

        return handlers;
    }
}
