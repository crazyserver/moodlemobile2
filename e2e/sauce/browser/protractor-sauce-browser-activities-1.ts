import {Config} from 'protractor';
import {globalConf, globalParams} from '../config';

export let config = globalConf;
config.specs = [
    "../../../e2e/*.ts",
    "../../../src/**/e2e/mod_chat.spec.ts",
    "../../../src/**/e2e/mod_quiz.spec.ts",
    "../../../src/**/e2e/mod_choice.spec.ts",
    "../../../src/**/e2e/mod_assign.spec.ts",
    "../../../src/**/e2e/mod_assign_teacher.spec.ts"
];

export let global = globalParams;
global.ISBROWSER = true;