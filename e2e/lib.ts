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
import { browser, element, by, ElementFinder } from 'protractor';
import { promise } from 'selenium-webdriver';

@Injectable()
export class E2ELibraryProvider {

    protected currentNavBar = '.nav-bar-block[nav-bar="active"]';
    protected currentView = 'ion-view[nav-view="active"]';

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
     * @param  {String} text Text contained in the node.
     * @param  {Element} container The container in which the node should be found.
     * @return {Promise}
     */
    clickOn (text: string, container: Element): Promise {
        waitForCondition();
        var locator = by.xpath('(//a | //button | //*[contains(concat(" ",normalize-space(@class)," ")," item ")])[contains(.,"' + text + '") or contains(@aria-label,"' + text + '")]');

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
     * @param  {Element} el
     * @return {Promise}
     */
    clickOnElement(el) {
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
     * @param  {Element} text
     * @return {Promise}
     */
    goToBottomAndClick(text) {
        waitForCondition();
        browser.sleep(2000); // This is must, due to slow page rendering issues.
        var locator = by.xpath('(//a | //button | //*[contains(concat(" ",normalize-space(@class)," ")," item ")])[contains(.,"' + text + '") or contains(@aria-label,"' + text + '")]');
        browser.wait(EC.presenceOf(element(locator)), 5000);
        node = element(locator);

        waitForCondition();
        browser.sleep(2000);
        browser.executeScript('arguments[0].scrollIntoView(false)', node.getWebElement());
        browser.wait(EC.elementToBeClickable(node), 15000);
        return node.click();
    }

    /**
     * Click on a link in the side menu.
     *
     * @param  {String} text The link name
     * @return {Promise}
     */
    clickOnInSideMenu(text) {
        return MM.openSideMenu().then(function () {
            waitForCondition();
            var menu = $('ion-side-menu[side="left"]');
            browser.wait(EC.visibilityOf(menu), 7000);
            browser.wait(EC.elementToBeClickable(menu), 5000);
            return MM.clickOn(text, menu);
        });
    };

    /**
     * Return the active header bar.
     *
     * @return {Element}
     */
    getNavBar() {
        waitForCondition();
        browser.wait(EC.visibilityOf($(currentNavBar)), 10000);
        browser.sleep(7000); // Wait for contents to render.
        return $(currentNavBar);
    };

    /**
     * Return the active view.
     *
     * @return {Element}
     */
    getView() {
        waitForCondition();
        browser.wait(EC.visibilityOf($(currentView)), 50000);
        browser.sleep(7000); // Wait for contents to render.
        return $(currentView);
    };

    /**
     * Navigate back.
     *
     * @return {Promise}
     */
    goBack() {
        var backBtn = $(currentNavBar + ' .back-button');
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
    loginAs(username, password) {

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
        return MM.loginAs(USERS.ADMIN.LOGIN, USERS.ADMIN.PASSWORD);
    };

    /**
     * Login as student.
     *
     * @return {Promise}
     */
    loginAsStudent() {
        return MM.loginAs(USERS.STUDENT.LOGIN, USERS.STUDENT.PASSWORD);
    };


    /**
     * Login as teacher.
     *
     * @return {Promise}
     */
    loginAsTeacher() {
        return MM.loginAs(USERS.TEACHER.LOGIN, USERS.TEACHER.PASSWORD);
    };

    /**
     * Logout (change site).
     *
     * @return {Promise}
     */
    logout() {
        return MM.clickOnInSideMenu('Change site');
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
            return MM.goBack().then(function () {
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