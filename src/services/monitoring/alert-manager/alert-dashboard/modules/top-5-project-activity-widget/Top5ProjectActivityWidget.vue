<template>
    <div class="top-project-activity-widget">
        <div class="title-wrapper">
            <div class="left-part">
                <span class="title">
                    {{ $t('MONITORING.ALERT.DASHBOARD.TOP_5_PROJECT_ACTIVITY') }}
                </span>
                <div class="legend-wrapper">
                    <p-status v-for="(activity, idx) in Object.keys(ACTIVITY)" :key="`status-${idx}`"
                              :icon-color="ACTIVITY_COLOR[activity]"
                              :text="capitalize(activity)"
                    />
                </div>
            </div>
            <div class="period-wrapper">
                <p-select-status v-for="(period, idx) in periods" :key="`period-${idx}`"
                                 v-model="selectedPeriod"
                                 :value="period.name"
                                 :disable-check-icon="true"
                >
                    {{ period.label }}
                </p-select-status>
            </div>
        </div>
        <div class="content-wrapper">
            <p-skeleton v-if="loading" width="100%" height="100%" />
            <template v-else>
                <div v-for="(projectId, idx) in top5Projects" :key="`table-row-${idx}`"
                     class="table-row"
                >
                    <p-anchor :to="referenceRouter(projectId,{ resource_type: 'identity.Project' })"
                              :show-icon="false"
                              target="_self"
                              class="col-name"
                    >
                        <span v-tooltip.bottom="projectNameFormatter(projectId)" class="tablet:hidden">{{ projectNameFormatter(projectId) }}</span>
                        <span class="tablet-text">{{ projectNameFormatter(projectId) }}</span>
                    </p-anchor>
                    <div class="col-activity">
                        <div v-for="(activity, aIdx) in activity[projectId]" :key="`activity-${aIdx}`"
                             class="box-wrapper"
                        >
                            <div class="box" :class="activity.status ? activity.status : 'empty'" @click="onClickBox(projectId, activity.date)">
                                <top5-project-activity-tooltip
                                    :project-id="projectId"
                                    :status="activity.status"
                                    :date="activity.date"
                                    :period="selectedPeriod"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import { capitalize, find } from 'lodash';
import dayjs from 'dayjs';

import {
    ComponentRenderProxy,
    computed, getCurrentInstance, reactive, toRefs, watch,
} from '@vue/composition-api';

import {
    PAnchor, PSelectStatus, PStatus, PSkeleton,
} from '@spaceone/design-system';

import Top5ProjectActivityTooltip from '@/services/monitoring/alert-manager/alert-dashboard/modules/top-5-project-activity-widget/Top5ProjectActivityTooltip.vue';

import { referenceRouter } from '@/lib/reference/referenceRouter';
import { store } from '@/store';
import { red, yellow } from '@/styles/colors';
import { SpaceConnector } from '@spaceone/console-core-lib/space-connector';
import { QueryHelper } from '@spaceone/console-core-lib/query';
import { MONITORING_ROUTE } from '@/services/monitoring/routes';


const ACTIVITY = Object.freeze({
    HIGH: 'HIGH',
    LOW: 'LOW',
    // MAINTENANCE: 'MAINTENANCE',
});
const ACTIVITY_COLOR = Object.freeze({
    HIGH: red[400],
    LOW: red[200],
    MAINTENANCE: yellow[400],
});
const PERIOD = Object.freeze({
    '14D': '14d',
    '7D': '7d',
    '24H': '24h',
    '12H': '12h',
});
const DATE_TYPE = Object.freeze({
    DAILY: 'DAILY',
    HOURLY: 'HOURLY',
});

interface Activity {
    date: string;
    status?: string;
}
interface ProjectActivity {
    projectId: string;
    activities: Activity[];
}

