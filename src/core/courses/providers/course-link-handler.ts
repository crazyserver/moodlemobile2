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
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreTextUtilsProvider } from '@services/utils/text';
import { CoreContentLinksHandlerBase } from '@core/contentlinks/classes/base-handler';
import { CoreContentLinksAction } from '@core/contentlinks/providers/delegate';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreCourseHelperProvider } from '@core/course/providers/helper';
import { CoreCoursesProvider } from './courses';
import { NavController } from '@ionic/angular';
import { CoreLogger } from '@singletons/logger';

/**
 * Handler to treat links to course view or enrol (except site home).
 */
@Injectable({ providedIn: 'root' })
export class CoreCoursesCourseLinkHandler extends CoreContentLinksHandlerBase {
    name = 'CoreCoursesCourseLinkHandler';
    pattern = /((\/enrol\/index\.php)|(\/course\/enrol\.php)|(\/course\/view\.php)).*([\?\&]id=\d+)/;

    protected waitStart = 0;
    protected logger: CoreLogger;

    constructor(private sitesProvider: CoreSitesProvider, private coursesProvider: CoreCoursesProvider,
            private domUtils: CoreDomUtilsProvider,
            private translate: TranslateService, private courseProvider: CoreCourseProvider,
            private textUtils: CoreTextUtilsProvider, private courseHelper: CoreCourseHelperProvider) {
        super();

        this.logger = CoreLogger.getInstance('CoreCoursesCourseLinkHandler');
    }

