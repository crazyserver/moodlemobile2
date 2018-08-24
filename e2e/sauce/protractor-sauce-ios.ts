import {Config} from 'protractor';
import {globalConf, globalParams} from '../config';

export let config = globalConf;
config.jasmineNodeOpts.defaultTimeoutInterval = 2500000;
config.spec: = [
    "../../e2e/*.ts",
    "'../../**/*.spec.ts"
];
config.baseUrl = '';
config.baseUrl = "http://<username>:<accesskey>@ondemand.saucelabs.com:443/wd/hub";
config.multiCapabilities: [{
    "deviceName": "iPhone 6 Simulator",
    "name": "ios",
    "appiumVersion": "1.5.3",
    "app": "https://s3.amazonaws.com/ios.phonegap/production/apps/cbd27248-73e7-11e5-b902-22000ba180de/MoodleMobile.ipa",
    "autoWebview": true,
    "platformName": "iOS",
    "platformVersion": "9.3",
    "browserName": "",
    "deviceOrientation": "portrait",
    "autoWebviewTimeout": 120000,
    "username": "<username>",
    "accessKey": "<accesskey>"
}];
config.getPageTimeout = 200000;
config.plugins = [{
    "path": "../../e2e/plugins/wait_for_transitions.ts"
}];

export let global = globalParams;
global.ISIOS = true;