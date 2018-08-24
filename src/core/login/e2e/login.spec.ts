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
import { browser, element, by, ElementFinder } from 'protractor';
import { E2ELibraryProvider } from '../../../../e2e/lib';

describe('A user can register sites to the app', () => {

    const MM = new E2ELibraryProvider();

    it('Adding a site', (done) => {
        return MM.loginAsStudent().then(() => {
            browser.sleep(5000); // wait to render
            expect(MM.getNavBar().getText()).toMatch('Course overview');
        }).then(() => {
            done();
        });
    });

    it('Logging out and back in', (done) => {
        return MM.loginAsStudent().then(() => {
            return MM.clickOnInSideMenu('Change site');
        }).then(() => {
            browser.sleep(5000); // wait to render
            expect(MM.getNavBar().getText()).toMatch('Sites');
            expect(element.all(by.repeater('site in sites')).count()).toBe(1);
            expect(MM.getView().getText()).toContain('school.demo.moodle.net');
            return MM.clickOn('school.demo.moodle.net');
        }).then(() => {
            expect(MM.getNavBar().getText()).toMatch('Course overview');
        }).then(() => {
            done();
        });
    });

    it('Adding more than one site', (done) => {
        return MM.loginAsStudent().then(() => {
            return MM.logout();
        }).then(() => {
            return MM.clickOnElement($('[ng-click="add()"]'));
        }).then(() => {
            return MM.loginAsTeacher();
        }).then(() => {
            browser.sleep(5000);
            expect(MM.getNavBar().getText()).toMatch('Course overview');
            return MM.logout();
        }).then(() => {
            browser.sleep(5000);
            expect(element.all(by.repeater('site in sites')).count()).toBe(2);
        }).then(() => {
            done();
        });
    });

});
