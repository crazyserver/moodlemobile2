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
import { NavController, NavParams } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { CoreAppProvider } from '@services/app';
import { CoreUtils } from '@services/utils/utils';
import { CoreEvents } from '@singletons/events';
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreUrlUtils } from '@services/utils/url';
import { CoreLoginHelperProvider } from '../../providers/helper';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CoreConstants } from '@core/constants';
import { CoreCustomURLSchemes } from '@services/urlschemes';

/**
 * Page to enter the user credentials.
 */
@Component({
    selector: 'page-core-login-credentials',
    templateUrl: 'credentials.html',
})
export class CoreLoginCredentialsPage {

    @ViewChild('credentialsForm') formElement: ElementRef;

    credForm: FormGroup;
    siteUrl: string;
    siteChecked = false;
    siteName: string;
    logoUrl: string;
    authInstructions: string;
    canSignup: boolean;
    identityProviders: any[];
    pageLoaded = false;
    isBrowserSSO = false;
    isFixedUrlSet = false;
    showForgottenPassword = true;
    showScanQR: boolean;

    protected siteConfig;
    protected eventThrown = false;
    protected viewLeft = false;
    protected siteId: string;
    protected urlToOpen: string;

    constructor(private navCtrl: NavController,
            navParams: NavParams,
            fb: FormBuilder,
            private appProvider: CoreAppProvider,
            private sitesProvider: CoreSitesProvider,
            private loginHelper: CoreLoginHelperProvider,
            private domUtils: CoreDomUtilsProvider,
            private translate: TranslateService,
           ) {

        this.siteUrl = navParams.get('siteUrl');
        this.siteName = navParams.get('siteName') || null;
        this.logoUrl = !CoreConstants.CONFIG.forceLoginLogo && navParams.get('logoUrl') || null;
        this.siteConfig = navParams.get('siteConfig');
        this.urlToOpen = navParams.get('urlToOpen');

        this.credForm = fb.group({
            username: [navParams.get('username') || '', Validators.required],
            password: ['', Validators.required]
        });

        const canScanQR = CoreUtils.canScanQR();
        if (canScanQR) {
            if (typeof CoreConfigConstants['displayqroncredentialscreen'] == 'undefined') {
                this.showScanQR = this.loginHelper.isFixedUrlSet();
            } else {
                this.showScanQR = !!CoreConfigConstants['displayqroncredentialscreen'];
            }
        } else {
            this.showScanQR = false;
        }
    }

    /**
     * View loaded.
     */
    ngOnInit(): void {
        this.treatSiteConfig();
        this.isFixedUrlSet = this.loginHelper.isFixedUrlSet();

        if (this.isFixedUrlSet) {
            // Fixed URL, we need to check if it uses browser SSO login.
            this.checkSite(this.siteUrl);
        } else {
            this.siteChecked = true;
            this.pageLoaded = true;
        }
    }

    /**
     * View destroyed.
     */
    ionViewWillUnload(): void {
        this.viewLeft = true;
        CoreEvents.trigger(CoreEvents.LOGIN_SITE_UNCHECKED, { config: this.siteConfig }, this.siteId);
    }

    /**
     * Check if a site uses local_mobile, requires SSO login, etc.
     * This should be used only if a fixed URL is set, otherwise this check is already performed in CoreLoginSitePage.
     *
     * @param siteUrl Site URL to check.
     * @return Promise resolved when done.
     */
    protected checkSite(siteUrl: string): Promise<any> {
        this.pageLoaded = false;

        // If the site is configured with http:// protocol we force that one, otherwise we use default mode.
        const protocol = siteUrl.indexOf('http://') === 0 ? 'http://' : undefined;

        return CoreSites.checkSite(siteUrl, protocol).then((result) => {

            this.siteChecked = true;
            this.siteUrl = result.siteUrl;

            this.siteConfig = result.config;
            this.treatSiteConfig();

            if (result && result.warning) {
                CoreDomUtils.showErrorModal(result.warning, true, 4000);
            }

            if (this.loginHelper.isSSOLoginNeeded(result.code)) {
                // SSO. User needs to authenticate in a browser.
                this.isBrowserSSO = true;

                // Check that there's no SSO authentication ongoing and the view hasn't changed.
                if (!CoreApp.isSSOAuthenticationOngoing() && !this.viewLeft) {
                    this.loginHelper.confirmAndOpenBrowserForSSOLogin(
                        result.siteUrl, result.code, result.service, result.config && result.config.launchurl);
                }
            } else {
                this.isBrowserSSO = false;
            }

        }).catch((error) => {
            CoreDomUtils.showErrorModal(error);
        }).finally(() => {
            this.pageLoaded = true;
        });
    }

