<template>
    <widget-layout class="top-projects">
        <template #title>
            <div class="top grid grid-cols-12">
                <span class="title col-span-8 md:col-span-10">{{ $t('COMMON.WIDGETS.TOP_PROJECT_TITLE') }}</span>
                <router-link :to="{ name: PROJECT_ROUTE._NAME }" class="create-project-button">
                    <p-i name="ic_plus" width="1rem" height="1rem"
                         color="inherit"
                         class="add-icon"
                    />
                    <span class="hidden sm:block">{{ $t('COMMON.WIDGETS.TOP_PROJECT_CREATE_PROJECT') }}</span>
                    <span class="block sm:hidden">{{ $t('COMMON.WIDGETS.TOP_PROJECT_PROJECT') }}</span>
                </router-link>
            </div>
        </template>
        <div class="contents-container">
            <p-chart-loader :loading="loading" class="chart">
                <template #loader>
                    <p-skeleton width="100%" height="100%" />
                </template>
                <div ref="chartRef" class="chart" />
            </p-chart-loader>
            <div v-if="!loading && data.length === 0"
                 class="no-data-wrapper"
            >
                <p class="title">
                    {{ $t('COMMON.WIDGETS.TOP_PROJECTS.NO_PROJECT') }}
                </p>
                <p class="text">
                    {{ $t('COMMON.WIDGETS.TOP_PROJECTS.NO_PROJECT_HELP_TEXT') }}
                </p>
                <router-link :to="{ name: PROJECT_ROUTE._NAME }">
                    <p-icon-text-button name="ic_plus" style-type="primary1">
                        <span>{{ $t('COMMON.WIDGETS.TOP_PROJECTS.CREATE_PROJECT') }}</span>
                    </p-icon-text-button>
                </router-link>
            </div>
            <template v-else>
                <p-data-table
                    :loading="loading"
                    :fields="fields"
                    :items="data"
                    :bordered="false"
                >
                    <template #col-rank-format="{ index }">
                        <span class="col-rank">{{ `# ${index + 1}` }}</span>
                    </template>
                    <template #col-project_group-format="{ value }">
                        <router-link class="link-text" :to="value.to">
                            <span>{{ value.label }}</span>
                        </router-link>
                    </template>
                    <template #col-project-format="{ value }">
                        <router-link class="link-text" :to="value.to">
                            <span>{{ value.label }}</span>
                        </router-link>
                    </template>
                    <template #col-server-format="{ value }">
                        <router-link class="link-text" :to="value.to">
                            <span>{{ value.label }}</span>
                        </router-link>
                    </template>
                    <template #col-database-format="{ value }">
                        <router-link class="link-text" :to="value.to">
                            <span>{{ value.label }}</span>
                        </router-link>
                    </template>
                    <template #col-storage-format="{ value }">
                        <router-link class="link-text" :to="value.to">
                            <span>{{ value.label }}</span>
                        </router-link>
                    </template>
                </p-data-table>
            </template>
        </div>
    </widget-layout>
</template>

<script lang="ts">
/* eslint-disable camelcase */
import { orderBy, range } from 'lodash';
import bytes from 'bytes';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';
import { Location } from 'vue-router';

import {
    ComponentRenderProxy, computed, getCurrentInstance, onUnmounted, reactive, toRefs, watch,
} from '@vue/composition-api';

import {
    PChartLoader, PDataTable, PIconTextButton, PSkeleton, PI,
} from '@spaceone/design-system';

import WidgetLayout from '@/common/components/layouts/WidgetLayout.vue';

import { referenceRouter } from '@/lib/reference/referenceRouter';
import { SpaceConnector } from '@spaceone/console-core-lib/space-connector';
import {
    gray, peacock, secondary,
} from '@/styles/colors';
import { QueryHelper } from '@spaceone/console-core-lib/query';
import { INVENTORY_ROUTE } from '@/services/inventory/routes';
import { PROJECT_ROUTE } from '@/services/project/routes';
import config from '@/lib/config';

am4core.useTheme(am4themes_animated);

enum CLOUD_SERVICE_LABEL {
    compute = 'Compute',
    database = 'Database',
    storage = 'Storage',
}

interface ChartData {
    rank: string;
    server: number;
    database: number;
}
interface ProjectData {
    project_id: string;
    project: string;
    project_group: string;
    project_group_id: string;
    servers?: number;
    total?: number;
}

