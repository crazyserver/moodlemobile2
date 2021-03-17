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

import { Component } from '@angular/core';
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreCoursesProvider } from '../../providers/courses';

/**
 * Page that displays available courses in current site.
 */
@Component({
    selector: 'page-core-courses-available-courses',
    templateUrl: 'available-courses.html',
})
export class CoreCoursesAvailableCoursesPage {
    courses: any[] = [];
    coursesLoaded: boolean;

    constructor(private coursesProvider: CoreCoursesProvider, private domUtils: CoreDomUtilsProvider,
        private sitesProvider: CoreSitesProvider) { }

    /**
     * View loaded.
     */
    ngOnInit(): void {
        this.loadCourses().finally(() => {
            this.coursesLoaded = true;
        });
    }

    /**
     * Load the courses.
     *
     * @return Promise resolved when done.
     */
    protected loadCourses(): Promise<any> {
        const frontpageCourseId = CoreSites.getCurrentSite().getSiteHomeId();

        return CoreCourses.getCoursesByField().then((courses) => {
            this.courses = courses.filter((course) => {
                return course.id != frontpageCourseId;
            });
        }).catch((error) => {
            CoreDomUtils.showErrorModalDefault(error, 'core.courses.errorloadcourses', true);
        });
    }

    /**
     * Refresh the courses.
     *
     * @param refresher Refresher.
     */
    refreshCourses(refresher: any): void {
        const promises = [];

        promises.push(CoreCourses.invalidateUserCourses());
        promises.push(CoreCourses.invalidateCoursesByField());

        Promise.all(promises).finally(() => {
            this.loadCourses().finally(() => {
                refresher?.detail.complete();
            });
        });
    }
}
