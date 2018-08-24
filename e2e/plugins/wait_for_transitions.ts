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

import { Injectable } from '@angular/core';
import { browser, by } from 'protractor';
import { promise } from 'selenium-webdriver';

@Injectable()
export class E2EWaitForTransitionsProvider {

    /**
     * Locator of the current view.
     * @type {String}
     */
    protected currentView = 'ion-view[nav-view="active"]';

    /**
     * Check if mmLoading is in progress.
     *
     * @return {promise.Promise<boolean>} True when it is.
     */
    protected isMMLoadingActive(): promise.Promise<boolean> {
        const loadingLocator = by.css(this.currentView + ' .core-loading-container:not(.hide)');
        return browser.isElementPresent(loadingLocator);
    };

    /**
     * Wait for the transitions.
     *
     * We can only rely on direct driver requests here protractor would call this
     * function before executing the requests in this function.
     *
     * @return {promise.Promise<boolean>} True when the conditions are resolved.
     */
    waitForCondition(): promise.Promise<boolean> {
        return this.isMMLoadingActive().then((inTransition) => {
            return !inTransition;
        });
    };
}