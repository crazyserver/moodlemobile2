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
import { CoreAppProvider } from '@services/app';
import { CoreEvents } from '@singletons/events';
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreLoginHelperProvider } from '../../providers/helper';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

/**
 * Page to enter the user password to reconnect to a site.
 */
@Component({
    selector: 'page-core-login-reconnect',
    templateUrl: 'reconnect.html',
})
export class CoreLoginReconnectPage {

    @ViewChild('reconnectForm') formElement: ElementRef;

    credForm: FormGroup;
    siteUrl: string;
    username: string;
    siteName: string;
    logoUrl: string;
    identityProviders: any[];
    site: any;
    showForgottenPassword = true;
    showSiteAvatar = false;
    isOAuth = false;

    protected infoSiteUrl: string;
    protected pageName: string;
    protected pageParams: any;
    protected siteConfig: any;
    protected isLoggedOut: boolean;
    protected siteId: string;
    protected viewLeft = false;
    protected eventThrown = false;

    constructor(protected navCtrl: NavController,
            navParams: NavParams,
            fb: FormBuilder,
            protected appProvider: CoreAppProvider,
            protected sitesProvider: CoreSitesProvider,
            protected loginHelper: CoreLoginHelperProvider,
            protected domUtils: CoreDomUtilsProvider,
           ) {

        const currentSite = CoreSites.getCurrentSite();

        this.infoSiteUrl = navParams.get('infoSiteUrl');
        this.pageName = navParams.get('pageName');
        this.pageParams = navParams.get('pageParams');
        this.siteConfig = navParams.get('siteConfig');
        this.siteUrl = navParams.get('siteUrl');
        this.siteId = navParams.get('siteId');

        this.isLoggedOut = currentSite && currentSite.isLoggedOut();
        this.credForm = fb.group({
            password: ['', Validators.required]
        });
    }

    /**
     * View loaded.
     */
    ngOnInit(): void {
        if (this.siteConfig) {
            this.getDataFromConfig(this.siteConfig);
        }

        CoreSites.getSite(this.siteId).then((site) => {
            this.site = {
                id: site.id,
                fullname: site.infos.fullname,
                avatar: site.infos.userpictureurl
            };

            this.username = site.infos.username;
            this.siteUrl = site.infos.siteurl;
            this.siteName = site.getSiteName();

            // If login was OAuth we should only reach this page if the OAuth method ID has changed.
            this.isOAuth = site.isOAuth();

            // Show logo instead of avatar if it's a fixed site.
            this.showSiteAvatar = this.site.avatar && !this.loginHelper.getFixedSites();

            return site.getPublicConfig().then((config) => {
                return CoreSites.checkApplication(config).then(() => {
                    // Check logoURL if user avatar is not set.
                    if (this.site.avatar.startsWith(site.infos.siteurl + '/theme/image.php')) {
                        this.showSiteAvatar = false;
                    }
                    this.logoUrl = this.loginHelper.getLogoUrl(config);

                    this.getDataFromConfig(this.siteConfig);
                }).catch(() => {
                    this.cancel();
                });
            }).catch(() => {
                // Ignore errors.
            });
        }).catch(() => {
            // Shouldn't happen. Just leave the view.
            this.cancel();
        });
    }

    /**
     * View destroyed.
     */
    ionViewWillUnload(): void {
        this.viewLeft = true;
        CoreEvents.trigger(CoreEvents.LOGIN_SITE_UNCHECKED, { config: this.siteConfig }, this.siteId);
    }

    /**
     * Get some data (like identity providers) from the site config.
     *
     * @param config Config to use.
     */
    protected getDataFromConfig(config: any): void {
        const disabledFeatures = this.loginHelper.getDisabledFeatures(config);

        this.identityProviders = this.loginHelper.getValidIdentityProviders(config, disabledFeatures);
        this.showForgottenPassword = !this.loginHelper.isForgottenPasswordDisabled(config);

        if (!this.eventThrown && !this.viewLeft) {
            this.eventThrown = true;
            CoreEvents.trigger(CoreEvents.LOGIN_SITE_CHECKED, { config: config });
        }
    }

    /**
     * Cancel reconnect.
     *
     * @param e Event.
     */
    cancel(e?: Event): void {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        CoreSites.logout();
    }

    /**
     * Tries to authenticate the user.
     *
     * @param e Event.
     */
    login(e: Event): void {
        e.preventDefault();
        e.stopPropagation();

        CoreApp.closeKeyboard();

        // Get input data.
        const siteUrl = this.siteUrl,
            username = this.username,
            password = this.credForm.value.password;

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
            return CoreSites.updateSiteToken(this.infoSiteUrl, username, data.token, data.privateToken).then(() => {

                CoreDomUtils.triggerFormSubmittedEvent(this.formElement, true);

                // Update site info too because functions might have changed (e.g. unisntall local_mobile).
                return CoreSites.updateSiteInfoByUrl(this.infoSiteUrl, username).then(() => {
                    // Reset fields so the data is not in the view anymore.
                    this.credForm.controls['password'].reset();

                    // Go to the site initial page.
                    return this.loginHelper.goToSiteInitialPage(this.navCtrl, this.pageName, this.pageParams);
                }).catch((error) => {
                    if (error.loggedout) {
                        this.loginHelper.treatUserTokenError(siteUrl, error, username, password);
                    } else {
                        CoreDomUtils.showErrorModalDefault(error, 'core.login.errorupdatesite', true);
                    }

                    // Error, go back to login page.
                    this.cancel();
                });
            });
        }).catch((error) => {
            this.loginHelper.treatUserTokenError(siteUrl, error, username, password);

            if (error.loggedout) {
                this.cancel();
            } else if (error.errorcode == 'forcepasswordchangenotice') {
                // Reset password field.
                this.credForm.controls.password.reset();
            }
        }).finally(() => {
            modal.dismiss();
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
}
