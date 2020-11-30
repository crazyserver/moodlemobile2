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

// Code based on https://github.com/martinpritchardelevate/ionic-split-pane-demo

import { Component, ViewChild, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute, ActivationStart, Params, Router } from '@angular/router';
import { IonRouterOutlet } from '@ionic/angular';

/**
 * Directive to create a split view layout.
 *
 * @description
 * To init/change the right pane contents (content pane), inject this component in the master page.
 * @ViewChild(CoreSplitViewComponent) splitviewCtrl: CoreSplitViewComponent;
 * Then use the push function to load.
 *
 * Accepts the following params:
 *
 * @param when When the split-pane should be shown. Can be a CSS media query expression, or a shortcut
 *             expression. Can also be a boolean expression. Check split-pane component documentation for more information.
 *
 * Example:
 *
 * <core-split-view [when]="lg">
 *     <ion-content><!-- CONTENT TO SHOW ON THE LEFT PANEL (MENU) --></ion-content>
 * </core-split-view>
 */
@Component({
    selector: 'core-split-view',
    templateUrl: 'core-split-view.html',
    styleUrls: ['split-view.scss'],
})
export class CoreSplitViewComponent implements AfterViewInit, OnDestroy {

    @ViewChild(IonRouterOutlet) detailNav!: IonRouterOutlet;
    @Input() when?: string | boolean = 'md';

    protected readonly VIEW_EVENTS = ['willEnter', 'didEnter', 'willLeave', 'willLeave'];

    protected isEnabled = false;
    protected masterPageName?: string;
    protected loadDetailsPage: any = false;
    protected masterCanLeaveOverridden = false;
    // protected originalMasterCanLeave: Function;
    protected ignoreSplitChanged = false;
    // protected audioCaptureSubscription: Subscription;
    // protected languageChangedSubscription: Subscription;
    // protected pushOngoing: boolean;
    protected isNavigatingOnDetails = false;
    protected viewEventsSubscriptions: Subscription[] = [];

    // Empty placeholder for the 'detail' page.
    detailPage: any = null;
    // side: string;

    constructor(
        // fileUploaderProvider: CoreFileUploaderProvider,
        protected router: Router,
        protected activatedRoute: ActivatedRoute,
    ) {
    }

    /**
     * Component being initialized.
     */
    ngAfterViewInit(): void {
        this.viewEventsSubscriptions.push(this.router.events.subscribe(e => {
            // We should deactivate detail outlet on leaving.
            if (this.isEnabled &&
                !this.isNavigatingOnDetails &&
                e instanceof ActivationStart &&
                e.snapshot.outlet === 'primary'
            ) {
                console.error('primary', e, this.router.url);
                this.detailNav.deactivate();
            }
        }));

        // Get the master page name and set an empty page as a placeholder.
        this.masterPageName = this.getMasterNav().getLastUrl();
        this.emptyDetails();
        // this.handleViewEvents();
    }

    /**
     * Get the details IonRouterOutlet. If split view is not enabled, it will return the master nav.
     *
     * @return Details IonRouterOutlet.
     */
    protected getDetailsNav(): IonRouterOutlet {
        if (this.isEnabled) {
            return this.detailNav;
        } else {
            return this.getMasterNav();
        }
    }

    /**
     * Get the master IonRouterOutlet.
     *
     * @return Master IonRouterOutlet.
     */
    protected getMasterNav(): IonRouterOutlet {
        return this.detailNav!.parentOutlet!;
    }

    /**
     * Splitpanel visibility has changed.
     *
     * @param isOn If it fits both panels at the same time.
     */
    onSplitPaneChanged(isOn: boolean): void {
        if (this.ignoreSplitChanged) {
            return;
        }

        this.isEnabled = isOn;
        if (this.detailNav) {
            (isOn) ? this.activateSplitView() : this.deactivateSplitView();
        }
    }

    /**
     * Enable the split view, show both panels and do some magical navigation.
     */
    protected async activateSplitView(): Promise<boolean> {
        const masterNav = this.getMasterNav();
        let pop = true;
        this.detailNav.animated = false;
        while (masterNav.getLastUrl() != this.masterPageName && pop) {
            // CurrentView is a 'Detail' page remove it from the 'master' nav stack.

            pop = await masterNav.pop();
        }

        let nav = false;
        if (this.loadDetailsPage) {
            // MasterPage is shown, load the last detail page if found.
            nav = await this.navigateOnDetails(this.loadDetailsPage[0], this.loadDetailsPage[1]);
        } else {
            nav = await this.emptyDetails();
        }
        this.detailNav.animated = true;

        return nav;
    }

    /**
     * Disabled the split view, show only one panel and do some magical navigation.
     */
    protected async deactivateSplitView(): Promise<boolean> {
        this.detailNav.deactivate();

        if (this.loadDetailsPage) {
            const currentElement = this.detailNav.getLastRouteView()?.element.tagName;

            if (currentElement != 'CORE-PLACEHOLDER') {
                // Current detail view is a 'Detail' page so, not the placeholder page, push it on 'master' nav stack.
                return await this.navigateOnMaster(this.loadDetailsPage[0], this.loadDetailsPage[1]);
            }
        }

        return true;
    }

    protected async navigateOnMaster(page: string, params?: Params): Promise<boolean> {
        const pageAndParams = [page];
        if (params) {
            // pageAndParams.push(params);
        }
        this.isNavigatingOnDetails = false;
        const nav = await this.router.navigate(
            pageAndParams,
            { relativeTo: this.activatedRoute },
        );
        if (nav) {
            this.loadDetailsPage = [page];
            if (params) {
                this.loadDetailsPage.push(params);
            }
        }

        return nav;
    }

    protected async navigateOnDetails(page: string, params?: Params): Promise<boolean> {
        const pageAndParams = [page];
        if (params) {
            // pageAndParams.push(params);
        }
        this.isNavigatingOnDetails = true;
        const nav = await this.router.navigate(
            [{ outlets: { main: pageAndParams } }],
            { replaceUrl: true, relativeTo: this.activatedRoute },
        );

        if (nav) {
            this.loadDetailsPage = pageAndParams;
        }

        return nav;
    }

    /**
     * Push a page to the navigation stack. It will decide where to load it depending on the size of the screen.
     *
     * @param page The component class or deeplink name you want to push onto the navigation stack.
     * @param params Any NavParams you want to pass along to the next view.
     * @param retrying Whether it's retrying.
     */
    async push(page: string, params?: Params, retrying: boolean = false): Promise<boolean> {
        try {
            console.error(
                this.isEnabled,
                page,
            );

            if (this.isEnabled) {
                return await this.navigateOnDetails(page, params);
            } else {
                return await this.navigateOnMaster(page, params);
            }
        } catch (error) {
            console.error(error);

            return false;
        }
    }

    /**
     * Check if both panels are shown. It depends on screen width.
     *
     * @return If split view is enabled.
     */
    isOn(): boolean {
        return !!this.isEnabled;
    }

    /**
     * Set the details panel to default info.
     */
    async emptyDetails(): Promise<boolean> {
        if (this.isEnabled && this.loadDetailsPage) {
            this.loadDetailsPage = false;

            return await this.router.navigate(
                [{ outlets: { main: [''] } }],
                { replaceUrl: true },
            );
        }

        return false;
    }

    /**
     * Component being destroyed.
     */
    ngOnDestroy(): void {
        this.viewEventsSubscriptions.forEach((subscription) => subscription.unsubscribe());
    }

}
