<template>
    <section class="management-wrapper">
        <p-breadcrumbs :routes="routes" />
        <p-page-title :title="$t('IDENTITY.USER.MAIN.USER_MANAGEMENT')"
                      use-total-count use-selected-count
                      :total-count="totalCount"
                      :selected-count="selectedIndex.length"
        />
        <p-horizontal-layout>
            <template #container="{ height }">
                <p-query-search-table
                    :loading="loading"
                    :items="users"
                    :select-index="selectedIndex"
                    :fields="fields"
                    :setting-visible="false"
                    :responsive="true"
                    :sort-by.sync="sortBy"
                    :sort-desc.sync="sortDesc"
                    :page-size.sync="pageLimit"
                    :total-count="totalCount"
                    :key-item-sets="keyItemSets"
                    :value-handler-map="valueHandlerMap"
                    :query-tags="tags"
                    :style="{'height': height+'px'}"
                    use-cursor-loading
                    @select="onSelect"
                    @change="onChange"
                    @export="exportUserDataToExcel"
                >
                    <template slot="toolbox-left">
                        <p-icon-text-button style-type="primary-dark"
                                            name="ic_plus_bold"
                                            @click="clickAdd"
                        >
                            {{ $t('IDENTITY.USER.MAIN.ADD') }}
                        </p-icon-text-button>
                        <p-select-dropdown class="left-toolbox-item"
                                           :items="dropdownMenu"

                                           @select="onSelectDropdown"
                        >
                            {{ $t('IDENTITY.USER.MAIN.ACTION') }}
                        </p-select-dropdown>
                    </template>
                    <template #col-state-format="{value}">
                        <p-status v-bind="userStateFormatter(value)" class="capitalize" />
                    </template>
                    <template #col-last_accessed_at-format="{ value }">
                        <span v-if="value === -1">
                            No Activity
                        </span>
                        <span v-else-if="value === 0">
                            {{ $t('IDENTITY.USER.MAIN.TODAY') }}
                        </span>
                        <span v-else-if="value === 1">
                            {{ $t('IDENTITY.USER.MAIN.YESTERDAY') }}
                        </span>
                        <span v-else>
                            {{ value }} {{ $t('IDENTITY.USER.MAIN.DAYS') }}
                        </span>
                    </template>
                </p-query-search-table>
            </template>
        </p-horizontal-layout>
        <p-tab v-if="selectedIndex.length === 1" :tabs="singleItemTabState.tabs"
               :active-tab.sync="singleItemTabState.activeTab"
        >
            <template #detail>
                <user-detail ref="userDetail"
                             :user-id="selectedUsers[0].user_id"
                             :timezone="timezone"
                />
            </template>
            <template #tag>
                <p-tags-panel :resource-id="selectedUsers[0].user_id"
                              resource-type="identity.User"
                              resource-key="user_id"
                />
            </template>
            <template #assigned_role>
                <user-assigned-role
                    :user-id="selectedUsers[0].user_id"
                />
            </template>
            <template #api_key>
                <section>
                    <p-panel-top>
                        {{ $t('IDENTITY.USER.MAIN.API_KEY') }}
                    </p-panel-top>
                    <user-a-p-i-key-table class="api-key-table"
                                          :user-id="selectedUsers[0].user_id"
                    />
                </section>
            </template>
            <template #notifications>
                <user-notifications :user-id="selectedUsers[0].user_id" />
            </template>
        </p-tab>
        <p-tab v-else-if="selectedIndex.length > 1" :tabs="multiItemTabState.tabs"
               :active-tab.sync="multiItemTabState.activeTab"
        >
            <template #data>
                <p-data-table :fields="fields"
                              :sortable="false"
                              :selectable="false"
                              :items="selectedUsers"
                              :col-copy="true"
                              class="selected-data-tab"
                >
                    <template #col-state-format="{value}">
                        <p-status v-bind="userStateFormatter(value)" class="capitalize" />
                    </template>
                    <template #col-last_accessed_at-format="{ value }">
                        <span v-if="value === -1">
                            No Activity
                        </span>
                        <span v-else-if="value === 0">
                            {{ $t('IDENTITY.USER.MAIN.TODAY') }}
                        </span>
                        <span v-else-if="value === 1">
                            {{ $t('IDENTITY.USER.MAIN.YESTERDAY') }}
                        </span>
                        <span v-else>
                            {{ value }} {{ $t('IDENTITY.USER.MAIN.DAYS') }}
                        </span>
                    </template>
                </p-data-table>
            </template>
        </p-tab>
        <div v-else id="empty-space">
            <p-empty>{{ $t('IDENTITY.USER.MAIN.NO_SELECTED') }}</p-empty>
        </div>
        <p-table-check-modal
            v-if="!!modalState.mode"
            :visible.sync="modalState.visible"
            :header-title="modalState.title"
            :sub-title="modalState.subTitle"
            :theme-color="modalState.themeColor"
            :fields="fields"
            size="md"
            :selectable="false"
            :items="selectedUsers"
            @confirm="checkModalConfirm"
        >
            <template #col-state-format="{value}">
                <p-status v-bind="userStateFormatter(value)" class="capitalize" />
            </template>
            <template #col-last_accessed_at-format="{ value }">
                <span v-if="value === -1">
                    No Activity
                </span>
                <span v-if="value === 0">
                    {{ $t('IDENTITY.USER.MAIN.TODAY') }}
                </span>
                <span v-else-if="value === 1">
                    {{ $t('IDENTITY.USER.MAIN.YESTERDAY') }}
                </span>
                <span v-else>
                    {{ value }} {{ $t('IDENTITY.USER.MAIN.DAYS') }}
                </span>
            </template>
        </p-table-check-modal>
        <user-form v-if="userFormState.visible && !userFormState.updateMode"
                   :header-title="userFormState.headerTitle"
                   :item="userFormState.item"
                   :visible.sync="userFormState.visible"
                   :is-admin="userFormState.isAdmin"
                   @confirm="userFormConfirm"
        />
        <user-update-form v-if="userFormState.visible && userFormState.updateMode"
                          :header-title="userFormState.headerTitle"
                          :update-mode="userFormState.updateMode"
                          :item="userFormState.item"
                          :visible.sync="userFormState.visible"
                          :is-admin="userFormState.isAdmin"
                          @confirm="userFormConfirm"
        />
    </section>
