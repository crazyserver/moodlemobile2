import {Config} from 'protractor';
import {globalConf, globalParams} from '../config';

export let config = globalConf;
config.specs = [
    "../../../e2e/*.ts",
    "../../../src/**/e2e/mod_forum.spec.ts",
    "../../../src/**/e2e/mod_survey.spec.ts",
    "../../../src/**/e2e/mod_forum_teacher.spec.ts",
    "../../../src/**/e2e/mod_feedback.spec.ts",
    "../../../src/**/e2e/mod_lesson.spec.ts",
    "../../../src/**/e2e/mod_feedback_teacher.spec.ts"
];

export let global = globalParams;
global.ISBROWSER = true;