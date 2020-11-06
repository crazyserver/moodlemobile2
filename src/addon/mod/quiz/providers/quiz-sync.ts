// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CoreAppProvider } from '@services/app';
import { CoreEvents } from '@singletons/events';
import { CoreLogger } from '@singletons/logger';
import { CoreSitesProvider, CoreSitesReadingStrategy } from '@services/sites';
import { CoreSyncProvider } from '@services/sync';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreTimeUtilsProvider } from '@services/utils/time';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreCourseLogHelperProvider } from '@core/course/providers/log-helper';
import { CoreCourseModulePrefetchDelegate } from '@core/course/providers/module-prefetch-delegate';
import { CoreQuestionProvider } from '@core/question/providers/question';
import { CoreQuestionDelegate } from '@core/question/providers/delegate';
import { CoreCourseActivitySyncBaseProvider } from '@core/course/classes/activity-sync';
import { AddonModQuizProvider } from './quiz';
import { AddonModQuizOfflineProvider } from './quiz-offline';
import { AddonModQuizPrefetchHandler } from './prefetch-handler';

/**
 * Data returned by a quiz sync.
 */
export interface AddonModQuizSyncResult {
    /**
     * List of warnings.
     */
    warnings: string[];

    /**
     * Whether an attempt was finished in the site due to the sync,
     */
    attemptFinished: boolean;
}

/**
 * Service to sync quizzes.
 */
@Injectable()
export class AddonModQuizSyncProvider extends CoreCourseActivitySyncBaseProvider {

    static AUTO_SYNCED = 'addon_mod_quiz_autom_synced';

    protected componentTranslate: string;

    constructor(sitesProvider: CoreSitesProvider, appProvider: CoreAppProvider,
            syncProvider: CoreSyncProvider, textUtils: CoreTextUtilsProvider, translate: TranslateService,
            timeUtils: CoreTimeUtilsProvider,
            private quizProvider: AddonModQuizProvider, private quizOfflineProvider: AddonModQuizOfflineProvider,
            protected prefetchHandler: AddonModQuizPrefetchHandler, private questionProvider: CoreQuestionProvider,
            private questionDelegate: CoreQuestionDelegate, private logHelper: CoreCourseLogHelperProvider,
            prefetchDelegate: CoreCourseModulePrefetchDelegate, private courseProvider: CoreCourseProvider) {

        super('AddonModQuizSyncProvider', loggerProvider, sitesProvider, appProvider, syncProvider, textUtils, translate,
                timeUtils, prefetchDelegate, prefetchHandler);

        this.componentTranslate = courseProvider.translateModuleName('quiz');
    }

    /**
     * Finish a sync process: remove offline data if needed, prefetch quiz data, set sync time and return the result.
     *
     * @param siteId Site ID.
     * @param quiz Quiz.
     * @param courseId Course ID.
     * @param warnings List of warnings generated by the sync.
     * @param attemptId Last attempt ID.
     * @param offlineAttempt Offline attempt synchronized, if any.
     * @param onlineAttempt Online data for the offline attempt.
     * @param removeAttempt Whether the offline data should be removed.
     * @param updated Whether some data was sent to the site.
     * @return Promise resolved on success.
     */
    protected finishSync(siteId: string, quiz: any, courseId: number, warnings: string[], attemptId?: number, offlineAttempt?: any,
            onlineAttempt?: any, removeAttempt?: boolean, updated?: boolean): Promise<AddonModQuizSyncResult> {

        // Invalidate the data for the quiz and attempt.
        return this.quizProvider.invalidateAllQuizData(quiz.id, courseId, attemptId, siteId).catch(() => {
            // Ignore errors.
        }).then(() => {
            if (removeAttempt && attemptId) {
                return this.quizOfflineProvider.removeAttemptAndAnswers(attemptId, siteId);
            }
        }).then(() => {
            if (updated) {
                // Data has been sent. Update prefetched data.
                return this.courseProvider.getModuleBasicInfoByInstance(quiz.id, 'quiz', siteId).then((module) => {
                    return this.prefetchAfterUpdateQuiz(module, quiz, courseId, undefined, siteId);
                }).catch(() => {
                    // Ignore errors.
                });
            }
        }).then(() => {
            return this.setSyncTime(quiz.id, siteId).catch(() => {
                // Ignore errors.
            });
        }).then(() => {
            // Check if online attempt was finished because of the sync.
            if (onlineAttempt && !this.quizProvider.isAttemptFinished(onlineAttempt.state)) {
                // Attempt wasn't finished at start. Check if it's finished now.
                return this.quizProvider.getUserAttempts(quiz.id, {cmId: quiz.coursemodule, siteId}).then((attempts) => {
                    // Search the attempt.
                    for (const i in attempts) {
                        const attempt = attempts[i];

                        if (attempt.id == onlineAttempt.id) {
                            return this.quizProvider.isAttemptFinished(attempt.state);
                        }
                    }

                    return false;
                });
            }

            return false;
        }).then((attemptFinished) => {
            return {
                warnings: warnings,
                attemptFinished: attemptFinished
            };
        });
    }