const DATA_COUNT = 5;
const COMPUTE_COLOR = secondary;
const DATABASE_COLOR = peacock[200];


export default {
    name: 'TopProjects',
    components: {
        WidgetLayout,
        PDataTable,
        PIconTextButton,
        PChartLoader,
        PSkeleton,
        PI,
    },
    props: {
        extraParams: {
            type: Object,
            default: () => ({}),
        },
    },
    setup(props) {
        const vm = getCurrentInstance() as ComponentRenderProxy;

        const state = reactive({
            loading: true,
            data: [] as ProjectData[],
            chartData: [] as ChartData[],
            chartRef: null as HTMLElement | null,
            chart: null as null | any,
            colors: {
                server: COMPUTE_COLOR,
                database: DATABASE_COLOR,
            },
            fields: computed(() => [
                { name: 'rank', label: vm.$t('COMMON.WIDGETS.TOP_PROJECT_RANK'), width: 3 },
                { name: 'project_group', label: vm.$t('COMMON.WIDGETS.TOP_PROJECT_PROJECT_GROUP') },
                { name: 'project', label: vm.$t('COMMON.WIDGETS.TOP_PROJECT_PROJECT') },
                { name: 'server', label: vm.$t('COMMON.WIDGETS.TOP_PROJECT_COMPUTE') },
                { name: 'database', label: vm.$t('COMMON.WIDGETS.TOP_PROJECT_DATABASE') },
                { name: 'storage', label: vm.$t('COMMON.WIDGETS.TOP_PROJECT_STORAGE') },
            ]),
        });

        /* util */
        const drawChart = (chartContext) => {
            const chart = am4core.create(chartContext, am4charts.XYChart);
            if (!config.get('AMCHARTS_LICENSE.ENABLED')) chart.logo.disabled = true;
            chart.paddingRight = 10;
            chart.paddingLeft = -5;
            chart.paddingTop = 5;
            chart.paddingBottom = 0;

            const projectAxis = chart.yAxes.push(new am4charts.CategoryAxis());
            projectAxis.renderer.minGridDistance = 0;
            projectAxis.dataFields.category = 'rank';

            projectAxis.renderer.grid.template.location = 0;
            projectAxis.renderer.grid.template.strokeOpacity = 1;
            projectAxis.renderer.grid.template.stroke = am4core.color(gray[200]);
            projectAxis.renderer.labels.template.fill = am4core.color(gray[400]);
            projectAxis.renderer.cellStartLocation = 0.3;
            projectAxis.renderer.cellEndLocation = 0.7;
            projectAxis.fontSize = 11;

            const valueAxis = chart.xAxes.push(new am4charts.ValueAxis());
            valueAxis.renderer.minGridDistance = 60;
            valueAxis.renderer.grid.template.stroke = am4core.color(gray[200]);
            valueAxis.renderer.grid.template.strokeOpacity = 1;
            valueAxis.renderer.grid.template.adapter.add('strokeOpacity', (opacity, target) => {
                // @ts-ignore
                if (target.dataItem && (target.dataItem.value === 0)) return 0;
                return opacity;
            });
            valueAxis.renderer.labels.template.adapter.add('text', (label, target) => {
                // @ts-ignore
                if (target.dataItem && (target.dataItem.value === 0)) return '';
                return label;
            });
            valueAxis.renderer.labels.template.fill = am4core.color(gray[500]);
            valueAxis.renderer.baseGrid.disabled = true;
            valueAxis.fontSize = 11;

            const createSeries = (field, name) => {
                const series = chart.series.push(new am4charts.ColumnSeries());
                series.name = name;
                series.dataFields.categoryY = 'rank';
                series.dataFields.valueX = field;
                series.fill = am4core.color(state.colors[field]);
                series.stacked = true;
                series.stroke = am4core.color('white');
                series.strokeWidth = 1;
                series.strokeOpacity = 0;
            };

            if (!state.chartData.length) {
                const emptyChartData = [] as ChartData[];
                range(0, 5).forEach((d) => {
                    emptyChartData.unshift({
                        rank: `#${d + 1}`,
                        server: 0,
                        database: 0,
                    });
                });
                chart.data = emptyChartData;
                valueAxis.min = 1;
            } else {
                chart.data = state.chartData;
            }
            createSeries('server', 'Server');
            createSeries('database', 'Database');

            chart.legend = new am4charts.Legend();
            chart.legend.position = 'bottom';
            chart.legend.contentAlign = 'left';
            chart.legend.paddingTop = -10;
            chart.legend.paddingLeft = 20;
            chart.legend.fontSize = 12;
            chart.legend.labels.template.fill = am4core.color(gray[400]);
            chart.legend.markers.template.width = 8;
            chart.legend.markers.template.height = 8;

            state.chart = chart;
        };

        const queryHelper = new QueryHelper();
        const getLocation = (type, projectId) => {
            const query: Location['query'] = {};

            query.provider = 'all';
            query.service = CLOUD_SERVICE_LABEL[type];
            if (type === 'storage') query.primary = 'false';

            const location: Location = {
                name: INVENTORY_ROUTE.CLOUD_SERVICE.TYPE._NAME,
                query: {
                    filters: queryHelper.setFilters([
                        { k: 'project_id', v: projectId, o: '=' },
                    ]).rawQueryStrings,
                    ...query,
                },
            };
            return location;
        };

        /* api */
        const getData = async () => {
            state.loading = true;
            try {
                const res = await SpaceConnector.client.statistics.topic.topProject(props.extraParams);
                const data = res.results.map(d => ({
                    rank: d.rank,
                    project_group: {
                        label: d.project_group,
                        to: referenceRouter(d.project_group_id, { resource_type: 'identity.ProjectGroup' }),
                    },
                    project: {
                        label: d.project,
                        to: referenceRouter(d.project_id, { resource_type: 'identity.Project' }),
                    },
                    server: {
                        label: d.server_count,
                        to: getLocation('compute', d.project_id),
                    },
                    database: {
                        label: d.database_count,
                        to: getLocation('database', d.project_id),
                    },
                    storage: {
                        label: bytes(d.storage_size, { unitSeparator: ' ' }),
                        to: getLocation('storage', d.project_id),
                    },
                }));
                const orderedData = orderBy(data, ['total'], ['desc']);
                state.data = orderedData;

                const chartData = [] as ChartData[];
                range(0, DATA_COUNT).forEach((idx) => {
                    chartData.push({
                        rank: `#${idx + 1}`,
                        server: 0,
                        database: 0,
                    });
                });
                orderedData.forEach((d, idx) => {
                    chartData.splice(idx, 1, {
                        rank: `#${idx + 1}`,
                        server: d.server.label,
                        database: d.database.label,
                    });
                });
                state.chartData = chartData.reverse();
            } catch (e) {
                console.error(e);
                state.chartData = [];
            } finally {
                state.loading = false;
            }
        };

        const init = async () => {
            await getData();
        };
        init();

        watch([() => state.chartRef, () => state.chartData], ([chartContext, data]) => {
            if (chartContext && data) {
                drawChart(chartContext);
            }
        });

        onUnmounted(() => {
            if (state.chart) state.chart.dispose();
        });

        return {
            ...toRefs(state),
            PROJECT_ROUTE,
        };
    },
};
</script>

