import {Config} from 'protractor';
import {globalConf, globalParams} from '../config';

export let config = globalConf;
config.specs = [
    "../../../e2e/*.ts",
    "../../../src/**/e2e/notifications.spec.ts",
    "../../../src/**/e2e/contacts.spec.ts",
    "../../../src/**/e2e/messages.spec.ts",
    "../../../src/**/e2e/login.spec.ts",
    "../../../src/**/e2e/settings.spec.ts",
    "../../../src/**/e2e/files.spec.ts",
    "../../../src/**/e2e/notes.spec.ts",
    "../../../src/**/e2e/calendar.spec.ts"
];

export let global = globalParams;
global.ISBROWSER = true;