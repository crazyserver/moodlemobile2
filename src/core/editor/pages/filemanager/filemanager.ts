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

import { Component } from '@angular/core';
import { IonicPage, NavParams, ViewController } from 'ionic-angular';
import { TranslateService } from '@ngx-translate/core';
import { CoreFilepoolProvider } from '@providers/filepool';
import { AddonFilesProvider, AddonFilesFile } from '@addon/files/providers/files';
import { CoreUrlUtils } from '@providers/utils/url';

/**
 * Page that displays the list of files.
 */
@IonicPage({ segment: 'core-editor-file-manager' })
@Component({
    selector: 'page-core-editor-file-manager',
    templateUrl: 'filemanager.html',
})
export class CoreEditorFileManagerPage {

    title: string; // Page title.
    files: AddonFilesFile[]; // List of files.
    options: any;

    constructor(
            navParams: NavParams,
            protected translate: TranslateService,
            protected viewCtrl: ViewController,
            ) {
        this.title = navParams.get('title') || this.translate.instant('addon.files.files');
        this.options = navParams.get('options');
        this.files = this.treatFiles(navParams.get('editorElement'));

    }

    /**
     * Fetch the files.
     *
     * @param  editorElement Editor Element. To find and identify files.
     * @return Promise resolved when done.
     */
    protected treatFiles(editorElement: HTMLElement): AddonFilesFile[] {
        const fileElements = Array.from(editorElement.querySelectorAll('[src], [href]'));

        const urlUtilsInstance = CoreUrlUtils.instance;

        const urls = fileElements.map((element) => {
            return element.getAttribute('data-original-src') || element.getAttribute('src') || element.getAttribute('href');
        }).filter((url) => {
            return urlUtilsInstance.isPluginFileUrl(url);
        });

        return urls.map((url) => {
            const args = CoreFilepoolProvider.getPluginFileArgs(url);

            const contextId = args.shift();
            const component = args.shift();
            const filearea = args.shift();
            const itemId = args.shift();
            const filename = args.pop();
            const filepath = args.join('/');

            const file: AddonFilesFile = {
                contextid: parseInt(contextId, 0) || 0,
                component: 'user',
                filearea: 'draft',
                itemid: parseInt(itemId, 0) || 0,
                filepath: filepath || '/',
                filename: filename,
                isdir: false,
                url: url,
                timemodified: 0,
            };

            return file;
        });
    }

    /**
     * Close the modal.
     */
    closeModal(): void {
        this.viewCtrl.dismiss(this.files);
    }
}
