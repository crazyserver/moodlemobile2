import {Config} from 'protractor';
import {globalConf, globalParams} from '../config';

export let config = globalConf;
config.specs = [
    "../../../e2e/*.ts",
    "../../../src/**/e2e/mod_book.spec.ts",
    "../../../src/**/e2e/mod_label.spec.ts",
    "../../../src/**/e2e/mod_resource.spec.ts",
    "../../../src/**/e2e/mod_folder.spec.ts",
    "../../../src/**/e2e/mod_page.spec.ts",
    "../../../src/**/e2e/mod_url.spec.ts",
    "../../../src/**/e2e/module_prefetch.spec.ts"
];

export let global = globalParams;
global.ISBROWSER = true;