<style lang="postcss" scoped>
.top-projects {
    .top {
        position: relative;
    }
    .title {
        @apply text-gray-900;
        font-size: 1.125rem;
        line-height: 1.2;
        font-weight: bold;
    }
    .create-project-button {
        @apply text-secondary;
        position: absolute;
        display: inline-flex;
        right: 1.25rem;
        top: 0.25rem;
        font-size: 0.75rem;
        &:hover {
            @apply text-blue-800;
        }

        .add-icon {
            margin-right: 0.25rem;
        }
    }
}
.contents-container {
    @apply pt-4 flex flex-col h-full;

    .no-data-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1.25rem 0;

        .title {
            @apply text-primary2;
            font-size: 0.875rem;
            line-height: 1.5;
        }
        .text {
            @apply text-gray-400;
            font-size: 0.875rem;
            line-height: 1.6;
            padding-bottom: 0.5rem;
        }
    }
}
.chart {
    height: 13rem;
}
.p-data-table::v-deep {
    border-radius: 0.125rem;
    margin-top: 0.5rem;
    th {
        @apply bg-gray-100 text-gray-400;
        height: 1.5rem;
        border: none;
        font-size: 0.75rem;
    }
    td {
        height: 2rem;
        .col-rank {
            @apply text-gray-600;
        }
        .link-text {
            &:hover {
                text-decoration: underline;
            }
        }
    }
}
</style>
