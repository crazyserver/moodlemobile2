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

import { Config, browser, by } from 'protractor';
import * as tsNode from 'ts-node';

const serverAddress = 'http://' + process.env.SAUCE_USERNAME + ':' + process.env.SAUCE_ACCESS_KEY +
    '@ondemand.saucelabs.com:80/wd/hub';
const testFilePatterns: Array<string> = [
  './specs/*.e2e-spec.js',
  './specs/**/*.e2e-spec.js',
  './specs/**/*/*.e2e-spec.js'
];

const globalCapability = {
  'tunnel-identifier': process.env.TRAVIS_JOB_NUMBER,
};

const iPhoneXSimulatorCapability = Object.assign({
  'browserName': 'Safari',
  'autoWebview': true,
  'autoWebviewTimeout': 20000,
  //'app': '/Users/${user}/ordina/e2e/superApp/platforms/ios/build/emulator/superApp.app',
  'platform': 'iOS',
  'platformVersion': '12.2',
  'deviceName': 'iPhone X Simulator',
  'platformName': 'iOS',
  //'name': 'My First Mobile Test',
  //'automationName': 'XCUITest',
  //'nativeWebTap': 'true',
  'appium-version': '1.13.0'
}, globalCapability);

const androidEmulatorCapability = Object.assign({
  'browserName': 'Chrome',
  'autoWebview': true,
  'autoWebviewTimeout': 20000,
  'platformName': 'Android',
  'platformVersion': '8.0',
  'deviceName': 'Android Emulator',
  //'app': '/Users/${user}/ordina/e2e/superApp/platforms/android/build/outputs/apk/android-debug.apk',
  //'app-package': 'be.ryan.superApp',
  //'app-activity': 'MainActivity',
  'autoAcceptAlerts': 'true',
  'autoGrantPermissions': 'true',
  //'newCommandTimeout': 300000,
  'appium-version': '1.9.1'
}, globalCapability);

const chromeCapability = Object.assign({
  name: 'chrome',
  browserName: 'chrome',
  chromeOptions: {
      args: [
          '--allow-file-access',
          '--allow-file-access-from-files',
          '--enable-local-file-accesses',
          '--unlimited-storage'
      ]
  },
  platform: 'Windows 10',
  version: '76.0'
}, globalCapability);

export let config: Config = {
  sauceUser: process.env.SAUCE_USERNAME,
  sauceKey: process.env.SAUCE_ACCESS_KEY,
  sauceBuild: process.env.TRAVIS_BUILD_NUMBER,

  allScriptsTimeout: 11000,
  specs: testFilePatterns,
  baseUrl: '',

  multiCapabilities: [
    //iPhoneXSimulatorCapability,
    //androidEmulatorCapability,
    chromeCapability
  ],
  framework: 'jasmine',
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
    realtimeFailure: true,
    showTiming: true,
    includeStackTrace: true,
    isVerbose: true,
    onComplete: null
  },
  seleniumAddress: serverAddress,
  onPrepare: async(): Promise<void> => {
    if (globalParams.ISBROWSER) {
      // Set the window.
      if (globalParams.ISTABLET) {
        browser.driver.manage().window().setSize(1024, 768);
      } else {
        browser.driver.manage().window().setSize(400, 640);
      }

      // Open the main URL.
      await browser.driver.get(globalParams.DEVICEURL);
    }

    await browser.driver.sleep(4000);

    await browser.driver.findElement(by.tagName('page-core-login-site')).sendKeys('Jane');

    // Login takes some time.
    return await browser.driver.wait(async() => {
      console.error('Done');
    }, 10000);
  }
};

// Define global variables for our tests.
export let globalParams = {
    ISANDROID: false,
    ISBROWSER: true,
    ISIOS: false,
    ISTABLET: false,
    DEVICEURL: 'http://localhost:8100/',
    DEVICEVERSION: undefined,
    SITEURL: 'https://school.moodledemo.net',
    SITEVERSION: 3.7,
    SITEHASLM: false,
    USERS: {
        STUDENT: {
            LOGIN: 'student',
            PASSWORD: 'moodle'
        },
        TEACHER: {
            LOGIN: 'teacher',
            PASSWORD: 'moodle'
        },
        ADMIN: {
            LOGIN: 'admin',
            PASSWORD: 'test'
        }
    }
};
