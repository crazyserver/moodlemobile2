import {Config} from 'protractor';
import {globalConf, globalParams} from '../config';

export let config = globalConf;
config.specs = [
    "../../../e2e/*.ts",
    "../../../src/**/e2e/teacher_grades.spec.ts",
    "../../../src/**/e2e/teacher_new_staff_induction_course.spec.ts",
    "../../../src/**/e2e/teacher_course.spec.ts",
    "../../../src/**/e2e/teacher_participants.spec.ts",
    "../../../src/**/e2e/user_profile.spec.ts"
];

export let global = globalParams;
global.ISBROWSER = true;