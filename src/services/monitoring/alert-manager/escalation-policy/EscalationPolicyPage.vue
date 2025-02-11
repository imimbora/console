<template>
    <div class="escalation-policy-page">
        <p-breadcrumbs :routes="routeState.route" />
        <p-page-title :title="pageTitle"
                      use-total-count
                      use-selected-count
                      :total-count="tableState.totalCount"
                      :selected-count="selectedItem ? 1 : 0"
        />
        <div class="table-wrapper">
            <p-toolbox
                search-type="query"
                :total-count="tableState.totalCount"
                :query-tags="tableState.tags"
                :key-item-sets="handlers.keyItemSets"
                :value-handler-map="handlers.valueHandlerMap"
                @change="onChange"
                @refresh="onChange()"
            >
                <template #left-area>
                    <p-icon-text-button
                        class="create-button"
                        style-type="primary-dark"
                        name="ic_plus_bold"
                        @click="onSelectAction(ACTION.create)"
                    >
                        {{ $t('MONITORING.ALERT.ESCALATION_POLICY.CREATE') }}
                    </p-icon-text-button>
                    <p-select-dropdown
                        :selected="$t('MONITORING.ALERT.ESCALATION_POLICY.ACTION')"
                        :items="actionItems"
                        :disabled="!selectedItem"
                        @select="onSelectAction"
                    >
                        {{ $t('MONITORING.ALERT.ESCALATION_POLICY.ACTION') }}
                    </p-select-dropdown>
                </template>
            </p-toolbox>
            <escalation-policy-data-table
                :items="items"
                :loading="tableState.loading"
                :select-index.sync="selectIndex"
                @change="onChange"
            />
        </div>
        <!--modal-->
        <escalation-policy-form-modal
            :visible.sync="formModalVisible"
            :mode="formMode"
            :escalation-policy="selectedItem"
            @confirm="listEscalationPolicies"
        />
        <delete-modal
            class="delete-modal"
            :header-title="$t('MONITORING.ALERT.ESCALATION_POLICY.DELETE_MODAL_TITLE')"
            :visible.sync="deleteModalVisible"
            @confirm="deleteEscalationPolicy"
        />
    </div>
</template>

<script lang="ts">
/* eslint-disable camelcase */
import {
    reactive, toRefs, ComponentRenderProxy, getCurrentInstance, computed,
} from '@vue/composition-api';

import {
    PBreadcrumbs, PPageTitle, PIconTextButton, PSelectDropdown, PToolbox,
} from '@spaceone/design-system';
import EscalationPolicyFormModal from '@/services/monitoring/alert-manager/escalation-policy/modules/EscalationPolicyFormModal.vue';
import DeleteModal from '@/common/components/modals/DeleteModal.vue';
import EscalationPolicyDataTable from '@/services/monitoring/alert-manager/escalation-policy/modules/EscalationPolicyDataTable.vue';

import { SpaceConnector } from '@spaceone/console-core-lib/space-connector';
import { ApiQueryHelper } from '@spaceone/console-core-lib/space-connector/helper';
import { iso8601Formatter } from '@spaceone/console-core-lib';
import { showErrorMessage, showSuccessMessage } from '@/lib/helper/notice-alert-helper';
import {
    makeDistinctValueHandler, makeEnumValueHandler, makeReferenceValueHandler,
} from '@spaceone/console-core-lib/component-util/query-search';
import { replaceUrlQuery } from '@/lib/router-query-string';
import { KeyItemSet } from '@spaceone/design-system/dist/src/inputs/search/query-search/type';
import { store } from '@/store';
import { getApiQueryWithToolboxOptions } from '@spaceone/console-core-lib/component-util/toolbox';
import { ACTION, FINISH_CONDITION, SCOPE } from '@/services/monitoring/alert-manager/lib/config';