    /**
     * Treat the site configuration (if it exists).
     */
    protected treatSiteConfig(): void {
        if (this.siteConfig) {
            this.siteName = CoreConstants.CONFIG.sitename ? CoreConstants.CONFIG.sitename : this.siteConfig.sitename;
            this.logoUrl = this.loginHelper.getLogoUrl(this.siteConfig);
            this.authInstructions = this.siteConfig.authinstructions || Translate.instant('core.login.loginsteps');

            const disabledFeatures = this.loginHelper.getDisabledFeatures(this.siteConfig);
            this.identityProviders = this.loginHelper.getValidIdentityProviders(this.siteConfig, disabledFeatures);
            this.canSignup = this.siteConfig.registerauth == 'email' &&
                    !this.loginHelper.isEmailSignupDisabled(this.siteConfig, disabledFeatures);
            this.showForgottenPassword = !this.loginHelper.isForgottenPasswordDisabled(this.siteConfig, disabledFeatures);

            if (!this.eventThrown && !this.viewLeft) {
                this.eventThrown = true;
                CoreEvents.trigger(CoreEvents.LOGIN_SITE_CHECKED, { config: this.siteConfig });
            }
        } else {
            this.authInstructions = null;
            this.canSignup = false;
            this.identityProviders = [];
        }
    }

    /**
     * Tries to authenticate the user.
     *
     * @param e Event.
     */
    login(e?: Event): void {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        CoreApp.closeKeyboard();

        // Get input data.
        const siteUrl = this.siteUrl,
            username = this.credForm.value.username,
            password = this.credForm.value.password;

        if (!this.siteChecked || this.isBrowserSSO) {
            // Site wasn't checked (it failed) or a previous check determined it was SSO. Let's check again.
            this.checkSite(siteUrl).then(() => {
                if (!this.isBrowserSSO) {
                    // Site doesn't use browser SSO, throw app's login again.
                    return this.login();
                }
            });

            return;
        }

        if (!username) {
            CoreDomUtils.showErrorModal('core.login.usernamerequired', true);

            return;
        }
        if (!password) {
            CoreDomUtils.showErrorModal('core.login.passwordrequired', true);

            return;
        }

        if (!CoreApp.isOnline()) {
            CoreDomUtils.showErrorModal('core.networkerrormsg', true);

            return;
        }

        const modal = CoreDomUtils.showModalLoading();

        // Start the authentication process.
        CoreSites.getUserToken(siteUrl, username, password).then((data) => {
            return CoreSites.newSite(data.siteUrl, data.token, data.privateToken).then((id) => {
                // Reset fields so the data is not in the view anymore.
                this.credForm.controls['username'].reset();
                this.credForm.controls['password'].reset();

                this.siteId = id;

                return this.loginHelper.goToSiteInitialPage(undefined, undefined, undefined, undefined, this.urlToOpen);
            });
        }).catch((error) => {
            this.loginHelper.treatUserTokenError(siteUrl, error, username, password);
            if (error.loggedout) {
                this.navCtrl.setRoot('CoreLoginSitesPage');
            } else if (error.errorcode == 'forcepasswordchangenotice') {
                // Reset password field.
                this.credForm.controls.password.reset();
            }
        }).finally(() => {
            modal.dismiss();

            CoreDomUtils.triggerFormSubmittedEvent(this.formElement, true);
        });
    }

    /**
     * Forgotten password button clicked.
     */
    forgottenPassword(): void {
        this.loginHelper.forgottenPasswordClicked(this.navCtrl, this.siteUrl, this.credForm.value.username, this.siteConfig);
    }

    /**
     * An OAuth button was clicked.
     *
     * @param provider The provider that was clicked.
     */
    oauthClicked(provider: any): void {
        if (!this.loginHelper.openBrowserForOAuthLogin(this.siteUrl, provider, this.siteConfig.launchurl)) {
            CoreDomUtils.showErrorModal('Invalid data.');
        }
    }

    /**
     * Signup button was clicked.
     */
    signup(): void {
        this.navCtrl.push('CoreLoginEmailSignupPage', { siteUrl: this.siteUrl });
    }

    /**
     * Show instructions and scan QR code.
     */
    showInstructionsAndScanQR(): void {
        // Show some instructions first.
        CoreDomUtils.showAlertWithOptions({
            title: Translate.instant('core.login.faqwhereisqrcode'),
            message: Translate.instant('core.login.faqwhereisqrcodeanswer',
                {$image: CoreLoginHelperProvider.FAQ_QRCODE_IMAGE_HTML}),
            buttons: [
                {
                    text: Translate.instant('core.cancel'),
                    role: 'cancel'
                },
                {
                    text: Translate.instant('core.next'),
                    handler: (): void => {
                        this.scanQR();
                    }
                },
            ],
        });
    }

    /**
     * Scan a QR code and put its text in the URL input.
     *
     * @return Promise resolved when done.
     */
    async scanQR(): Promise<void> {
        // Scan for a QR code.
        const text = await CoreUtils.scanQR();

        if (text && CoreCustomURLSchemes.isCustomURL(text)) {
            try {
                await CoreCustomURLSchemes.handleCustomURL(text);
            } catch (error) {
                CoreCustomURLSchemes.treatHandleCustomURLError(error);
            }
        } else if (text) {
            // Not a custom URL scheme, check if it's a URL scheme to another app.
            const scheme = CoreUrlUtils.getUrlProtocol(text);

            if (scheme && scheme != 'http' && scheme != 'https') {
                CoreDomUtils.showErrorModal(Translate.instant('core.errorurlschemeinvalidscheme', {$a: text}));
            } else {
                CoreDomUtils.showErrorModal('core.login.errorqrnoscheme', true);
            }
        }
    }
}
