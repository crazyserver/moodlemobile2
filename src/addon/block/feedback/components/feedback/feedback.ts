// (C) Copyright 2015 Martin Dougiamas
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

import { Component, OnInit, Injector, Input } from '@angular/core';
import { NavController } from 'ionic-angular';
import { CoreDomUtilsProvider } from '@providers/utils/dom';
import { CoreUrlUtilsProvider } from '@providers/utils/url';
import { CoreBlockBaseComponent } from '@core/block/classes/base-block-component';
import { CoreCourseProvider } from '@core/course/providers/course';

/**
 * Component to render an "feedback" block.
 */
@Component({
    selector: 'addon-block-feedback',
    templateUrl: 'addon-block-feedback.html'
})
export class AddonBlockFeedbackComponent extends CoreBlockBaseComponent implements OnInit {
    @Input() block: any; // The block to render.
    @Input() contextLevel: string; // The context where the block will be used.
    @Input() instanceId: number; // The instance ID associated with the context level.

    feedbacks: any[] = [];
    icon: string;
    modnametranslated: string;

    protected fetchContentDefaultError = 'Error getting feedback data.';

    constructor(injector: Injector, protected domUtils: CoreDomUtilsProvider, protected urlUtils: CoreUrlUtilsProvider,
            private courseProvider: CoreCourseProvider, private navCtrl: NavController) {

        super(injector, 'AddonBlockFeedbackComponent');

        this.icon = this.courseProvider.getModuleIconSrc('feedback');
        this.modnametranslated = this.courseProvider.translateModuleName('feedback') || '';
    }

    /**
     * Component being initialized.
     */
    ngOnInit(): void {
        super.ngOnInit();
    }

    /**
     * Fetch the data to render the block.
     *
     * @return {Promise<any>} Promise resolved when done.
     */
    protected fetchContent(): Promise<any> {
        this.feedbacks = [];

        const elements = this.domUtils.convertToElement(this.block.contents.content).getElementsByTagName('a');

        for (const x in elements) {
            const element = elements[x],
                params = this.urlUtils.extractUrlParams(element.href);

            const feedback = {
                id: params.id,
                courseId: params.courseid,
                title: element.text,
                href: element.href
            };

            this.feedbacks.push(feedback);
        }

        return Promise.resolve();
    }

    /**
     * Feedback clicked.
     *
     * @param {Event} e     Click event.
     * @param {any} feedback  Feedback object.
     */
    gotoFeedback(e: Event, feedback: any): void {
        this.courseProvider.getModuleBasicInfo(feedback.id).then((module) => {
            const pageParams = {module: module, courseId: feedback.courseId};

            console.error(feedback, pageParams);
            //module.course = feedback.courseId;

            this.navCtrl.push('AddonModFeedbackIndexPage', pageParams);
        });
    }
}
