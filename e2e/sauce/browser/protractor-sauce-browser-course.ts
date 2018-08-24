import {Config} from 'protractor';
import {globalConf, globalParams} from '../config';

export let config = globalConf;
config.specs = [
    "../../../e2e/*.ts",
    "../../../src/**/e2e/courses.spec.ts",
    "../../../src/**/e2e/course_filtering.spec.ts",
    "../../../src/**/e2e/grades.spec.ts",
    "../../../src/**/e2e/participants.spec.ts",
    "../../../src/**/e2e/coursecompletion.spec.ts",
    "../../../src/**/e2e/course_contents.spec.ts",
    "../../../src/**/e2e/overview.spec.ts"
];

export let global = globalParams;
global.ISBROWSER = true;