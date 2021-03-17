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

import {
    Component, Input, Output, ViewChild, ElementRef, EventEmitter, OnChanges, SimpleChange, Optional
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavController } from '@ionic/angular';
import { CoreFile } from '@services/file';
import { CoreLogger } from '@singletons/logger';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreUrlUtilsProvider } from '@services/utils/url';
import { CoreIframeUtilsProvider } from '@services/utils/iframe';
import { CoreUtilsProvider } from '@services/utils/utils';
import { CoreSplitViewComponent } from '@components/split-view/split-view';
import { CoreUrl } from '@singletons/url';
import { CoreApp } from '@services/app';
import { WKWebViewCookiesWindow } from 'cordova-plugin-wkwebview-cookies';

@Component({
    selector: 'core-iframe',
    templateUrl: 'core-iframe.html'
})
export class CoreIframeComponent implements OnChanges {

    @ViewChild('iframe') iframe: ElementRef;
    @Input() src: string;
    @Input() iframeWidth: string;
    @Input() iframeHeight: string;
    @Input() allowFullscreen: boolean | string;
    @Output() loaded?: EventEmitter<HTMLIFrameElement> = new EventEmitter<HTMLIFrameElement>();
    loading: boolean;
    safeUrl: SafeResourceUrl;

    protected logger: CoreLogger;
    protected IFRAME_TIMEOUT = 15000;
    protected initialized = false;

    constructor(
            protected iframeUtils: CoreIframeUtilsProvider,
            protected domUtils: CoreDomUtilsProvider,
            protected sanitizer: DomSanitizer,
            protected navCtrl: NavController,
            protected urlUtils: CoreUrlUtilsProvider,
            protected utils: CoreUtilsProvider,
            @Optional() protected svComponent: CoreSplitViewComponent,
            ) {

        this.logger = CoreLogger.getInstance('CoreIframe');
        this.loaded = new EventEmitter<HTMLIFrameElement>();
    }

    /**
     * Init the data.
     */
    protected init(): void {
        if (this.initialized) {
            return;
        }

        this.initialized = true;

        const iframe: HTMLIFrameElement = this.iframe && this.iframe.nativeElement;

        this.iframeWidth = CoreDomUtils.formatPixelsSize(this.iframeWidth) || '100%';
        this.iframeHeight = CoreDomUtils.formatPixelsSize(this.iframeHeight) || '100%';
        this.allowFullscreen = CoreUtils.isTrueOrOne(this.allowFullscreen);

        // Show loading only with external URLs.
        this.loading = !this.src || !this.urlUtils.isLocalFileUrl(this.src);

        const navCtrl = this.svComponent ? this.svComponent.getMasterNav() : this.navCtrl;
        this.iframeUtils.treatFrame(iframe, false, navCtrl);

        iframe.addEventListener('load', () => {
            this.loading = false;
            this.loaded.emit(iframe); // Notify iframe was loaded.
        });

        iframe.addEventListener('error', () => {
            this.loading = false;
            CoreDomUtils.showErrorModal('core.errorloadingcontent', true);
        });

        if (this.loading) {
            setTimeout(() => {
                this.loading = false;
            }, this.IFRAME_TIMEOUT);
        }
    }

    /**
     * Detect changes on input properties.
     */
    async ngOnChanges(changes: {[name: string]: SimpleChange }): Promise<void> {
        if (changes.src) {
            const url = this.urlUtils.getYoutubeEmbedUrl(changes.src.currentValue) || changes.src.currentValue;

            if (CoreApp.isIOS() && url && !this.urlUtils.isLocalFileUrl(url)) {
                // Save a "fake" cookie for the iframe's domain to fix a bug in WKWebView.
                try {
                    const win = <WKWebViewCookiesWindow> window;
                    const urlParts = CoreUrl.parse(url);

                    if (urlParts.domain) {
                        await win.WKWebViewCookies.setCookie({
                            name: 'MoodleAppCookieForWKWebView',
                            value: '1',
                            domain: urlParts.domain,
                        });
                    }
                } catch (err) {
                    // Ignore errors.
                    this.logger.error('Error setting cookie', err);
                }
            }

            this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(CoreFile.convertFileSrc(url));

            // Now that the URL has been set, initialize the iframe. Wait for the iframe to the added to the DOM.
            setTimeout(() => {
                this.init();
            });
        }
    }
}
