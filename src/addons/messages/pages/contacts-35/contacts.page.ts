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

import { Component, OnDestroy, OnInit } from '@angular/core';
import { IonRefresher } from '@ionic/angular';
import { CoreSites } from '@services/sites';
import {
    AddonMessagesProvider,
    AddonMessagesGetContactsResult,
    AddonMessagesSearchContactsContact,
    AddonMessagesGetContactsContact,
    AddonMessages,
    AddonMessagesSplitViewLoadIndexEventData,
    AddonMessagesMemberInfoChangedEventData,
} from '../../services/messages';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreApp } from '@services/app';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { ActivatedRoute } from '@angular/router';
import { Translate } from '@singletons';

/**
 * Page that displays the list of contacts.
 */
@Component({
    selector: 'addon-messages-contacts',
    templateUrl: 'contacts.html',
    styleUrls: ['../../messages-common.scss'],
})
export class AddonMessagesContacts35Page implements OnInit, OnDestroy {

    protected currentUserId: number;
    protected searchingMessages: string;
    protected loadingMessages: string;
    protected siteId: string;
    protected noSearchTypes = ['online', 'offline', 'blocked', 'strangers'];
    protected memberInfoObserver: CoreEventObserver;

    loaded = false;
    discussionUserId?: number;
    contactTypes = ['online', 'offline', 'blocked', 'strangers'];
    searchType = 'search';
    loadingMessage = '';
    hasContacts = false;
    contacts: AddonMessagesGetContactsFormatted = {
        online: [],
        offline: [],
        strangers: [],
        search: [],
    };

    searchString = '';


    constructor(
        protected route: ActivatedRoute,
    ) {
        this.currentUserId = CoreSites.instance.getCurrentSiteUserId();
        this.siteId = CoreSites.instance.getCurrentSiteId();
        this.searchingMessages = Translate.instance.instant('core.searching');
        this.loadingMessages = Translate.instance.instant('core.loading');
        this.loadingMessage = this.loadingMessages;

        // Refresh the list when a contact request is confirmed.
        this.memberInfoObserver = CoreEvents.on<AddonMessagesMemberInfoChangedEventData>(
            AddonMessagesProvider.MEMBER_INFO_CHANGED_EVENT,
            (data) => {
                if (data.contactRequestConfirmed) {
                    this.refreshData();
                }
            },
            CoreSites.instance.getCurrentSiteId(),
        );
    }

    /**
     * Component loaded.
     */
    ngOnInit(): void {
        this.route.queryParams.subscribe(async params => {
            this.discussionUserId = params['discussionUserId'] || undefined;

            if (this.discussionUserId) {
                // There is a discussion to load, open the discussion in a new state.
                this.gotoDiscussion(this.discussionUserId);
            }

            try {
                await this.fetchData();
                if (!this.discussionUserId && this.hasContacts) {
                    let contact: AddonMessagesGetContactsContact | undefined;
                    for (const x in this.contacts) {
                        if (this.contacts[x].length > 0) {
                            contact = this.contacts[x][0];
                            break;
                        }
                    }

                    if (contact) {
                        // Take first and load it.
                        this.gotoDiscussion(contact.id, true);
                    }
                }
            } finally {
                this.loaded = true;
            }
        });
    }

    /**
     * Refresh the data.
     *
     * @param refresher Refresher.
     * @return Promise resolved when done.
     */
    async refreshData(refresher?: CustomEvent<IonRefresher>): Promise<void> {
        try {
            if (this.searchString) {
                // User has searched, update the search.
                await this.performSearch(this.searchString);
            } else {
                // Update contacts.
                await AddonMessages.instance.invalidateAllContactsCache(this.currentUserId);
                await this.fetchData();
            }
        } finally {
            refresher?.detail.complete();
        }
    }

    /**
     * Fetch contacts.
     *
     * @return Promise resolved when done.
     */
    protected async fetchData(): Promise<void> {
        this.loadingMessage = this.loadingMessages;

        try {
            const contacts = await AddonMessages.instance.getAllContacts();
            for (const x in contacts) {
                if (contacts[x].length > 0) {
                    this.contacts[x] = this.sortUsers(contacts[x]);
                } else {
                    this.contacts[x] = [];
                }
            }

            this.clearSearch();
        } catch (error) {
            CoreDomUtils.instance.showErrorModalDefault(error, 'addon.messages.errorwhileretrievingcontacts', true);
        }
    }

    /**
     * Sort user list by fullname
     *
     * @param list List to sort.
     * @return Sorted list.
     */
    protected sortUsers(list: AddonMessagesSearchContactsContact[]): AddonMessagesSearchContactsContact[] {
        return list.sort((a, b) => {
            const compareA = a.fullname.toLowerCase();
            const compareB = b.fullname.toLowerCase();

            return compareA.localeCompare(compareB);
        });
    }

    /**
     * Clear search and show all contacts again.
     */
    clearSearch(): void {
        this.searchString = ''; // Reset searched string.
        this.contactTypes = this.noSearchTypes;

        this.hasContacts = false;
        for (const x in this.contacts) {
            if (this.contacts[x].length > 0) {
                this.hasContacts = true;

                return;
            }
        }
    }

    /**
     * Search users from the UI.
     *
     * @param query Text to search for.
     * @return Resolved when done.
     */
    search(query: string): Promise<void> {
        CoreApp.instance.closeKeyboard();

        this.loaded = false;
        this.loadingMessage = this.searchingMessages;

        return this.performSearch(query).finally(() => {
            this.loaded = true;
        });
    }

    /**
     * Perform the search of users.
     *
     * @param query Text to search for.
     * @return Resolved when done.
     */
    protected async performSearch(query: string): Promise<void> {
        try {
            const result = await AddonMessages.instance.searchContacts(query);
            this.hasContacts = result.length > 0;
            this.searchString = query;
            this.contactTypes = ['search'];

            this.contacts.search = this.sortUsers(result);
        } catch (error) {
            CoreDomUtils.instance.showErrorModalDefault(error, 'addon.messages.errorwhileretrievingcontacts', true);
        }
    }

    /**
     * Navigate to a particular discussion.
     *
     * @param discussionUserId Discussion Id to load.
     * @param onlyWithSplitView Only go to Discussion if split view is on.
     */
    gotoDiscussion(discussionUserId: number, onlyWithSplitView: boolean = false): void {
        this.discussionUserId = discussionUserId;

        const params: AddonMessagesSplitViewLoadIndexEventData = {
            discussion: discussionUserId,
            onlyWithSplitView: onlyWithSplitView,
        };
        CoreEvents.trigger(AddonMessagesProvider.SPLIT_VIEW_LOAD_INDEX_EVENT, params, this.siteId);
    }

    /**
     * Component destroyed.
     */
    ngOnDestroy(): void {
        this.memberInfoObserver?.off();
    }

}

/**
 * Contacts with some calculated data.
 */
export type AddonMessagesGetContactsFormatted = AddonMessagesGetContactsResult & {
    search?: AddonMessagesSearchContactsContact[]; // Calculated in the app. Result of searching users.
};