    /**
     * Get the list of actions for a link (url).
     *
     * @param siteIds List of sites the URL belongs to.
     * @param url The URL to treat.
     * @param params The params of the URL. E.g. 'mysite.com?id=1' -> {id: 1}
     * @param courseId Course ID related to the URL. Optional but recommended.
     * @return List of (or promise resolved with list of) actions.
     */
    getActions(siteIds: string[], url: string, params: any, courseId?: number):
            CoreContentLinksAction[] | Promise<CoreContentLinksAction[]> {
        courseId = parseInt(params.id, 10);

        const sectionId = params.sectionid ? parseInt(params.sectionid, 10) : null,
            pageParams: any = {
                sectionId: sectionId || null
            };
        let sectionNumber = typeof params.section != 'undefined' ? parseInt(params.section, 10) : NaN;

        if (!sectionId && !sectionNumber) {
            // Check if the URL has a hash to navigate to the section.
            const matches = url.match(/#section-(\d+)/);
            if (matches && matches[1]) {
                sectionNumber = parseInt(matches[1], 10);
            }
        }

        if (!isNaN(sectionNumber)) {
            pageParams.sectionNumber = sectionNumber;
        }

        return [{
            action: (siteId, navCtrl?): void => {
                siteId = siteId || CoreSites.getCurrentSiteId();
                if (siteId == CoreSites.getCurrentSiteId()) {
                    // Check if we already are in the course index page.
                    if (CoreCourse.currentViewIsCourse(navCtrl, courseId)) {
                        // Current view is this course, just select the contents tab.
                        CoreCourse.selectCourseTab('', pageParams);

                        return;
                    } else {
                        this.actionEnrol(courseId, url, pageParams, navCtrl).catch(() => {
                            // Ignore errors.
                        });
                    }
                } else {
                    // Don't pass the navCtrl to make the course the new history root (to avoid "loops" in history).
                    CoreCourseHelper.getAndOpenCourse(undefined, courseId, pageParams, siteId);
                }
            }
        }];
    }

    /**
     * Check if the handler is enabled for a certain site (site + user) and a URL.
     * If not defined, defaults to true.
     *
     * @param siteId The site ID.
     * @param url The URL to treat.
     * @param params The params of the URL. E.g. 'mysite.com?id=1' -> {id: 1}
     * @param courseId Course ID related to the URL. Optional but recommended.
     * @return Whether the handler is enabled for the URL and site.
     */
    isEnabled(siteId: string, url: string, params: any, courseId?: number): boolean | Promise<boolean> {
        courseId = parseInt(params.id, 10);

        if (!courseId) {
            return false;
        }

        // Get the course id of Site Home.
        return CoreSites.getSiteHomeId(siteId).then((siteHomeId) => {
            return courseId != siteHomeId;
        });
    }

    /**
     * Action to perform when an enrol link is clicked.
     *
     * @param courseId Course ID.
     * @param url Treated URL.
     * @param pageParams Params to send to the new page.
     * @param navCtrl NavController for adding new pages to the current history. Optional for legacy support, but
     *                generates a warning if omitted.
     * @return Promise resolved when done.
     */
    protected actionEnrol(courseId: number, url: string, pageParams: any, navCtrl?: NavController): Promise<any> {
        const modal = CoreDomUtils.showModalLoading(),
            isEnrolUrl = !!url.match(/(\/enrol\/index\.php)|(\/course\/enrol\.php)/);
        let course;

        // Check if user is enrolled in the course.
        return CoreCourses.getUserCourse(courseId).then((courseObj) => {
            course = courseObj;
        }).catch(() => {
            // User is not enrolled in the course. Check if can self enrol.
            return this.canSelfEnrol(courseId).then(() => {
                modal.dismiss();

                // The user can self enrol. If it's not a enrolment URL we'll ask for confirmation.
                const promise = isEnrolUrl ? Promise.resolve() :
                    CoreDomUtils.showConfirm(Translate.instant('core.courses.confirmselfenrol'));

                return promise.then(() => {
                    // Enrol URL or user confirmed.
                    return this.selfEnrol(courseId).then((courseObj) => {
                        course = courseObj;
                    }).catch((error) => {
                        if (error) {
                            CoreDomUtils.showErrorModal(error);
                        }

                        return Promise.reject(null);
                    });
                }, () => {
                    // User cancelled. Check if the user can view the course contents (guest access or similar).
                    return CoreCourse.getSections(courseId, false, true);
                });
            }, (error) => {
                // Can't self enrol. Check if the user can view the course contents (guest access or similar).
                return CoreCourse.getSections(courseId, false, true).catch(() => {
                    // Error. Show error message and allow the user to open the link in browser.
                    modal.dismiss();

                    if (error) {
                        error = this.textUtils.getErrorMessageFromError(error) || error;
                    }
                    if (!error) {
                        error = Translate.instant('core.courses.notenroled');
                    }

                    const body = this.textUtils.buildSeveralParagraphsMessage(
                            [error, Translate.instant('core.confirmopeninbrowser')]);

                    CoreDomUtils.showConfirm(body).then(() => {
                        CoreSites.getCurrentSite().openInBrowserWithAutoLogin(url);
                    }).catch(() => {
                        // User cancelled.
                    });

                    return Promise.reject(null);
                });
            });
        }).then(() => {
            // Check if we need to retrieve the course.
            if (!course) {
                return CoreCourseHelper.getCourse(courseId).then((data) => {
                    return data.course;
                }).catch(() => {
                    // Cannot get course, return a "fake".
                    return { id: courseId };
                });
            }

            return course;
        }).then((course) => {
            modal.dismiss();

            if (typeof navCtrl === 'undefined') {
                this.logger.warn('navCtrl was not passed to actionEnrol');
            }

            // Now open the course.
            CoreCourseHelper.openCourse(navCtrl, course, pageParams);
        });
    }

    /**
     * Check if a user can be "automatically" self enrolled in a course.
     *
     * @param courseId Course ID.
     * @return Promise resolved if user can be enrolled in a course, rejected otherwise.
     */
    protected canSelfEnrol(courseId: number): Promise<any> {
        // Check that the course has self enrolment enabled.
        return CoreCourses.getCourseEnrolmentMethods(courseId).then((methods) => {
            let isSelfEnrolEnabled = false,
                instances = 0;

            methods.forEach((method) => {
                if (method.type == 'self' && method.status) {
                    isSelfEnrolEnabled = true;
                    instances++;
                }
            });

            if (!isSelfEnrolEnabled || instances != 1) {
                // Self enrol not enabled or more than one instance.
                return Promise.reject(null);
            }
        });
    }

    /**
     * Try to self enrol a user in a course.
     *
     * @param courseId Course ID.
     * @param password Password.
     * @return Promise resolved when the user is enrolled, rejected otherwise.
     */
    protected selfEnrol(courseId: number, password?: string): Promise<any> {
        const modal = CoreDomUtils.showModalLoading();

        return CoreCourses.selfEnrol(courseId, password).then(() => {
            // Success self enrolling the user, invalidate the courses list.
            return CoreCourses.invalidateUserCourses().catch(() => {
                // Ignore errors.
            }).then(() => {
                // Sometimes the list of enrolled courses takes a while to be updated. Wait for it.
                return this.waitForEnrolled(courseId, true).finally(() => {
                    modal.dismiss();
                });
            });

        }).catch((error) => {
            modal.dismiss();
            if (error && error.code === CoreCoursesProvider.ENROL_INVALID_KEY) {
                // Invalid password. Allow the user to input password.
                const title = Translate.instant('core.courses.selfenrolment'),
                    body = ' ', // Empty message.
                    placeholder = Translate.instant('core.courses.password');

                if (typeof password != 'undefined') {
                    // The user attempted a password. Show an error message.
                    CoreDomUtils.showErrorModal(error);
                }

                return CoreDomUtils.showPrompt(body, title, placeholder).then((password) => {
                    return this.selfEnrol(courseId, password);
                });
            } else {
                return Promise.reject(error);
            }
        });
    }

    /**
     * Wait for the user to be enrolled in a course.
     *
     * @param courseId The course ID.
     * @param first If it's the first call (true) or it's a recursive call (false).
     * @return Promise resolved when enrolled or timeout.
     */
    protected waitForEnrolled(courseId: number, first?: boolean): Promise<any> {
        if (first) {
            this.waitStart = Date.now();
        }

        // Check if user is enrolled in the course.
        return CoreCourses.invalidateUserCourses().catch(() => {
            // Ignore errors.
        }).then(() => {
            return CoreCourses.getUserCourse(courseId);
        }).catch(() => {
            // Not enrolled, wait a bit and try again.
            if (Date.now() - this.waitStart > 60000) {
                // Max time reached, stop.
                return;
            }

            return new Promise((resolve, reject): void => {
                setTimeout(() => {
                    this.waitForEnrolled(courseId).then(resolve);
                }, 5000);
            });
        });
    }
}
