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

import { Component, Input, Output, OnInit, EventEmitter } from '@angular/core';
import { CoreGroupsProvider, CoreGroupInfo } from '@providers/groups';
import { CoreUtilsProvider } from '@providers/utils/utils';

/**
 * Component that displays the list of course/activity groups.
 *
 * Usage:
 *     <core-group-selector [cmId]="cmid" [courseId]="courseId" [group]="group" (onChange)="setGroup($event)"></core-group-selector>
 */
@Component({
    selector: 'core-group-selector',
    templateUrl: 'core-group-selector.html',
})
export class CoreGroupSelectorComponent implements OnInit {
    @Input() cmId: number;
    @Input() courseId: number;
    @Input() group: number;
    @Output() onChange = new EventEmitter<number>(); // Will emit an event when group changes.
    protected loadPromise: Promise<{selected: number, info: CoreGroupInfo}>;

    loaded = false;

    groupInfo: CoreGroupInfo = {
        groups: [],
        separateGroups: false,
        visibleGroups: false
    };

    constructor(protected groupsProvider: CoreGroupsProvider,
            protected utils: CoreUtilsProvider) {
        this.loadPromise = Promise.reject();
    }

    /**
     * View loaded.
     */
    ngOnInit(): void {
        this.fetchData().finally(() => {
            this.loaded = true;
        });
    }

    /**
     * Return the load promise.
     *
     * @param  {boolean} [refresh=false] If the component is refreshing.
     * @return {Promise<{selected: number, info: CoreGroupInfo}>} Load promise.
     */
    onLoad(refresh: boolean = false): Promise<{selected: number, info: CoreGroupInfo}> {
        if (refresh) {
            return this.fetchData();
        }

        return this.loadPromise;
    }

    /**
     * Fetch all the data required for the view.
     *
     * @return {Promise<{selected: number, info: CoreGroupInfo}>} Resolved with group info when done.
     */
    protected fetchData(): Promise<{selected: number, info: CoreGroupInfo}> {
        const deferred = this.utils.promiseDefer();
        this.loadPromise = deferred.promise;

        // Check if groupmode is enabled to avoid showing wrong numbers.
        this.groupsProvider.getActivityGroupInfo(this.cmId, false).then((groupInfo) => {
            this.groupInfo = groupInfo;

            this.group = this.groupsProvider.validateGroupId(this.group, groupInfo);
        }).finally(() => {
            deferred.resolve({selected: this.group, info: this.groupInfo});
        });

        return deferred.promise;
    }

    /**
     * Set group.
     *
     * @param  {number}  groupId Group ID.
     */
    setGroup(groupId: number): void {
        this.group = groupId;
        this.onChange.emit(groupId);
    }

    /**
     * Invalidate data.
     *
     * @return {Promise<void>} Resolved when done.
     */
    invalidate(): Promise<void> {
        return this.groupsProvider.invalidateActivityGroupInfo(this.courseId);
    }

    /**
     * Refresh data.
     *
     * @return {Promise} Resolved with group info when done.
     */
    refresh(): Promise<{selected: number, info: CoreGroupInfo}> {
        return this.invalidate().catch(() => {
            // Ignore errors.
        }).then(() => {
            return this.fetchData();
        });
    }
}
