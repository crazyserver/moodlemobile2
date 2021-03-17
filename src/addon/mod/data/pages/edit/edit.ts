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

import { Component, ViewChild, ElementRef } from '@angular/core';
import { Content, NavParams, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { FormGroup } from '@angular/forms';
import { CoreUtilsProvider } from '@services/utils/utils';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreSitesProvider } from '@services/sites';
import { CoreGroupsProvider } from '@services/groups';
import { CoreEvents } from '@singletons/events';
import { CoreFileUploaderProvider } from '@core/fileuploader/providers/fileuploader';
import { CoreCourseProvider } from '@core/course/providers/course';
import { AddonModDataProvider } from '../../providers/data';
import { AddonModDataHelperProvider } from '../../providers/helper';
import { AddonModDataOfflineProvider } from '../../providers/offline';
import { AddonModDataFieldsDelegate } from '../../providers/fields-delegate';
import { AddonModDataComponentsModule } from '../../components/components.module';
import { CoreTagProvider } from '@core/tag/providers/tag';

/**
 * Page that displays the view edit page.
 */
@Component({
    selector: 'page-addon-mod-data-edit',
    templateUrl: 'edit.html',
})
export class AddonModDataEditPage {
    @ViewChild(Content) content: Content;
    @ViewChild('editFormEl') formElement: ElementRef;

    protected module: any;
    protected courseId: number;
    protected data: any;
    protected entryId: number;
    protected entry: any;
    protected fields = {};
    protected fieldsArray = [];
    protected siteId: string;
    protected offline: boolean;
    protected forceLeave = false; // To allow leaving the page without checking for changes.
    protected initialSelectedGroup = null;
    protected isEditing = false;

    title = '';
    component = AddonModDataProvider.COMPONENT;
    loaded = false;
    selectedGroup = 0;
    cssClass = '';
    groupInfo: any;
    editFormRender = '';
    editForm: FormGroup;
    extraImports = [AddonModDataComponentsModule];
    jsData: any;
    errors = {};

    constructor(params: NavParams, protected utils: CoreUtilsProvider, protected groupsProvider: CoreGroupsProvider,
            protected domUtils: CoreDomUtilsProvider, protected fieldsDelegate: AddonModDataFieldsDelegate,
            protected courseProvider: CoreCourseProvider, protected dataProvider: AddonModDataProvider,
            protected dataOffline: AddonModDataOfflineProvider, protected dataHelper: AddonModDataHelperProvider,
            sitesProvider: CoreSitesProvider, protected navCtrl: NavController, protected translate: TranslateService,
            protected fileUploaderProvider: CoreFileUploaderProvider,
            private tagProvider: CoreTagProvider) {
        this.module = params.get('module') || {};
        this.entryId = params.get('entryId') || null;
        this.courseId = params.get('courseId');
        this.selectedGroup = this.entryId ? null : (params.get('group') || 0);

        // If entryId is lower than 0 or null, it is a new entry or an offline entry.
        this.isEditing = this.entryId && this.entryId > 0;

        this.siteId = sitesProvider.getCurrentSiteId();

        this.title = this.module.name;

        this.editForm = new FormGroup({});
    }

    /**
     * View loaded.
     */
    ngOnInit(): void {
        this.fetchEntryData(true);
    }

    /**
     * Check if we can leave the page or not and ask to confirm the lost of data.
     *
     * @return Resolved if we can leave it, rejected if not.
     */
    async ionViewCanLeave(): Promise<void> {
        if (this.forceLeave || !this.entry) {
            return;
        }

        const inputData = this.editForm.value;

        let changed = await AddonModDataHelper.hasEditDataChanged(inputData, this.fieldsArray, this.data.id, this.entry.contents);
        changed = changed || (!this.isEditing && this.initialSelectedGroup != this.selectedGroup);

        if (changed) {
            // Show confirmation if some data has been modified.
            await CoreDomUtils.showConfirm(Translate.instant('core.confirmcanceledit'));
        }

        // Delete the local files from the tmp folder.
        const files = await AddonModDataHelper.getEditTmpFiles(inputData, this.fieldsArray, this.data.id, this.entry.contents);
        CoreFileUploader.clearTmpFiles(files);

        CoreDomUtils.triggerFormCancelledEvent(this.formElement, this.siteId);
    }

