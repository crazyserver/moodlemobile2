import {Config} from 'protractor';
import {globalConf, globalParams} from '../config';

export let config = globalConf;
config.specs = [
    "../../../e2e/*.ts",
    "../../../src/**/e2e/mod_glossary.spec.ts",
    "../../../src/**/e2e/mod_wiki.spec.ts",
    "../../../src/**/e2e/mod_data.spec.ts",
    "../../../src/**/e2e/mod_workshop.spec.ts"
];

export let global = globalParams;
global.ISBROWSER = true;