    /**
     * Check if a quiz has data to synchronize.
     *
     * @param quizId Quiz ID.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with boolean: whether it has data to sync.
     */
    hasDataToSync(quizId: number, siteId?: string): Promise<boolean> {
        return this.quizOfflineProvider.getQuizAttempts(quizId, siteId).then((attempts) => {
            return !!attempts.length;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Conveniece function to prefetch data after an update.
     *
     * @param module Module.
     * @param quiz Quiz.
     * @param courseId Course ID.
     * @param regex If regex matches, don't download the data. Defaults to check files.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when done.
     */
    prefetchAfterUpdateQuiz(module: any, quiz: any, courseId: number, regex?: RegExp, siteId?: string): Promise<any> {
        regex = regex || /^.*files$/;

        let shouldDownload;

        // Get the module updates to check if the data was updated or not.
        return this.prefetchDelegate.getModuleUpdates(module, courseId, true, siteId).then((result) => {

            if (result && result.updates && result.updates.length > 0) {
                // Only prefetch if files haven't changed.
                shouldDownload = !result.updates.find((entry) => {
                    return entry.name.match(regex);
                });

                if (shouldDownload) {
                    return this.prefetchHandler.download(module, courseId, undefined, false, false);
                }
            }

        }).then(() => {
            // Prefetch finished or not needed, set the right status.
            return this.prefetchHandler.setStatusAfterPrefetch(quiz, {
                cmId: module.id,
                readingStrategy: shouldDownload ? CoreSitesReadingStrategy.PreferCache : undefined,
                siteId,
            });
        });
    }

    /**
     * Try to synchronize all the quizzes in a certain site or in all sites.
     *
     * @param siteId Site ID to sync. If not defined, sync all sites.
     * @param force Wether to force sync not depending on last execution.
     * @return Promise resolved if sync is successful, rejected if sync fails.
     */
    syncAllQuizzes(siteId?: string, force?: boolean): Promise<any> {
        return this.syncOnSites('all quizzes', this.syncAllQuizzesFunc.bind(this), [force], siteId);
    }

    /**
     * Sync all quizzes on a site.
     *
     * @param siteId Site ID to sync.
     * @param force Wether to force sync not depending on last execution.
     * @param Promise resolved if sync is successful, rejected if sync fails.
     */
    protected syncAllQuizzesFunc(siteId?: string, force?: boolean): Promise<any> {
        // Get all offline attempts.
        return this.quizOfflineProvider.getAllAttempts(siteId).then((attempts) => {
            const quizzes = [],
                ids = [], // To prevent duplicates.
                promises = [];

            // Get the IDs of all the quizzes that have something to be synced.
            attempts.forEach((attempt) => {
                if (ids.indexOf(attempt.quizid) == -1) {
                    ids.push(attempt.quizid);

                    quizzes.push({
                        id: attempt.quizid,
                        courseid: attempt.courseid
                    });
                }
            });

            // Sync all quizzes that haven't been synced for a while and that aren't attempted right now.
            quizzes.forEach((quiz) => {
                if (!this.syncProvider.isBlocked(AddonModQuizProvider.COMPONENT, quiz.id, siteId)) {

                    // Quiz not blocked, try to synchronize it.
                    promises.push(this.quizProvider.getQuizById(quiz.courseid, quiz.id, {siteId}).then((quiz) => {
                        const promise = force ? this.syncQuiz(quiz, false, siteId) : this.syncQuizIfNeeded(quiz, false, siteId);

                        return promise.then((data) => {
                            if (data && data.warnings && data.warnings.length) {
                                // Store the warnings to show them when the user opens the quiz.
                                return this.setSyncWarnings(quiz.id, data.warnings, siteId).then(() => {
                                    return data;
                                });
                            }

                            return data;
                        }).then((data) => {
                            if (typeof data != 'undefined') {
                                // Sync successful. Send event.
                                CoreEvents.trigger(AddonModQuizSyncProvider.AUTO_SYNCED, {
                                    quizId: quiz.id,
                                    attemptFinished: data.attemptFinished,
                                    warnings: data.warnings
                                }, siteId);
                            }
                        });
                    }));
                }
            });

            return Promise.all(promises);
        });
    }

    /**
     * Sync a quiz only if a certain time has passed since the last time.
     *
     * @param quiz Quiz.
     * @param askPreflight Whether we should ask for preflight data if needed.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when the quiz is synced or if it doesn't need to be synced.
     */
    syncQuizIfNeeded(quiz: any, askPreflight?: boolean, siteId?: string): Promise<any> {
        return this.isSyncNeeded(quiz.id, siteId).then((needed) => {
            if (needed) {
                return this.syncQuiz(quiz, askPreflight, siteId);
            }
        });
    }

    /**
     * Try to synchronize a quiz.
     * The promise returned will be resolved with an array with warnings if the synchronization is successful.
     *
     * @param quiz Quiz.
     * @param askPreflight Whether we should ask for preflight data if needed.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved in success.
     */
    syncQuiz(quiz: any, askPreflight?: boolean, siteId?: string): Promise<AddonModQuizSyncResult> {
        siteId = siteId || this.sitesProvider.getCurrentSiteId();

        const warnings = [];
        const courseId = quiz.course;
        const modOptions = {
            cmId: quiz.coursemodule,
            readingStrategy: CoreSitesReadingStrategy.OnlyNetwork,
            siteId,
        };
        let syncPromise;
        let preflightData;

        if (this.isSyncing(quiz.id, siteId)) {
            // There's already a sync ongoing for this quiz, return the promise.
            return this.getOngoingSync(quiz.id, siteId);
        }

        // Verify that quiz isn't blocked.
        if (this.syncProvider.isBlocked(AddonModQuizProvider.COMPONENT, quiz.id, siteId)) {
            this.logger.debug('Cannot sync quiz ' + quiz.id + ' because it is blocked.');

            return Promise.reject(this.translate.instant('core.errorsyncblocked', {$a: this.componentTranslate}));
        }

        this.logger.debug('Try to sync quiz ' + quiz.id + ' in site ' + siteId);

        // Sync offline logs.
        syncPromise = this.logHelper.syncIfNeeded(AddonModQuizProvider.COMPONENT, quiz.id, siteId).catch(() => {
            // Ignore errors.
        }).then(() => {
            // Get all the offline attempts for the quiz.
            return this.quizOfflineProvider.getQuizAttempts(quiz.id, siteId);
        }).then((attempts) => {
            // Should return 0 or 1 attempt.
            if (!attempts.length) {
                return this.finishSync(siteId, quiz, courseId, warnings);
            }

            const offlineAttempt = attempts.pop();

            // Now get the list of online attempts to make sure this attempt exists and isn't finished.
            return this.quizProvider.getUserAttempts(quiz.id, modOptions).then((attempts) => {
                const lastAttemptId = attempts.length ? attempts[attempts.length - 1].id : undefined;
                let onlineAttempt;

                // Search the attempt we retrieved from offline.
                for (const i in attempts) {
                    const attempt = attempts[i];

                    if (attempt.id == offlineAttempt.id) {
                        onlineAttempt = attempt;
                        break;
                    }
                }

                if (!onlineAttempt || this.quizProvider.isAttemptFinished(onlineAttempt.state)) {
                    // Attempt not found or it's finished in online. Discard it.
                    warnings.push(this.translate.instant('addon.mod_quiz.warningattemptfinished'));

                    return this.finishSync(siteId, quiz, courseId, warnings, offlineAttempt.id, offlineAttempt, onlineAttempt,
                            true);
                }

                // Get the data stored in offline.
                return this.quizOfflineProvider.getAttemptAnswers(offlineAttempt.id, siteId).then((answersList) => {

                    if (!answersList.length) {
                        // No answers stored, finish.
                        return this.finishSync(siteId, quiz, courseId, warnings, lastAttemptId, offlineAttempt, onlineAttempt,
                                true);
                    }

                    const answers = this.questionProvider.convertAnswersArrayToObject(answersList),
                        offlineQuestions = this.quizOfflineProvider.classifyAnswersInQuestions(answers);
                    let finish;

                    // We're going to need preflightData, get it.
                    return this.quizProvider.getQuizAccessInformation(quiz.id, modOptions).then((info) => {

                        return this.prefetchHandler.getPreflightData(quiz, info, onlineAttempt, askPreflight,
                                'core.settings.synchronization', siteId);
                    }).then((data) => {
                        preflightData = data;

                        // Now get the online questions data.
                        const pages = this.quizProvider.getPagesFromLayoutAndQuestions(onlineAttempt.layout, offlineQuestions);

                        return this.quizProvider.getAllQuestionsData(quiz, onlineAttempt, preflightData, {
                            pages,
                            readingStrategy: CoreSitesReadingStrategy.OnlyNetwork,
                            siteId,
                        });
                    }).then((onlineQuestions) => {

                        // Validate questions, discarding the offline answers that can't be synchronized.
                        return this.validateQuestions(onlineAttempt.id, onlineQuestions, offlineQuestions, siteId);
                    }).then((discardedData) => {

                        // Get the answers to send.
                        const answers = this.quizOfflineProvider.extractAnswersFromQuestions(offlineQuestions);
                        finish = offlineAttempt.finished && !discardedData;

                        if (discardedData) {
                            if (offlineAttempt.finished) {
                                warnings.push(this.translate.instant('addon.mod_quiz.warningdatadiscardedfromfinished'));
                            } else {
                                warnings.push(this.translate.instant('addon.mod_quiz.warningdatadiscarded'));
                            }
                        }

                        return this.quizProvider.processAttempt(quiz, onlineAttempt, answers, preflightData, finish, false, false,
                                siteId);
                    }).then(() => {

                        // Answers sent, now set the current page if the attempt isn't finished.
                        if (!finish) {
                            // Don't pass the quiz instance because we don't want to trigger a Firebase event in this case.
                            return this.quizProvider.logViewAttempt(onlineAttempt.id, offlineAttempt.currentpage, preflightData,
                                    false, undefined, siteId).catch(() => {
                                // Ignore errors.
                            });
                        }
                    }).then(() => {

                        // Data sent. Finish the sync.
                        return this.finishSync(siteId, quiz, courseId, warnings, lastAttemptId, offlineAttempt, onlineAttempt,
                                true, true);
                    });
                });
            });
        });

        return this.addOngoingSync(quiz.id, syncPromise, siteId);
    }

    /**
     * Validate questions, discarding the offline answers that can't be synchronized.
     *
     * @param attemptId Attempt ID.
     * @param onlineQuestions Online questions
     * @param offlineQuestions Offline questions.
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved with boolean: true if some offline data was discarded, false otherwise.
     */
    validateQuestions(attemptId: number, onlineQuestions: any, offlineQuestions: any, siteId?: string): Promise<boolean> {
        const promises = [];
        let discardedData = false;

        for (const slot in offlineQuestions) {
            const offlineQuestion = offlineQuestions[slot],
                onlineQuestion = onlineQuestions[slot],
                offlineSequenceCheck = offlineQuestion.answers[':sequencecheck'];

            if (onlineQuestion) {

                // We found the online data for the question, validate that the sequence check is ok.
                if (!this.questionDelegate.validateSequenceCheck(onlineQuestion, offlineSequenceCheck)) {
                    // Sequence check is not valid, remove the offline data.
                    discardedData = true;
                    promises.push(this.quizOfflineProvider.removeQuestionAndAnswers(attemptId, Number(slot), siteId));
                    delete offlineQuestions[slot];
                } else {
                    // Sequence check is valid. Use the online one to prevent synchronization errors.
                    offlineQuestion.answers[':sequencecheck'] = onlineQuestion.sequencecheck;
                }
            } else {
                // Online question not found, it can happen for 2 reasons:
                // 1- It's a sequential quiz and the question is in a page already passed.
                // 2- Quiz layout has changed (shouldn't happen since it's blocked if there are attempts).
                discardedData = true;
                promises.push(this.quizOfflineProvider.removeQuestionAndAnswers(attemptId, Number(slot), siteId));
                delete offlineQuestions[slot];
            }
        }

        return Promise.all(promises).then(() => {
            return discardedData;
        });
    }
}