    /**
     * Fetch the entry data.
     *
     * @param [refresh] To refresh all downloaded data.
     * @return Resolved when done.
     */
    protected async fetchEntryData(refresh: boolean = false): Promise<void> {
        try {
            this.data = await AddonModData.getDatabase(this.courseId, this.module.id);
            this.title = this.data.name || this.title;
            this.cssClass = 'addon-data-entries-' + this.data.id;

            this.fieldsArray = await AddonModData.getFields(this.data.id, {cmId: this.module.id});
            this.fields = CoreUtils.arrayToObject(this.fieldsArray, 'id');

            const entry = await AddonModDataHelper.fetchEntry(this.data, this.fieldsArray, this.entryId);

            this.entry = entry.entry;

            // Load correct group.
            this.selectedGroup = this.selectedGroup == null ? this.entry.groupid : this.selectedGroup;

            // Check permissions when adding a new entry or offline entry.
            if (!this.isEditing) {
                let haveAccess = false;

                if (refresh) {
                    this.groupInfo = await CoreGroups.getActivityGroupInfo(this.data.coursemodule);
                    this.selectedGroup = CoreGroups.validateGroupId(this.selectedGroup, this.groupInfo);
                    this.initialSelectedGroup = this.selectedGroup;
                }

                if (this.groupInfo.groups.length > 0) {
                    if (refresh) {
                        const canAddGroup = {};

                        await Promise.all(this.groupInfo.groups.map(async (group) => {
                            const accessData = await AddonModData.getDatabaseAccessInformation(this.data.id, {
                                cmId: this.module.id, groupId: group.id});

                            canAddGroup[group.id] = accessData.canaddentry;
                        }));

                        this.groupInfo.groups = this.groupInfo.groups.filter((group) => {
                            return !!canAddGroup[group.id];
                        });

                        haveAccess = canAddGroup[this.selectedGroup];
                    } else {
                        // Groups already filtered, so it have access.
                        haveAccess = true;
                    }
                } else {
                    const accessData = await AddonModData.getDatabaseAccessInformation(this.data.id, {cmId: this.module.id});
                    haveAccess = accessData.canaddentry;
                }

                if (!haveAccess) {
                    // You shall not pass, go back.
                    CoreDomUtils.showErrorModal('addon.mod_data.noaccess', true);

                    // Go back to entry list.
                    this.forceLeave = true;
                    this.navCtrl.pop();

                    return;
                }
            }

            this.editFormRender = this.displayEditFields();
        } catch (message) {
            CoreDomUtils.showErrorModalDefault(message, 'core.course.errorgetmodule', true);
        }

        this.loaded = true;
    }

    /**
     * Saves data.
     *
     * @param e Event.
     * @return Resolved when done.
     */
    save(e: Event): Promise<void> {
        e.preventDefault();
        e.stopPropagation();

        const inputData = this.editForm.value;

        return AddonModDataHelper.hasEditDataChanged(inputData, this.fieldsArray, this.data.id,
                this.entry.contents).then((changed) => {

            changed = changed || (!this.isEditing && this.initialSelectedGroup != this.selectedGroup);
            if (!changed) {
                if (this.entryId) {
                    return this.returnToEntryList();
                }

                // New entry, no changes means no field filled, warn the user.
                return Promise.reject('addon.mod_data.emptyaddform');
            }

            const modal = CoreDomUtils.showModalLoading('core.sending', true);

            // Create an ID to assign files.
            const entryTemp = this.entryId ? this.entryId : - (new Date().getTime());

            return AddonModDataHelper.getEditDataFromForm(inputData, this.fieldsArray, this.data.id, entryTemp, this.entry.contents,
                this.offline).catch((e) => {
                    if (!this.offline) {
                        // Cannot submit in online, prepare for offline usage.
                        this.offline = true;

                        return AddonModDataHelper.getEditDataFromForm(inputData, this.fieldsArray, this.data.id, entryTemp,
                            this.entry.contents, this.offline);
                    }

                    return Promise.reject(e);
            }).then((editData) => {
                if (editData.length > 0) {
                    if (this.isEditing) {
                        return AddonModData.editEntry(this.data.id, this.entryId, this.courseId, editData, this.fields,
                            undefined, this.offline);
                    }

                    return AddonModData.addEntry(this.data.id, entryTemp, this.courseId, editData, this.selectedGroup,
                        this.fields, undefined, this.offline);
                }

                return false;
            }).then((result: any) => {
                if (!result) {
                    // No field filled, warn the user.
                    return Promise.reject('addon.mod_data.emptyaddform');
                }

                // This is done if entry is updated when editing or creating if not.
                if ((this.isEditing && result.updated) || (!this.isEditing && result.newentryid)) {

                    CoreDomUtils.triggerFormSubmittedEvent(this.formElement, result.sent, this.siteId);

                    const promises = [];

                    if (result.sent) {
                        CoreEvents.trigger(CoreEventsProvider.ACTIVITY_DATA_SENT, { module: 'data' });

                        if (this.isEditing) {
                            promises.push(AddonModData.invalidateEntryData(this.data.id, this.entryId, this.siteId));
                        }
                        promises.push(AddonModData.invalidateEntriesData(this.data.id, this.siteId));
                    }

                    return Promise.all(promises).then(() => {
                        CoreEvents.trigger(AddonModDataProvider.ENTRY_CHANGED,
                            { dataId: this.data.id, entryId: this.entryId } , this.siteId);
                    }).finally(() => {
                        return this.returnToEntryList();
                    });
                } else {
                    this.errors = {};
                    if (result.fieldnotifications) {
                        result.fieldnotifications.forEach((fieldNotif) => {
                            const field = this.fieldsArray.find((field) => field.name == fieldNotif.fieldname);
                            if (field) {
                                this.errors[field.id] = fieldNotif.notification;
                            }
                        });
                    }
                    this.jsData['errors'] = this.errors;

                    setTimeout(() => {
                        this.scrollToFirstError();
                    });
                }
            }).finally(() => {
                modal.dismiss();
            });
        }).catch((error) => {
            CoreDomUtils.showErrorModalDefault(error, 'Cannot edit entry', true);
        });
    }

