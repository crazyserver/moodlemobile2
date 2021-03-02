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

import { AddonModAssignSubmissionPluginComponent } from '@addons/mod/assign/components/submission-plugin/submission-plugin';
import { AddonModAssign, AddonModAssignProvider } from '@addons/mod/assign/services/assign';
import { AddonModAssignHelper } from '@addons/mod/assign/services/assign-helper';
import { AddonModAssignOffline } from '@addons/mod/assign/services/assign-offline';
import { Component, OnInit } from '@angular/core';
import { CoreFileUploaderStoreFilesResult } from '@features/fileuploader/services/fileuploader';
import { CoreFileSession } from '@services/file-session';
import { CoreUtils } from '@services/utils/utils';
import { AddonModAssignSubmissionFileHandlerService } from '../services/handler';
import { FileEntry } from '@ionic-native/file/ngx';

/**
 * Component to render a file submission plugin.
 */
@Component({
    selector: 'addon-mod-assign-submission-file',
    templateUrl: 'addon-mod-assign-submission-file.html',
})
export class AddonModAssignSubmissionFileComponent extends AddonModAssignSubmissionPluginComponent implements OnInit {

    component = AddonModAssignProvider.COMPONENT;

    maxSize?: number;
    acceptedTypes?: string;
    maxSubmissions?: number;

    /**
     * Component being initialized.
     */
    async ngOnInit(): Promise<void> {
        // Get the offline data.
        const filesData = await CoreUtils.instance.ignoreErrors(
            AddonModAssignOffline.instance.getSubmission(this.assign.id),
            undefined,
        );

        this.acceptedTypes = this.data?.configs.filetypeslist;
        this.maxSize = this.data?.configs.maxsubmissionsizebytes
            ? parseInt(this.data?.configs.maxsubmissionsizebytes, 10)
            : undefined;
        this.maxSubmissions = this.data?.configs.maxfilesubmissions
            ? parseInt(this.data?.configs.maxfilesubmissions, 10)
            : undefined;

        try {
            if (filesData && filesData.plugindata && filesData.plugindata.files_filemanager) {
                const offlineDataFiles = <CoreFileUploaderStoreFilesResult>filesData.plugindata.files_filemanager;
                // It has offline data.
                let offlineFiles: FileEntry[] = [];
                if (offlineDataFiles.offline) {
                    offlineFiles = <FileEntry[]>await CoreUtils.instance.ignoreErrors(
                        AddonModAssignHelper.instance.getStoredSubmissionFiles(
                            this.assign.id,
                            AddonModAssignSubmissionFileHandlerService.FOLDER_NAME,
                        ),
                        [],
                    );
                }

                this.files = offlineDataFiles.online || [];
                this.files = this.files.concat(offlineFiles);
            } else {
                // No offline data, get the online files.
                this.files = AddonModAssign.instance.getSubmissionPluginAttachments(this.plugin);
            }
        } finally  {
            CoreFileSession.instance.setFiles(this.component, this.assign.id, this.files);
        }
    }

}