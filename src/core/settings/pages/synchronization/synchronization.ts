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

import { Component, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CoreConstants } from '@core/constants';
import { CoreEvents } from '@singletons/events';
import { CoreSitesProvider, CoreSiteBasicInfo } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreConfigProvider } from '@services/config';
import { CoreSettingsHelper } from '@core/settings/providers/helper';

/**
 * Page that displays the synchronization settings.
 */
@Component({
    selector: 'page-core-settings-synchronization',
    templateUrl: 'synchronization.html',
})
export class CoreSettingsSynchronizationPage implements OnDestroy {

    sites: CoreSiteBasicInfo[] = [];
    sitesLoaded = false;
    sitesObserver: any;
    currentSiteId = '';
    syncOnlyOnWifi = false;
    protected isDestroyed = false;

    constructor(protected configProvider: CoreConfigProvider,

            protected sitesProvider: CoreSitesProvider,
            protected domUtils: CoreDomUtilsProvider,
            protected settingsHelper: CoreSettingsHelper,
            protected translate: TranslateService,
    ) {

        this.currentSiteId = CoreSites.getCurrentSiteId();

        this.sitesObserver = CoreEvents.on(CoreEvents.SITE_UPDATED, (data) => {
            CoreSites.getSite(data.siteId).then((site) => {
                const siteInfo = site.getInfo();
                const siteEntry = this.sites.find((siteEntry) => siteEntry.id == site.id);
                if (siteEntry) {
                    siteEntry.siteUrl = siteInfo.siteurl;
                    siteEntry.siteName = site.getSiteName();
                    siteEntry.fullName = siteInfo.fullname;
                }
            });
        });
    }

    /**
     * View loaded.
     */
    ngOnInit(): void {
        CoreSites.getSortedSites().then((sites) => {
            this.sites = sites;
        }).finally(() => {
            this.sitesLoaded = true;
        });

        this.configProvider.get(CoreConstants.SETTINGS_SYNC_ONLY_ON_WIFI, true).then((syncOnlyOnWifi) => {
            this.syncOnlyOnWifi = !!syncOnlyOnWifi;
        });
    }

    /**
     * Called when sync only on wifi setting is enabled or disabled.
     */
    syncOnlyOnWifiChanged(): void {
        this.configProvider.set(CoreConstants.SETTINGS_SYNC_ONLY_ON_WIFI, this.syncOnlyOnWifi ? 1 : 0);
    }

    /**
     * Syncrhonizes a site.
     *
     * @param siteId Site ID.
     */
    synchronize(siteId: string): void {
        // Using syncOnlyOnWifi false to force manual sync.
        this.settingsHelper.synchronizeSite(false, siteId).catch((error) => {
            if (this.isDestroyed) {
                return;
            }
            CoreDomUtils.showErrorModalDefault(error, 'core.settings.errorsyncsite', true);
        });
    }

    /**
     * Returns true if site is beeing synchronized.
     *
     * @param siteId Site ID.
     * @return True if site is beeing synchronized, false otherwise.
     */
    isSynchronizing(siteId: string): boolean {
        return !!this.settingsHelper.getSiteSyncPromise(siteId);
    }

    /**
     * Show information about sync actions.
     */
    showInfo(): void {
        CoreDomUtils.showAlert(Translate.instant('core.help'),
            Translate.instant('core.settings.synchronizenowhelp'));
    }

    /**
     * Page destroyed.
     */
    ngOnDestroy(): void {
        this.isDestroyed = true;
        this.sitesObserver && this.sitesObserver.off();
    }
}