    /**
     * Set group to see the database.
     *
     * @param groupId Group identifier to set.
     * @return Resolved when done.
     */
    setGroup(groupId: number): Promise<void> {
        this.selectedGroup = groupId;
        this.loaded = false;

        return this.fetchEntryData();
    }

    /**
     * Displays Edit Search Fields.
     *
     * @return Generated HTML.
     */
    protected displayEditFields(): string {
        this.jsData = {
            fields: this.fields,
            contents: CoreUtils.clone(this.entry.contents),
            form: this.editForm,
            data: this.data,
            errors: this.errors
        };

        let replace,
            render,
            template = AddonModDataHelper.getTemplate(this.data, 'addtemplate', this.fieldsArray);

        // Replace the fields found on template.
        this.fieldsArray.forEach((field) => {
            replace = '[[' + field.name + ']]';
            replace = replace.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
            replace = new RegExp(replace, 'gi');

            // Replace field by a generic directive.
            render = '<addon-mod-data-field-plugin mode="edit" [field]="fields[' + field.id + ']"\
                [value]="contents[' + field.id + ']" [form]="form" [database]="data" [error]="errors[' + field.id + ']">\
                </addon-mod-data-field-plugin>';
            template = template.replace(replace, render);

            // Replace the field id tag.
            replace = '[[' + field.name + '#id]]';
            replace = replace.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
            replace = new RegExp(replace, 'gi');

            template = template.replace(replace, 'field_' + field.id);
        });

        // Editing tags is not supported.
        replace = new RegExp('##tags##', 'gi');
        const message = '<p class="item-dimmed">{{ \'addon.mod_data.edittagsnotsupported\' | translate }}</p>';
        template = template.replace(replace, CoreTag.areTagsAvailableInSite() ? message : '');

        return template;
    }

    /**
     * Return to the entry list (previous page) discarding temp data.
     *
     * @return Resolved when done.
     */
    protected returnToEntryList(): Promise<void> {
        const inputData = this.editForm.value;

        return AddonModDataHelper.getEditTmpFiles(inputData, this.fieldsArray, this.data.id,
                this.entry.contents).then((files) => {
            CoreFileUploader.clearTmpFiles(files);
        }).finally(() => {
            // Go back to entry list.
            this.forceLeave = true;
            this.navCtrl.pop();
        });
    }

    /**
     * Scroll to first error or to the top if not found.
     */
    protected scrollToFirstError(): void {
        if (!CoreDomUtils.scrollToElementBySelector(this.content, '.addon-data-error')) {
            CoreDomUtils.scrollToTop(this.content);
        }
    }
}
