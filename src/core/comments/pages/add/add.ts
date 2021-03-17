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
import { ViewController, NavParams } from '@ionic/angular';
import { CoreAppProvider } from '@services/app';
import { CoreEvents } from '@singletons/events';
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreCommentsProvider } from '../../providers/comments';

/**
 * Component that displays a text area for composing a comment.
 */
@Component({
    selector: 'page-core-comments-add',
    templateUrl: 'add.html',
})
export class CoreCommentsAddPage {
    @ViewChild('commentForm') formElement: ElementRef;

    protected contextLevel: string;
    protected instanceId: number;
    protected componentName: string;
    protected itemId: number;
    protected area = '';

    content = '';
    processing = false;

    constructor(params: NavParams,
            protected viewCtrl: ViewController,
            protected appProvider: CoreAppProvider,
            protected domUtils: CoreDomUtilsProvider,
            protected commentsProvider: CoreCommentsProvider,

            protected sitesProvider: CoreSitesProvider) {
        this.contextLevel = params.get('contextLevel');
        this.instanceId = params.get('instanceId');
        this.componentName = params.get('componentName');
        this.itemId = params.get('itemId');
        this.area = params.get('area') || '';
        this.content = params.get('content') || '';
    }

    /**
     * Send the comment or store it offline.
     *
     * @param e Event.
     */
    addComment(e: Event): void {
        e.preventDefault();
        e.stopPropagation();

        CoreApp.closeKeyboard();
        const loadingModal = CoreDomUtils.showModalLoading('core.sending', true);
        // Freeze the add comment button.
        this.processing = true;
        this.commentsProvider.addComment(this.content, this.contextLevel, this.instanceId, this.componentName, this.itemId,
                this.area).then((commentsResponse) => {

            CoreDomUtils.triggerFormSubmittedEvent(this.formElement, !!commentsResponse, CoreSites.getCurrentSiteId());

            this.viewCtrl.dismiss({comments: commentsResponse}).finally(() => {
                CoreDomUtils.showToast(commentsResponse ? 'core.comments.eventcommentcreated' : 'core.datastoredoffline', true,
                    3000);
            });
        }).catch((error) => {
            CoreDomUtils.showErrorModal(error);
            this.processing = false;
        }).finally(() => {
            loadingModal.dismiss();
        });
    }

    /**
     * Close modal.
     */
    closeModal(): void {
        CoreDomUtils.triggerFormCancelledEvent(this.formElement, CoreSites.getCurrentSiteId());
        this.viewCtrl.dismiss();
    }
}