export default {
    name: 'EscalationPolicyPage',
    components: {
        EscalationPolicyFormModal,
        DeleteModal,
        EscalationPolicyDataTable,
        PBreadcrumbs,
        PPageTitle,
        PIconTextButton,
        PSelectDropdown,
        PToolbox,
    },
    setup(props, { root }) {
        const vm = getCurrentInstance() as ComponentRenderProxy;
        const escalationPolicyApiQueryHelper = new ApiQueryHelper()
            .setSort('created_at', true)
            .setPage(1, 15)
            .setFiltersAsRawQueryString(vm.$route.query.filters);
        const handlers = {
            keyItemSets: [{
                title: 'Properties',
                items: [
                    { name: 'escalation_policy_id', label: 'Escalation Policy' },
                    { name: 'name', label: 'Name' },
                    { name: 'finish_condition', label: 'Finish Condition' },
                    { name: 'scope', label: 'Scope' },
                    { name: 'project_id', label: 'Project' },
                    { name: 'created_at', label: 'Created', dataType: 'datetime' },
                ],
            }] as KeyItemSet[],
            valueHandlerMap: {
                escalation_policy_id: makeDistinctValueHandler('monitoring.EscalationPolicy', 'escalation_policy_id'),
                name: makeDistinctValueHandler('monitoring.EscalationPolicy', 'name'),
                finish_condition: makeEnumValueHandler(FINISH_CONDITION),
                scope: makeEnumValueHandler(SCOPE),
                project_id: makeReferenceValueHandler('identity.Project'),
            },
        };
        const tableState = reactive({
            loading: true,
            totalCount: 0,
            tags: escalationPolicyApiQueryHelper.setKeyItemSets(handlers.keyItemSets).queryTags,
        });
        const state = reactive({
            timezone: computed(() => store.state.user.timezone),
            pageTitle: computed(() => vm.$t('MONITORING.ALERT.ESCALATION_POLICY.ESCALATION_POLICY')),
            actionItems: computed(() => ([
                {
                    type: 'item',
                    name: 'update',
                    label: vm.$t('MONITORING.ALERT.ESCALATION_POLICY.UPDATE'),
                },
                {
                    type: 'item',
                    name: 'delete',
                    label: vm.$t('MONITORING.ALERT.ESCALATION_POLICY.DELETE'),
                    disabled: state.selectedItem?.is_default,
                },
                {
                    type: 'item',
                    name: 'default',
                    label: vm.$t('MONITORING.ALERT.ESCALATION_POLICY.SET_AS_DEFAULT'),
                    disabled: state.selectedItem?.scope === SCOPE.project,
                },
            ])),
            escalationPolicies: [],
            items: [],
            selectIndex: [],
            selectedItem: computed(() => state.escalationPolicies[state.selectIndex[0]]),
            deleteModalVisible: false,
            formModalVisible: false,
            formMode: undefined,
        });
        const routeState = reactive({
            route: computed(() => [
                { name: vm.$t('MENU.MONITORING.MONITORING'), path: '/monitoring' },
                { name: vm.$t('MENU.MONITORING.ALERT_MANAGER'), path: '/monitoring/alert-manager/dashboard' },
                { name: vm.$t('MONITORING.ALERT.ESCALATION_POLICY.ESCALATION_POLICY') },
            ]),
        });

        /* api */
        let escalationPolicyApiQuery = escalationPolicyApiQueryHelper.data;
        const listEscalationPolicies = async () => {
            try {
                tableState.loading = true;
                const res = await SpaceConnector.client.monitoring.escalationPolicy.list({
                    query: escalationPolicyApiQuery,
                });
                state.escalationPolicies = res.results;
                state.items = res.results.map(d => ({
                    ...d,
                    name: {
                        label: d.name,
                        isDefault: d.is_default,
                    },
                    created_at: iso8601Formatter(d.created_at, state.timezone),
                }));
                tableState.totalCount = res.total_count;
            } catch (e) {
                state.items = [];
                console.error(e);
            } finally {
                tableState.loading = false;
            }
        };
        const setDefaultEscalationPolicy = async () => {
            try {
                await SpaceConnector.client.monitoring.escalationPolicy.setDefault({
                    escalation_policy_id: state.selectedItem.escalation_policy_id,
                });
                showSuccessMessage(vm.$t('MONITORING.ALERT.ESCALATION_POLICY.ALT_S_SET_AS_DEFAULT'), '', root);
                await listEscalationPolicies();
            } catch (e) {
                console.error(e);
                showErrorMessage(vm.$t('MONITORING.ALERT.ESCALATION_POLICY.ALT_E_SET_AS_DEFAULT'), e, root);
            }
        };
        const deleteEscalationPolicy = async () => {
            try {
                await SpaceConnector.client.monitoring.escalationPolicy.delete({
                    escalation_policy_id: state.selectedItem.escalation_policy_id,
                });
                showSuccessMessage(vm.$t('MONITORING.ALERT.ESCALATION_POLICY.ALT_S_DELETE_POLICY'), '', root);
                await listEscalationPolicies();
            } catch (e) {
                console.error(e);
                showErrorMessage(vm.$t('MONITORING.ALERT.ESCALATION_POLICY.ALT_E_DELETE_POLICY'), e, root);
            } finally {
                state.deleteModalVisible = false;
            }
        };

        /* event */
        const onSelectAction = (action) => {
            state.formMode = action;
            if (action === ACTION.create) {
                state.formModalVisible = true;
            } else if (action === ACTION.update) {
                state.formModalVisible = true;
            } else if (action === ACTION.delete) {
                state.deleteModalVisible = true;
            } else if (action === ACTION.default) {
                setDefaultEscalationPolicy();
            }
        };
        const onChange = async (options: any = {}) => {
            escalationPolicyApiQuery = getApiQueryWithToolboxOptions(escalationPolicyApiQueryHelper, options) ?? escalationPolicyApiQuery;
            if (options.queryTags !== undefined) {
                await replaceUrlQuery('filters', escalationPolicyApiQueryHelper.rawQueryStrings);
            }
            await listEscalationPolicies();
        };

        /* init */
        (async () => {
            await Promise.all([
                store.dispatch('resource/project/load'),
                store.dispatch('resource/protocol/load'),
                listEscalationPolicies(),
            ]);
        })();

        return {
            ...toRefs(state),
            ACTION,
            routeState,
            tableState,
            handlers,
            onSelectAction,
            onChange,
            listEscalationPolicies,
            deleteEscalationPolicy,
        };
    },
};
</script>

<style lang="postcss" scoped>
.escalation-policy-page {
    .table-wrapper {
        @apply bg-white border border-gray-200 rounded-md;
    }
    .p-toolbox::v-deep {
        padding: 1.5rem 1rem 0.5rem;

        .left-area-wrapper {
            display: flex;
        }
        .create-button {
            margin-right: 1rem;
        }
    }
}
</style>
