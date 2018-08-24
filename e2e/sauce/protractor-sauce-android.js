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

import {Config} from 'protractor';

export let config: Config = {
    framework: "jasmine2",
    jasmineNodeOpts: {
        showColors: true,
        defaultTimeoutInterval: 2500000,
        realtimeFailure: true,
        showTiming: true,
        includeStackTrace: true,
        isVerbose: true,
        onComplete: null
    },
    specs: [
        "../../e2e/*.ts",
        "'../../**/*.spec.ts"
    ],
    baseUrl: '',
    seleniumAddress: "http://<username>:<accesskey>@ondemand.saucelabs.com:80/wd/hub",
    multiCapabilities: [{
        "deviceName": "Samsung Galaxy S4 Emulator",
        "name": "android",
        "appiumVersion": "1.5.3",
        "app": "https://s3.amazonaws.com/android.phonegap/production/apps/32ffc00c-1992-11e5-bfff-fa3e49515870/MoodleMobile-release.apk",
        "autoWebview": true,
        "platform": "Android",
        "browserName": "Android",
        "version": "4.4",
        "idleTimeout": 50000,
        "deviceOrientation": "portrait",
        "autoWebviewTimeout": 200000,
        "username": "<username>",
        "accessKey": "<accesskey>"
    }],
    restartBrowserBetweenTests: true,
    onPrepare: function () {
        var wd = require('wd'),
            protractor = require('protractor'),
            wdBridge = require('wd-bridge')(protractor, wd);
        wdBridge.initFromProtractor(exports.config);
        global.EC = protractor.ExpectedConditions;


        // Define global variables for our tests.
        global.ISANDROID = true;
        global.ISBROWSER = false;
        global.ISIOS = false;
        global.ISTABLET = false;
        global.DEVICEURL = 'http://localhost:8100/';
        global.DEVICEVERSION = undefined;
        global.SITEURL = 'http://school.demo.moodle.net';
        global.SITEVERSION = 3.5;
        global.SITEHASLM = false;
        global.USERS = {
            "STUDENT": {
                "LOGIN": "student",
                "PASSWORD": "moodle"
            },
            "TEACHER": {
                "LOGIN": "teacher",
                "PASSWORD": "moodle"
            },
            "ADMIN": {
                "LOGIN": "admin",
                "PASSWORD": "test"
            }
        };
    },
    getPageTimeout: 200000,
    plugins: [{
        "path": "../../e2e/plugins/wait_for_transitions.ts"
    }]
};