</template>

<script lang="ts">
/* eslint-disable camelcase */
import { map } from 'lodash';

import {
    ComponentRenderProxy, computed, getCurrentInstance, reactive, toRefs,
} from '@vue/composition-api';

import {
    PEmpty, PQuerySearchTable, PBreadcrumbs, PIconTextButton, PStatus,
    PHorizontalLayout, PTab, PDataTable, PTableCheckModal, PPageTitle, PSelectDropdown, PPanelTop,
} from '@spaceone/design-system';

import { MenuItem } from '@spaceone/design-system/dist/src/inputs/context-menu/type';
import { KeyItemSet } from '@spaceone/design-system/dist/src/inputs/search/query-search/type';
import { TabItem } from '@spaceone/design-system/dist/src/navigation/tabs/tab/type';
import { Timestamp } from '@spaceone/design-system/dist/src/util/type';

import UserForm from '@/services/identity/user/user-management/modules/UserForm.vue';
import UserUpdateForm from '@/services/identity/user/user-management/modules/UserUpdateForm.vue';
import UserDetail from '@/services/identity/user/user-management/modules/UserDetail.vue';
import UserAssignedRole from '@/services/identity/user/user-management/modules/UserAssignedRole.vue';
import PTagsPanel from '@/common/modules/tags/tags-panel/TagsPanel.vue';
import UserAPIKeyTable from '@/services/identity/user/user-api-key/modules/APIKeyTable.vue';
import UserNotifications from '@/services/identity/user/user-management/modules/UserNotifications.vue';

import { ApiQueryHelper } from '@spaceone/console-core-lib/space-connector/helper';
import { makeDistinctValueHandler, makeEnumValueHandler } from '@spaceone/console-core-lib/component-util/query-search';
import { store } from '@/store';
import { SpaceConnector } from '@spaceone/console-core-lib/space-connector';
import { calculateTime, userStateFormatter } from '@/services/identity/user/lib/helper';
import { replaceUrlQuery } from '@/lib/router-query-string';
import { showErrorMessage, showLoadingMessage, showSuccessMessage } from '@/lib/helper/notice-alert-helper';
import { FILE_NAME_PREFIX } from '@/lib/excel-export';
import { i18n } from '@/translations';

interface UserModel {
    created_at: Timestamp;
    domain_id?: string;
    email?: string;
    group?: string;
    language: string;
    last_accessed_at: Timestamp;
    mobile?: string;
    name: string;
    roles?: string[];
    state: string;
    tags?: {};
    timezone: string;
    user_id: string;
    api_key_count?: number;
}

