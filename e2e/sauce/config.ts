import {Config} from 'protractor';

export let globalConf: Config = {
    framework: 'jasmine2',
    jasmineNodeOpts: {
        showColors: true,
        defaultTimeoutInterval: 100000,
        realtimeFailure: true,
        showTiming: true,
        includeStackTrace: true,
        isVerbose: true,
        onComplete: null
    },
    baseUrl: 'http://localhost:8100/',
    seleniumAddress: "http://" + process.env.SAUCE_USERNAME + ":" + process.env.SAUCE_ACCESS_KEY + "@ondemand.saucelabs.com:443/wd/hub",
    multiCapabilities: [{
        "name": 'chrome',
        "browserName": "chrome",
        "chromeOptions": {
            args: [
                "--allow-file-access",
                "--allow-file-access-from-files",
                "--enable-local-file-accesses",
                "--unlimited-storage"
            ]
        },
        "platform": "Windows 10",
        "version": "58.0",
        "username": process.env.SAUCE_USERNAME,
        "accessKey": process.env.SAUCE_ACCESS_KEY,
        "tunnel-identifier": process.env.TRAVIS_JOB_NUMBER,
        "build": process.env.TRAVIS_BUILD_NUMBER
    }],
    restartBrowserBetweenTests: true,
    onPrepare: () => {
        var wd = require('wd'),
            protractor = require('protractor'),
            wdBridge = require('wd-bridge')(protractor, wd);
        wdBridge.initFromProtractor(exports.config);
    },
    getPageTimeout: 15000,
    plugins: [{
        "path": "../../../e2e/plugins/wait_for_transitions.ts"
    }]
};

// Define global variables for our tests.
export let globalParams = {
    ISANDROID: false,
    ISBROWSER: false,
    ISIOS: false,
    ISTABLET: false,
    DEVICEURL: 'http://localhost:8100/',
    DEVICEVERSION: undefined,
    SITEURL: 'http://school.demo.moodle.net',
    SITEVERSION: 3.5,
    SITEHASLM: false,
    USERS: {
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
}