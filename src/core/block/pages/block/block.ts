// (C) Copyright 2015 Martin Dougiamas
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

import { Component, Input, Injector, ViewChild } from '@angular/core';
import { IonicPage, NavParams, Content, NavController, ViewController } from 'ionic-angular';
import { CoreBlockDelegate } from '../../providers/delegate';
import { CoreDynamicComponent } from '@components/dynamic-component/dynamic-component';
import { CoreEventsProvider } from '@providers/events';

/**
 * Page that displays a block.
 */
@IonicPage({ segment: 'core-block-block' })
@Component({
    selector: 'core-block-page',
    templateUrl: 'core-block.html'
})
export class CoreBlockPage {
    @ViewChild(CoreDynamicComponent) dynamicComponent: CoreDynamicComponent;

    block: any; // The block to render.
    contextLevel: string; // The context where the block will be used.
    instanceId: number; // The instance ID associated with the context level.
    extraData: any; // Any extra data to be passed to the block.

    componentClass: any; // The class of the component to render.
    data: any = {}; // Data to pass to the component.
    class: string; // CSS class to apply to the block.
    loaded = false;
    title: string;

    constructor(navParams: NavParams, protected injector: Injector, protected blockDelegate: CoreBlockDelegate,
            protected eventsProvider: CoreEventsProvider, protected viewCtrl: ViewController) {
        this.block = navParams.get('block');
        this.contextLevel = navParams.get('contextLevel');
        this.instanceId = navParams.get('instanceId');
        this.extraData = navParams.get('extraData');
    }

    /**
     * View loaded.
     */
    ionViewDidLoad(): void {
        if (!this.block) {
            this.loaded = true;

            this.viewCtrl.dismiss();
        }

        // Get the data to render the block.
        this.initBlock();
    }

    /**
     * Get block display data and initialises the block once this is available. If the block is not
     * supported at the moment, try again if the available blocks are updated (because it comes
     * from a site plugin).
     */
    initBlock(): void {
        this.blockDelegate.getBlockDisplayData(this.injector, this.block, this.contextLevel, this.instanceId).then((data) => {
            if (!data) {
                this.viewCtrl.dismiss();
            }

            this.class = data.class;
            this.componentClass = data.component;
            this.title = data.title;

            // Set up the data needed by the block component.
            this.data = Object.assign({
                    title: data.title,
                    block: this.block,
                    contextLevel: this.contextLevel,
                    instanceId: this.instanceId,
                    link: data.link || null,
                    linkParams: data.linkParams || null,
                }, this.extraData || {}, data.componentData || {});
        }).catch(() => {
            // Ignore errors.
        }).finally(() => {
            this.loaded = true;
        });
    }

    /**
     * Refresh the data.
     *
     * @param {any} [refresher] Refresher. Please pass this only if the refresher should finish when this function finishes.
     * @param {Function} [done] Function to call when done.
     * @param {boolean} [showErrors=false] If show errors to the user of hide them.
     * @return {Promise<any>} Promise resolved when done.
     */
    doRefresh(refresher?: any, done?: () => void, showErrors: boolean = false): Promise<any> {
        if (this.dynamicComponent) {
            return Promise.resolve(this.dynamicComponent.callComponentFunction('doRefresh', [refresher, done, showErrors]));
        }

        return Promise.resolve();
    }

    /**
     * Invalidate some data.
     *
     * @return {Promise<any>} Promise resolved when done.
     */
    invalidate(): Promise<any> {
        if (this.dynamicComponent) {
            return Promise.resolve(this.dynamicComponent.callComponentFunction('invalidateContent'));
        }

        return Promise.resolve();
    }

    /**
     * Close modal.
     *
     * @param {number} [userId] User conversation to load.
     */
    closeModal(userId?: number): void {
        this.viewCtrl.dismiss(userId);
    }
}
