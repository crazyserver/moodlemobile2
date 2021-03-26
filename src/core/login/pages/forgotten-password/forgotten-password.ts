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
import { NavController, NavParams, Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { CoreEvents } from '@singletons/events';
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreLoginHelperProvider } from '../../providers/helper';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

/**
 * Page to recover a forgotten password.
 */
@Component({
    selector: 'page-core-login-forgotten-password',
    templateUrl: 'forgotten-password.html',
})
export class CoreLoginForgottenPasswordPage {

    @ViewChild('resetPasswordForm') formElement: ElementRef;

    myForm: FormGroup;
    siteUrl: string;
    autoFocus: boolean;

    constructor(protected navCtrl: NavController,
            navParams: NavParams,
            fb: FormBuilder,
            platform: Platform,
            protected translate: TranslateService,
            protected loginHelper: CoreLoginHelperProvider,
            protected domUtils: CoreDomUtilsProvider,

            protected sitesProvider: CoreSitesProvider) {

        this.siteUrl = navParams.get('siteUrl');
        this.autoFocus = platform.is('tablet');
        this.myForm = fb.group({
            field: ['username', Validators.required],
            value: [navParams.get('username') || '', Validators.required]
        });
    }

    /**
     * Request to reset the password.
     *
     * @param e Event.
     */
    resetPassword(e: Event): void {
        e.preventDefault();
        e.stopPropagation();

        const field = this.myForm.value.field,
            value = this.myForm.value.value;

        if (!value) {
            CoreDomUtils.showErrorModal('core.login.usernameoremail', true);

            return;
        }

        const modal = CoreDomUtils.showModalLoading('core.sending', true),
            isMail = field == 'email';

        this.loginHelper.requestPasswordReset(this.siteUrl, isMail ? '' : value, isMail ? value : '').then((response) => {
            if (response.status == 'dataerror') {
                // Error in the data sent.
                this.showError(isMail, response.warnings);
            } else if (response.status == 'emailpasswordconfirmnotsent' || response.status == 'emailpasswordconfirmnoemail') {
                // Error, not found.
                CoreDomUtils.showErrorModal(response.notice);
            } else {
                // Success.
                CoreDomUtils.triggerFormSubmittedEvent(this.formElement, true);

                CoreDomUtils.showAlert(Translate.instant('core.success'), response.notice);
                CoreNavigator.back();
            }
        }).catch((error) => {
            CoreDomUtils.showErrorModal(error);
        }).finally(() => {
            modal.dismiss();
        });
    }

    // Show an error from the warnings.
    protected showError(isMail: boolean, warnings: any[]): void {
        for (let i = 0; i < warnings.length; i++) {
            const warning = warnings[i];
            if ((warning.item == 'email' && isMail) || (warning.item == 'username' && !isMail)) {
                CoreDomUtils.showErrorModal(warning.message);
                break;
            }
        }
    }
}