export default {
    name: 'Top5ProjectActivityWidget',
    components: {
        PAnchor,
        PStatus,
        PSelectStatus,
        PSkeleton,
        Top5ProjectActivityTooltip,
    },
    props: {
        projectsWithAlert: {
            type: Array,
            default: () => ([]),
        },
    },
    setup() {
        const vm = getCurrentInstance() as ComponentRenderProxy;
        const state = reactive({
            loading: true,
            projects: computed(() => store.state.resource.project.items),
            top5Projects: [] as string[],
            activity: {},
            periods: [
                {
                    name: PERIOD['14D'],
                    label: '14d',
                },
                {
                    name: PERIOD['7D'],
                    label: '7d',
                },
                {
                    name: PERIOD['24H'],
                    label: '24h',
                },
                {
                    name: PERIOD['12H'],
                    label: '12h',
                },
            ],
            selectedPeriod: PERIOD['14D'],
            showTooltip: false,
        });

        /* util */
        const activityFormatter = (results, unit, start, end) => {
            const dateFormat = unit === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH';
            let now = start.clone();
            const activities: Activity[] = [];

            while (now.isBefore(end, unit)) {
                const isHigh = find(results, { urgency: 'HIGH', date: now.format(dateFormat) });
                const isLow = find(results, { urgency: 'LOW', date: now.format(dateFormat) });
                let status;
                if (isLow) status = 'LOW';
                if (isHigh) status = 'HIGH';
                activities.push({
                    date: now.format(dateFormat),
                    status,
                });
                now = now.add(1, unit);
            }
            return activities;
        };
        const periodNumberFormatter = period => parseInt(period.match(/\d+/)[0]);
        const projectNameFormatter = projectId => (state.projects[projectId] ? state.projects[projectId].label : projectId);

        /* api */
        const getTop5ProjectList = async () => {
            try {
                const { results } = await SpaceConnector.client.monitoring.dashboard.top5ProjectActivityList({
                    period: state.selectedPeriod,
                });
                state.top5Projects = results.map(d => d.project_id);
            } catch (e) {
                console.error(e);
            }
        };
        const getActivities = async (projectId) => {
            try {
                const unit = state.selectedPeriod.includes('d') ? 'day' : 'hour';
                const end = dayjs.utc().add(1, unit).startOf(unit);
                const start = end.subtract(periodNumberFormatter(state.selectedPeriod), unit);

                const { results } = await SpaceConnector.client.monitoring.dashboard.top5ProjectActivityAlertDetails({
                    project_id: projectId,
                    granularity: state.selectedPeriod.includes('d') ? DATE_TYPE.DAILY : DATE_TYPE.HOURLY,
                    start: start.toISOString(),
                    end: end.toISOString(),
                });
                state.activity[projectId] = activityFormatter(results, unit, start, end);
            } catch (e) {
                state.activity[projectId] = [];
                console.error(e);
            }
        };

        /* event */
        const onMouseOver = (status) => {
            if (status) state.showTooltip = true;
        };
        const onMouseLeave = () => {
            state.showTooltip = false;
        };
        const urlQueryHelper = new QueryHelper();
        const onClickBox = (projectId, date) => {
            urlQueryHelper.setFilters([
                { k: 'project_id', v: projectId, o: '=' },
                { k: 'created_at', v: date.split(' ')[0], o: '=t' },
            ]);
            vm.$router.replace({
                name: MONITORING_ROUTE.ALERT_MANAGER.ALERT._NAME,
                query: { filters: urlQueryHelper.rawQueryStrings },
            });
        };

        watch(() => state.selectedPeriod, async () => {
            state.loading = true;
            await getTop5ProjectList();
            await Promise.all(state.top5Projects.map(d => getActivities(d)));
            state.loading = false;
        }, { immediate: true });

        return {
            ...toRefs(state),
            ACTIVITY,
            ACTIVITY_COLOR,
            referenceRouter,
            capitalize,
            projectNameFormatter,
            onMouseOver,
            onMouseLeave,
            onClickBox,
        };
    },
};
</script>

<style lang="postcss" scoped>
.top-project-activity-widget {
    @apply bg-white border border-gray-200 rounded-md;
    padding: 1rem;

    .title-wrapper {
        display: flex;
        margin-bottom: 1rem;
        justify-content: space-between;

        .title {
            @apply text-gray-900;
            font-size: 1rem;
            line-height: 1.6;
            font-weight: bold;
        }

        .legend-wrapper {
            display: inline-flex;
            font-size: 0.75rem;
            gap: 0.75rem;
            padding-left: 1rem;
        }

        .period-wrapper {
            @apply text-gray-700;
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
            font-size: 0.875rem;
        }
    }
    .content-wrapper {
        @apply grid;
        display: grid;
        gap: 0.125rem;
        max-height: 6.75rem;

        .table-row {
            @apply grid grid-cols-12;
            gap: 0.5rem;

            .col-name {
                @apply col-span-3 truncate;
                text-align: right;
                font-size: 0.75rem;

                .tablet-text {
                    display: none;
                }
            }
            .col-activity {
                @apply col-span-9;
                display: flex;
                gap: 0.125rem;

                .box-wrapper {
                    @apply bg-gray-200;
                    position: relative;
                    width: 100%;
                    height: 1.25rem;

                    .box {
                        width: 100%;
                        height: 100%;
                        box-sizing: border-box;

                        &.HIGH {
                            @apply bg-red-400;
                            &:hover {
                                @apply border-red-700;
                                border-width: 0.25rem;
                            }
                        }
                        &.LOW {
                            @apply bg-red-200;
                            &:hover {
                                @apply border-red-400;
                                border-width: 0.25rem;
                            }
                        }
                        &.MAINTENANCE {
                            @apply bg-yellow-300;
                            &:hover {
                                @apply border-yellow-700;
                                border-width: 0.25rem;
                            }
                        }
                        &:hover:not(.empty) {
                            .top5-project-activity-tooltip {
                                display: block;
                            }
                        }
                    }
                }
            }
        }
    }

    @screen tablet {
        .title-wrapper {
            display: block;

            .title {
                display: block;
                margin-bottom: 1rem;
            }

            .legend-wrapper {
                display: flex;
                padding-left: 0;
                padding-bottom: 1rem;
            }
        }

        .content-wrapper {
            .table-row {
                .col-name {
                    .tablet-text {
                        display: contents;
                    }
                }
            }
        }
    }
}
</style>