const UserType = {
    API_USER: {
        label: 'API Only',
    },
    USER: {
        label: 'Console, API',
    },
};

export default {
    name: 'UserManagement',
    components: {
        PEmpty,
        PQuerySearchTable,
        PBreadcrumbs,
        PIconTextButton,
        UserForm,
        UserUpdateForm,
        PStatus,
        PHorizontalLayout,
        PSelectDropdown,
        UserDetail,
        UserAssignedRole,
        UserAPIKeyTable,
        UserNotifications,
        PTab,
        PTagsPanel,
        PDataTable,
        PTableCheckModal,
        PPageTitle,
        PPanelTop,
    },
    setup(props, { root }) {
        const vm = getCurrentInstance() as ComponentRenderProxy;
        const queryHelper = new ApiQueryHelper().setFiltersAsRawQueryString(vm.$route.query.filters);
        const handlers = {
            keyItemSets: [{
                title: 'Properties',
                items: [
                    {
                        name: 'user_id',
                        label: 'User ID',
                    },
                    {
                        name: 'name',
                        label: 'Name',
                    },
                    {
                        name: 'state',
                        label: 'State',
                    },
                    {
                        name: 'email',
                        label: 'E-mail',
                    },
                    {
                        name: 'user_type',
                        label: 'Access Control',
                    },
                    {
                        name: 'role_name',
                        label: 'Role',
                    },
                    {
                        name: 'backend',
                        label: 'Auth Type',
                    },
                    {
                        name: 'last_accessed_at',
                        label: 'Last Activity',
                    },
                    {
                        name: 'timezone',
                        label: 'Timezone',
                    },
                ],
            }],
            valueHandlerMap: {
                user_id: makeDistinctValueHandler('identity.User', 'user_id'),
                name: makeDistinctValueHandler('identity.User', 'name'),
                state: makeDistinctValueHandler('identity.User', 'state'),
                email: makeDistinctValueHandler('identity.User', 'email'),
                user_type: makeEnumValueHandler(UserType),
                role_name: makeDistinctValueHandler('identity.User', 'role_name'),
                backend: makeDistinctValueHandler('identity.User', 'backend'),
                last_accessed_at: makeDistinctValueHandler('identity.User', 'last_accessed_at'),
                timezone: makeDistinctValueHandler('identity.User', 'timezone'),
            },
        };
        const state = reactive({
            loading: true,
            users: [] as UserModel[],
            timezone: computed(() => store.state.user.timezone || 'UTC'),
            fields: computed(() => ([
                { name: 'user_id', label: 'User ID' },
                { name: 'name', label: 'Name' },
                { name: 'state', label: 'State' },
                { name: 'user_type', label: 'Access Control' },
                { name: 'api_key_count', label: 'API Key' },
                { name: 'role_name', label: 'Role'},
                { name: 'backend', label: 'Auth Type' },
                { name: 'last_accessed_at', label: 'Last Activity' },
                { name: 'timezone', label: 'Timezone' },
            ])),
            excelFields: [
                { key: 'user_id', name: 'User ID' },
                { key: 'name', name: 'Name' },
                { key: 'state', name: 'State' },
                { key: 'user_type', name: 'Access Control' },
                { key: 'api_key_count', name: 'API Key' },
                { key: 'role_bindings.role_info.name', name: 'Role' },
                { key: 'backend', name: 'Auth Type' },
                { key: 'last_accessed_at', name: 'Last Activity', type: 'datetime' },
                { key: 'timezone', name: 'Timezone' },
            ],
            sortBy: 'name',
            sortDesc: true,
            pageStart: 1,
            pageLimit: 15,
            totalCount: 0,
            // selected
            selectedIndex: [],
            selectedUsers: computed(() => {
                const users = [] as UserModel[];
                state.selectedIndex.map(d => users.push(state.users[d]));
                return users;
            }),
            isSelected: computed(() => state.selectedIndex.length > 0),
            dropdownMenu: computed(() => ([
                {
                    type: 'item',
                    name: 'update',
                    label: vm.$t('IDENTITY.USER.MAIN.UPDATE'),
                    disabled: state.selectedIndex.length > 1 || !state.isSelected,
                },
                {
                    type: 'item', name: 'delete', label: vm.$t('IDENTITY.USER.MAIN.DELETE'), disabled: !state.isSelected,
                },
                { type: 'divider' },
                {
                    type: 'item', name: 'enable', label: vm.$t('IDENTITY.USER.MAIN.ENABLE'), disabled: !state.isSelected,
                },
                {
                    type: 'item', name: 'disable', label: vm.$t('IDENTITY.USER.MAIN.DISABLE'), disabled: !state.isSelected,
                },
            ] as MenuItem[])),
            keyItemSets: handlers.keyItemSets as KeyItemSet[],
            valueHandlerMap: handlers.valueHandlerMap,
            tags: queryHelper.setKeyItemSets(handlers.keyItemSets).queryTags,
        });

        const modalState = reactive({
            visible: false,
            mode: '',
            title: '',
            subTitle: '',
            themeColor: '',
        });
        const userFormState = reactive({
            visible: false,
            updateMode: false,
            headerTitle: '',
            item: undefined,
            roleOfSelectedUser: '',
            isAdmin: computed(() => store.getters['user/isAdmin']).value,
        });
        const routeState = reactive({
            routes: computed(() => ([
                { name: i18n.t('MENU.IDENTITY.IDENTITY'), path: '/identity' },
                { name: i18n.t('MENU.IDENTITY.USER'), path: '/identity/user/user-management' },
                { name: i18n.t('IDENTITY.USER.MAIN.ROOT_ACCOUNT'), path: '/identity/user/user-management' },
                { name: i18n.t('IDENTITY.USER.MAIN.USER_MANAGEMENT') },
            ])),
        });

        const singleItemTabState = reactive({
            tabs: computed(() => ([
                { label: i18n.t('IDENTITY.USER.MAIN.DETAILS'), name: 'detail', keepAlive: true },
                { label: i18n.t('IDENTITY.USER.MAIN.TAG'), name: 'tag', keepAlive: true },
                { label: i18n.t('IDENTITY.USER.MAIN.ASSIGNED_ROLES'), name: 'assigned_role', keepAlive: true },
                { label: i18n.t('IDENTITY.USER.MAIN.API_KEY'), name: 'api_key', keepAlive: true },
                { label: i18n.t('IDENTITY.USER.MAIN.NOTIFICATION'), name: 'notifications', keepAlive: true },
            ] as TabItem[])),
            activeTab: 'detail',
        });

        const multiItemTabState = reactive({
            tabs: computed(() => ([
                { name: 'data', label: vm.$t('IDENTITY.USER.MAIN.TAB_SELECTED_DATA'), keepAlive: true },
            ] as TabItem[])),
            activeTab: 'data',
        });

        const apiQuery = new ApiQueryHelper();
        const getQuery = () => {
            apiQuery.setSort(state.sortBy, state.sortDesc)
                .setPage(state.pageStart, state.pageLimit)
                .setFilters(queryHelper.filters);
            return apiQuery.data;
        };

        const getArrayWithNotDuplicatedItem = array => [...new Set(array)];
        const getUserType = (userType: keyof typeof UserType) => {
            let formattedUserType;
            if (userType === 'API_USER') formattedUserType = UserType.API_USER.label;
            else formattedUserType = UserType.USER.label;
            return formattedUserType;
        };
        const getUsers = async () => {
            state.loading = true;
            try {
                const res = await SpaceConnector.client.identity.user.list({
                    query: getQuery(),
                    only: ['user_id', 'name', 'email', 'state', 'timezone', 'user_type', 'backend', 'last_accessed_at', 'api_key_count'],
                    include_role_binding: true,
                });
                state.users = res.results.map(d => ({
                    ...d,
                    api_key_count: d.api_key_count || 0,
                    user_type: getUserType(d.user_type),
                    role_name: (getArrayWithNotDuplicatedItem(d.role_bindings.map(data => data.role_info.name))).join(', '),
                    last_accessed_at: calculateTime(d.last_accessed_at, state.timezone),
                }));
                state.totalCount = res.total_count;
            } catch (e) {
                console.error(e);
                state.users = [];
                state.totalCount = 0;
            } finally {
                state.loading = false;
            }
        };

        const onSelect = async (index) => {
            state.selectedIndex = index;
            if (index.length === 1) {
                const res = await SpaceConnector.client.identity.roleBinding.list({
                    resource_type: 'identity.User',
                    resource_id: state.selectedUsers[0].user_id,
                    role_type: 'DOMAIN',
                });
                if (res.total_count > 0) userFormState.roleOfSelectedUser = res.results[0].role_info.role_id;
                else userFormState.roleOfSelectedUser = '';
            }
        };
        const onChange = async (changed) => {
            if (changed.pageLimit !== undefined) state.pageLimit = changed.pageLimit;
            if (changed.pageStart !== undefined) state.pageStart = changed.pageStart;
            if (changed.queryTags !== undefined) {
                state.tags = changed.queryTags;
                queryHelper.setFiltersAsQueryTag(changed.queryTags);
                replaceUrlQuery('filters', queryHelper.rawQueryStrings);
            }
            await getUsers();
        };
        const exportUserDataToExcel = async () => {
            try {
                showLoadingMessage(vm.$t('COMMON.EXCEL.ALT_L_READY_FOR_FILE_DOWNLOAD'), '', vm.$root);
                await store.dispatch('file/downloadExcel', {
                    url: '/identity/user/list',
                    param: {
                        query: getQuery(),
                        include_role_binding: true,
                    },
                    fields: state.excelFields,
                    file_name_prefix: FILE_NAME_PREFIX.user,
                });
            } catch (e) {
                console.error(e);
            }
        };

        const clickAdd = () => {
            userFormState.updateMode = false;
            userFormState.headerTitle = vm.$t('IDENTITY.USER.FORM.ADD_TITLE') as string;
            userFormState.item = undefined;
            userFormState.visible = true;
        };
        const clickUpdate = () => {
            userFormState.updateMode = true;
            userFormState.headerTitle = vm.$t('IDENTITY.USER.FORM.UPDATE_TITLE') as string;
            userFormState.item = state.users[state.selectedIndex[0]];
            userFormState.visible = true;
        };
        const clickDelete = () => {
            modalState.mode = 'delete';
            modalState.title = vm.$t('IDENTITY.USER.MAIN.DELETE_MODAL_TITLE') as string;
            modalState.subTitle = vm.$tc('IDENTITY.USER.MAIN.DELETE_MODAL_DESC', state.selectedIndex.length);
            modalState.themeColor = 'alert';
            modalState.visible = true;
        };
        const clickEnable = () => {
            modalState.mode = 'enable';
            modalState.title = vm.$t('IDENTITY.USER.MAIN.ENABLE_MODAL_TITLE') as string;
            modalState.subTitle = vm.$tc('IDENTITY.USER.MAIN.ENABLE_MODAL_DESC', state.selectedIndex.length);
            modalState.themeColor = 'safe';
            modalState.visible = true;
        };
        const clickDisable = () => {
            modalState.mode = 'disable';
            modalState.title = vm.$t('IDENTITY.USER.MAIN.DISABLE_MODAL_TITLE') as string;
            modalState.subTitle = vm.$tc('IDENTITY.USER.MAIN.DISABLE_MODAL_DESC', state.selectedIndex.length);
            modalState.themeColor = 'alert';
            modalState.visible = true;
        };

        const onSelectDropdown = (name) => {
            switch (name) {
            case 'enable': clickEnable(); break;
            case 'disable': clickDisable(); break;
            case 'delete': clickDelete(); break;
            case 'update': clickUpdate(); break;
            default: break;
            }
        };

        const getUsersParam = items => ({ users: map(items, 'user_id') });
        const bindRole = async (userId, roleId) => {
            try {
                await SpaceConnector.client.identity.roleBinding.create({
                    resource_type: 'identity.User',
                    resource_id: userId,
                    role_id: roleId,
                });
            } catch (e) {
                throw e;
            }
        };
        const unbindRole = async (userId, roleId) => {
            try {
                const res = await SpaceConnector.client.identity.roleBinding.list({
                    resource_type: 'identity.User',
                    resource_id: userId,
                    role_id: roleId,
                    role_type: 'DOMAIN',
                });
                const roleBindingId = res.results[0].role_binding_id;
                if (res.total_count > 0) {
                    await SpaceConnector.client.identity.roleBinding.delete({
                        role_binding_id: roleBindingId,
                    });
                }
            } catch (e) {
                throw e;
            }
        };
        const addUser = async (item, roleId) => {
            try {
                await SpaceConnector.client.identity.user.create({
                    ...item,
                });
                if (roleId.length > 0 || roleId !== '') {
                    await bindRole(item.user_id, roleId);
                }
                showSuccessMessage(vm.$t('IDENTITY.USER.MAIN.ALT_S_ADD_USER'), '', root);
            } catch (e) {
                showErrorMessage(vm.$t('IDENTITY.USER.MAIN.ALT_E_ADD_USER'), e, root);
            } finally {
                state.selectedIndex = [];
                userFormState.visible = false;
            }
        };
        const updateUser = async (item, roleId) => {
            try {
                await SpaceConnector.client.identity.user.update({
                    ...item,
                });
                if (roleId && roleId !== userFormState.roleOfSelectedUser) {
                    await bindRole(item.user_id, roleId);
                    userFormState.roleOfSelectedUser = roleId;
                }
                if (roleId === '' && userFormState.roleOfSelectedUser !== '') {
                    await unbindRole(item.user_id, roleId);
                    userFormState.roleOfSelectedUser = roleId;
                }
                showSuccessMessage(vm.$t('IDENTITY.USER.MAIN.ALT_S_UPDATE_USER'), '', root);
            } catch (e) {
                showErrorMessage(vm.$t('IDENTITY.USER.MAIN.ALT_E_UPDATE_USER'), e, root);
            } finally {
                await getUsers();
                state.selectedIndex = [];
                userFormState.visible = false;
            }
        };
        const userFormConfirm = async (item, roleId) => {
            if (userFormState.updateMode) {
                await updateUser(item, roleId);
            } else {
                await addUser(item, roleId);
            }
            await getUsers();
        };
        const deleteUser = async (items) => {
            try {
                await SpaceConnector.client.identity.user.delete(getUsersParam(items));
                showSuccessMessage(vm.$tc('IDENTITY.USER.MAIN.ALT_S_DELETE_USER', state.selectedIndex.length), '', root);
            } catch (e) {
                showErrorMessage(vm.$tc('IDENTITY.USER.MAIN.ALT_E_DELETE_USER', state.selectedIndex.length), e, root);
            } finally {
                state.selectedIndex = [];
                await getUsers();
                modalState.visible = false;
            }
        };
        const enableUser = async (items) => {
            try {
                await SpaceConnector.client.identity.user.enable(getUsersParam(items));
                showSuccessMessage(vm.$tc('IDENTITY.USER.MAIN.ALT_S_ENABLE', state.selectedIndex.length), '', root);
            } catch (e) {
                showErrorMessage(vm.$tc('IDENTITY.USER.MAIN.ALT_E_ENABLE', state.selectedIndex.length), e, root);
            } finally {
                await getUsers();
                modalState.visible = false;
            }
        };
        const disableUser = async (items) => {
            try {
                await SpaceConnector.client.identity.user.disable(getUsersParam(items));
                showSuccessMessage(vm.$tc('IDENTITY.USER.MAIN.ALT_S_DISABLE', state.selectedIndex.length), '', root);
            } catch (e) {
                showErrorMessage(vm.$tc('IDENTITY.USER.MAIN.ALT_E_DISABLE', state.selectedIndex.length), e, root);
            } finally {
                await getUsers();
                modalState.visible = false;
            }
        };
        const checkModalConfirm = async (item) => {
            if (modalState.mode === 'delete') await deleteUser(item);
            if (modalState.mode === 'enable') await enableUser(item);
            if (modalState.mode === 'disable') await disableUser(item);
        };

        const init = async () => {
            await Promise.all([
                store.dispatch('resource/project/load'),
                store.dispatch('resource/projectGroup/load'),
                store.dispatch('resource/user/load'),
            ]);
            await getUsers();
        };
        init();

        return {
            ...toRefs(state),
            ...toRefs(routeState),
            userFormState,
            userStateFormatter,
            modalState,
            singleItemTabState,
            multiItemTabState,
            getUsers,
            clickAdd,
            onSelectDropdown,
            userFormConfirm,
            checkModalConfirm,
            onSelect,
            onChange,
            exportUserDataToExcel,
        };
    },

};
</script>

<style lang="postcss" scoped>
.management-wrapper {
    @apply mx-0;
    max-width: 100%;

}

.left-toolbox-item {
    margin-left: 1rem;
    &:last-child {
        flex-grow: 1;
    }
}
#empty-space {
    @apply text-primary2 mt-6;
    text-align: center;
    margin-bottom: 0.5rem;
    font-size: 1.5rem;
}
.selected-data-tab {
    @apply mt-8;
}

.api-key-table::v-deep {
    .main-table-wrapper {
        border: 0;
    }
}

</style>
