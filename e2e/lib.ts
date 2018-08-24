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
import { browser, element, by, ElementFinder, ExpectedConditions as EC, $ } from 'protractor';
import { waitForCondition } from './plugins/wait_for_transitions';
import { promise } from 'selenium-webdriver';

@Injectable()
export class E2ELibraryProvider {

    protected currentView = 'core-ion-tab > .ion-page.show-page:not(> .core-ion-tabs)';
    protected currentNavBar = this.currentView + ' ion-navbar';

    /**
     * Check if mmLoading is in progress.
     *
     * @return {promise.Promise<boolean>} True when it is.
     */
    isLoadingActive(): promise.Promise<boolean> {
        const loadingLocator = by.css(this.currentView + ' .core-loading-container:not(.hide)');
        return browser.isElementPresent(loadingLocator);
    };

    /**
     * Finds and click on a target using text.
     *
     * We do not use by.linkText() because it does not find the elements not directly visible.
     *
     * @param  {string} text Text contained in the node.
     * @param  {element} [container] The container in which the node should be found.
     * @return {Promise}
     */
    clickOn (text: string, container?: element): Promise {
        waitForCondition();
        const locator = by.xpath('(//a | //button | //*[contains(concat(" ",normalize-space(@class)," ")," item ")])[contains(.,"' + text + '") or contains(@aria-label,"' + text + '")]');
        let node;

        if (container) {
            waitForCondition();
            browser.wait(EC.presenceOf(container), 5000);
            node = container.element(locator);
        } else {
            node = element(locator);
        }
        waitForCondition();
        return this.clickOnElement(node);
    };

    /**
     * Click on a element.
     *
     * This will scroll the view if required.
     *
     * @param  {element} el
     * @return {Promise}
     */
    clickOnElement(el: element): Promise {
        waitForCondition();
        browser.sleep(2000);
        browser.wait(EC.presenceOf(el), 50000);
        browser.executeScript('arguments[0].scrollIntoView(true)', el.getWebElement());
        browser.wait(EC.elementToBeClickable(el), 13000);
        return el.click();
    };

    /**
     * Go to bottom of page and Click on a element.
     *
     * This will scroll the view if required.
     *
     * @param  {element} text
     * @return {Promise}
     */
    goToBottomAndClick(text: element): Promise {
        waitForCondition();
        browser.sleep(2000); // This is must, due to slow page rendering issues.
        const locator = by.xpath('(//a | //button | //*[contains(concat(" ",normalize-space(@class)," ")," item ")])[contains(.,"' + text + '") or contains(@aria-label,"' + text + '")]');
        browser.wait(EC.presenceOf(element(locator)), 5000);
        const node = element(locator);

        waitForCondition();
        browser.sleep(2000);
        browser.executeScript('arguments[0].scrollIntoView(false)', node.getWebElement());
        browser.wait(EC.elementToBeClickable(node), 15000);
        return node.click();
    }

    /**
     * Return the active header bar.
     *
     * @return {element}
     */
    getNavBar(): element {
        waitForCondition();
        browser.wait(EC.visibilityOf($(this.currentNavBar)), 10000);
        browser.sleep(7000); // Wait for contents to render.
        return $(this.currentNavBar);
    };

    /**
     * Return the active view.
     *
     * @return {element}
     */
    getView() {
        waitForCondition();
        browser.wait(EC.visibilityOf($(this.currentView)), 50000);
        browser.sleep(7000); // Wait for contents to render.
        return $(this.currentView);
    };

    /**
     * Navigate back.
     *
     * @return {Promise}
     */
    goBack() {
        var backBtn = $(this.currentNavBar + ' .back-button');
        waitForCondition();
        browser.wait(EC.visibilityOf(backBtn), 15000);
        return backBtn.isPresent().then(function (present) {
            if (present) {
                return backBtn.isDisplayed().then(function (displayed) {
                    if (displayed) {
                        return backBtn.click();
                    }
                    throw new Error('Could not find back button.');
                });
            }
            throw new Error('Could not find the back button.');
        });
    };

    /**
     * Login as a user.
     *
     * @param {String} username The login
     * @param {String} password The password
     * @return {Promise}
     */
    loginAs(username: string, password: string): Promise<boolean> {

        browser.ignoreSynchronization = true;
        browser.waitForAngular();
        browser.wait(EC.visibilityOf(element(by.model('loginData.siteurl'))), 15000);

        element(by.model('loginData.siteurl'))
            .sendKeys(SITEURL);
        browser.wait(EC.elementToBeClickable($('[ng-click="connect(loginData.siteurl)"]')), 15000);
        return $('[ng-click="connect(loginData.siteurl)"]').click()
            .then(function () {
                waitForCondition();
                browser.wait(EC.visibilityOf($('[ng-click="login()"]')), 15000);
                element(by.model('credentials.username'))
                    .sendKeys(username);
                element(by.model('credentials.password'))
                    .sendKeys(password);
                browser.wait(EC.elementToBeClickable($('[ng-click="login()"]')), 15000);
                return $('[ng-click="login()"]').click();
            });
    };

    /**
     * Login as admin.
     *
     * @return {Promise}
     */
    loginAsAdmin() {
        return this.loginAs(USERS.ADMIN.LOGIN, USERS.ADMIN.PASSWORD);
    };

    /**
     * Login as student.
     *
     * @return {Promise}
     */
    loginAsStudent() {
        return this.loginAs(USERS.STUDENT.LOGIN, USERS.STUDENT.PASSWORD);
    };


    /**
     * Login as teacher.
     *
     * @return {Promise}
     */
    loginAsTeacher() {
        return this.loginAs(USERS.TEACHER.LOGIN, USERS.TEACHER.PASSWORD);
    };

    /**
     * Logout (change site).
     *
     * @return {Promise}
     */
    logout() {
        return this.clickOnInSideMenu('Change site');
    };

    /**
     * Open the side menu from anywhere.
     *
     * @return {Promise}
     */
    openSideMenu() {
        var menuBtn = $(currentNavBar + ' [menu-toggle="left"]:not(.hide)');
        waitForCondition();
        browser.wait(EC.visibilityOf(menuBtn), 10000);
        browser.wait(EC.elementToBeClickable(menuBtn), 50000);

        function navigateBack() {
            return this.goBack().then(function () {
                return openMenu();
            });
        }

        function openMenu() {
            return menuBtn.isPresent().then(function (present) {
                if (present) {
                    return menuBtn.isDisplayed().then(function (displayed) {
                        if (displayed) {
                            return menuBtn.click();
                        }
                        return navigateBack();
                    });
                }
                return navigateBack();
            });
        }
        return openMenu();
    };
}