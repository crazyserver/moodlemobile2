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
import { ViewController } from '@ionic/angular';
import { CoreEvents } from '@singletons/events';
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';

/**
 * Modal that asks the password for a lesson.
 */
@Component({
    selector: 'page-addon-mod-lesson-password-modal',
    templateUrl: 'password-modal.html',
})
export class AddonModLessonPasswordModalPage {
    @ViewChild('passwordForm') formElement: ElementRef;

    constructor(protected viewCtrl: ViewController,

            protected sitesProvider: CoreSitesProvider,
            protected domUtils: CoreDomUtilsProvider) { }

    /**
     * Send the password back.
     *
     * @param e Event.
     * @param password The input element.
     */
    submitPassword(e: Event, password: HTMLInputElement): void {
        e.preventDefault();
        e.stopPropagation();

        CoreDomUtils.triggerFormSubmittedEvent(this.formElement, false, CoreSites.getCurrentSiteId());

        this.viewCtrl.dismiss(password.value);
    }

    /**
     * Close modal.
     */
    closeModal(): void {
        CoreDomUtils.triggerFormCancelledEvent(this.formElement, CoreSites.getCurrentSiteId());

        this.viewCtrl.dismiss();
    }
}
