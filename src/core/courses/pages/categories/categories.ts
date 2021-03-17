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
import { NavController, NavParams } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { CoreSitesProvider } from '@services/sites';
import { CoreDomUtilsProvider } from '@services/utils/dom';
import { CoreUtilsProvider } from '@services/utils/utils';
import { CoreCoursesProvider } from '../../providers/courses';

/**
 * Page that displays a list of categories and the courses in the current category if any.
 */
@Component({
    selector: 'page-core-courses-categories',
    templateUrl: 'categories.html',
})
export class CoreCoursesCategoriesPage {
    title: string;
    currentCategory: any;
    categories: any[] = [];
    courses: any[] = [];
    categoriesLoaded: boolean;

    protected categoryId: number;

    constructor(private navCtrl: NavController, navParams: NavParams, private coursesProvider: CoreCoursesProvider,
            private domUtils: CoreDomUtilsProvider, private utils: CoreUtilsProvider, translate: TranslateService,
            private sitesProvider: CoreSitesProvider) {
        this.categoryId = navParams.get('categoryId') || 0;
        this.title = Translate.instant('core.courses.categories');
    }

    /**
     * View loaded.
     */
    ngOnInit(): void {
        this.fetchCategories().finally(() => {
            this.categoriesLoaded = true;
        });
    }

    /**
     * Fetch the categories.
     *
     * @return Promise resolved when done.
     */
    protected fetchCategories(): Promise<any> {
        return CoreCourses.getCategories(this.categoryId, true).then((cats) => {
            this.currentCategory = undefined;

            cats.forEach((cat, index) => {
                if (cat.id == this.categoryId) {
                    this.currentCategory = cat;
                    // Delete current Category to avoid problems with the formatTree.
                    delete cats[index];
                }
            });

            // Sort by depth and sortorder to avoid problems formatting Tree.
            cats.sort((a, b) => {
                if (a.depth == b.depth) {
                    return (a.sortorder > b.sortorder) ? 1 : ((b.sortorder > a.sortorder) ? -1 : 0);
                }

                return a.depth > b.depth ? 1 : -1;
            });

            this.categories = CoreUtils.formatTree(cats, 'parent', 'id', this.categoryId);

            if (this.currentCategory) {
                this.title = this.currentCategory.name;

                return CoreCourses.getCoursesByField('category', this.categoryId).then((courses) => {
                    this.courses = courses;
                }).catch((error) => {
                    CoreDomUtils.showErrorModalDefault(error, 'core.courses.errorloadcourses', true);
                });
            }
        }).catch((error) => {
            CoreDomUtils.showErrorModalDefault(error, 'core.courses.errorloadcategories', true);
        });
    }

    /**
     * Refresh the categories.
     *
     * @param refresher Refresher.
     */
    refreshCategories(refresher: any): void {
        const promises = [];

        promises.push(CoreCourses.invalidateUserCourses());
        promises.push(CoreCourses.invalidateCategories(this.categoryId, true));
        promises.push(CoreCourses.invalidateCoursesByField('category', this.categoryId));
        promises.push(CoreSites.getCurrentSite().invalidateConfig());

        Promise.all(promises).finally(() => {
            this.fetchCategories().finally(() => {
                refresher?.detail.complete();
            });
        });
    }
    /**
     * Open a category.
     *
     * @param categoryId The category ID.
     */
    openCategory(categoryId: number): void {
        this.navCtrl.push('CoreCoursesCategoriesPage', { categoryId: categoryId });
    }
}
