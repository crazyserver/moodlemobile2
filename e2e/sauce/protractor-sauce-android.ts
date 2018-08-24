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
}];
config.getPageTimeout = 200000;
config.plugins = [{
    "path": "../../e2e/plugins/wait_for_transitions.ts"
}];

export let global = globalParams;
global.ISANDROID = true;
