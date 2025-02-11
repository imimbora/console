<template>
    <div class="project-all-summary">
        <div class="title">
            <span>{{ $t('COMMON.WIDGETS.ALL_SUMMARY.TITLE') }}</span>
        </div>
        <p-balloon-tab v-model="activeTab" size="sm" style-type="primary"
                       :tabs="tabs" tail
        >
            <template #tab="{name}">
                <div class="box" :class="{selected: name === activeTab}">
                    <span>{{ dataMap[name].label }}</span>
                    <span v-if="name === 'storage'" class="suffix">({{ storageSuffix }})</span>
                    <span class="count"> {{ name === 'storage' ? byteFormatter(count[name]).split(' ')[0] : commaFormatter(count[name]) }}</span>
                </div>
            </template>
            <div class="bottom-part">
                <div class="content-wrapper grid grid-cols-12 gap-2">
                    <div class="chart-wrapper col-span-12 lg:col-span-7">
                        <div class="sub-title">
                            <span>{{ $t('COMMON.WIDGETS.ALL_SUMMARY.TREND_TITLE') }}</span>
                            <span v-if="activeTab === 'storage'" class="suffix">({{ storageTrendSuffix }})</span>
                        </div>
                        <div class="toggle-button-group">
                            <p-button v-for="(d, idx) in dateTypes"
                                      :key="idx"
                                      :class="{'selected': selectedDateType === d.name}"
                                      @click="onClickDateTypeButton(d.name)"
                            >
                                {{ d.label }}
                            </p-button>
                        </div>
                        <p-chart-loader :loading="chartState.loading">
                            <template #loader>
                                <p-skeleton width="100%" height="100%" />
                            </template>
                            <div ref="chartRef" class="chart" />
                        </p-chart-loader>
                    </div>
                    <div class="col-span-12 md:col-span-4 lg:col-span-2 summary-wrapper">
                        <div class="sub-title">
                            {{ $t('COMMON.WIDGETS.ALL_SUMMARY.TYPE_TITLE', { service: dataMap[activeTab].label }) }}
                        </div>
                        <template v-if="!loading && summaryData.length > 0">
                            <div class="summary-content-wrapper">
                                <router-link :to="getLocation(activeTab)"
                                             class="summary-row"
                                >
                                    <div class="text-group">
                                        <span>{{ $t('COMMON.WIDGETS.ALL_SUMMARY.ALL') }}</span>
                                    </div>
                                    <span class="count">{{ activeTab === 'storage' ? byteFormatter(count[activeTab]) : commaFormatter(count[activeTab]) }}</span>
                                </router-link>
                                <router-link v-for="(data, idx) of summaryData" :key="idx"
                                             :to="data.to"
                                             class="summary-row"
                                >
                                    <div class="text-group">
                                        <span class="provider" :style="{ color: colorState[data.label.toLowerCase()] }">{{ data.label }}</span>
                                        <span class="type">{{ data.type }}</span>
                                    </div>
                                    <span class="count">{{ data.count }}</span>
                                </router-link>
                            </div>
                        </template>
                        <template v-else-if="!loading">
                            <div class="summary-content-wrapper no-data-wrapper grid">
                                <div class="m-auto">
                                    <img src="@/assets/images/illust_cloud.svg" class="empty-image hidden lg:block">
                                    <p class="text">
                                        {{ $t('COMMON.WIDGETS.ALL_SUMMARY.NO_SERVICE', { service: dataMap[activeTab].label }) }}
                                    </p>
                                </div>
                            </div>
                        </template>
                        <template v-else>
                            <div v-for="v in skeletons" :key="v" class="flex items-center p-2 col-span-3">
                                <p-skeleton class="flex-grow" />
                            </div>
                        </template>
                    </div>
                    <div class="col-span-12 md:col-span-5 lg:col-span-3 region-service-wrapper">
                        <div class="sub-title">
                            <span>{{ $t('COMMON.WIDGETS.ALL_SUMMARY.REGION_SERVICE_TITLE') }}</span>
                        </div>
                        <project-region-service :project-id="projectId" :label="selectedLabel" :count="count[activeTab]" />
                    </div>
                </div>
            </div>
        </p-balloon-tab>
    </div>
</template>

<script lang="ts">
/* eslint-disable camelcase */
import {
    forEach, orderBy, range,
} from 'lodash';
import bytes from 'bytes';
import dayjs from 'dayjs';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';
import { TranslateResult } from 'vue-i18n';
import { Location } from 'vue-router';

import {
    reactive, toRefs, watch, computed,
    onUnmounted, ComponentRenderProxy, getCurrentInstance,
} from '@vue/composition-api';

import ProjectRegionService from '@/services/project/project-detail/project-summary/modules/ProjectRegionService.vue';
import {
    PChartLoader, PSkeleton, PButton, PBalloonTab,
} from '@spaceone/design-system';

import { SpaceConnector } from '@spaceone/console-core-lib/space-connector';
import { QueryHelper } from '@spaceone/console-core-lib/query';
import { QueryStoreFilter } from '@spaceone/console-core-lib/query/type';
import { gray, primary1, primary2 } from '@/styles/colors';
import { store } from '@/store';
import { INVENTORY_ROUTE } from '@/services/inventory/routes';
import config from '@/lib/config';

am4core.useTheme(am4themes_animated);

/* enum */
enum DATE_TYPE {
    daily = 'DAILY',
    monthly = 'MONTHLY',
}
enum DATA_TYPE {
    compute = 'compute',
    container = 'container',
    database = 'database',
    networking = 'networking',
    storage = 'storage',
    security = 'security',
    analytics = 'analytics',
    all = 'all',
}
enum CLOUD_SERVICE_LABEL {
    compute = 'Compute',
    container = 'Container',
    database = 'Database',
    networking = 'Networking',
    storage = 'Storage',
    security = 'Security',
    analytics = 'Analytics',
    all = 'All',
}

/* type */
type Unit = 'b' | 'gb' | 'kb' | 'mb' | 'pb' | 'tb' | 'B' | 'GB' | 'KB' | 'MB' | 'PB' | 'TB';
interface ChartData {
    date: string;
    count: number;
}
interface Data {
    type: keyof typeof DATA_TYPE;
    label: TranslateResult;
}
interface SummaryData {
    type: string;
    provider: string;
    label: string | TranslateResult;
    count: number | string;
    to: string | Location;
}

const DAY_COUNT = 14;
const MONTH_COUNT = 12;

export default {
    name: 'ProjectAllSummary',
    components: {
        ProjectRegionService,
        PButton,
        PSkeleton,
        PChartLoader,
        PBalloonTab,
    },
    props: {
        projectId: {
            type: String,
            required: true,
        },
    },
    setup(props) {
        const vm = getCurrentInstance() as ComponentRenderProxy;
        const queryHelper = new QueryHelper();

        const byteFormatter = (num, option = {}) => bytes(num, { ...option, unitSeparator: ' ', decimalPlaces: 1 });
        const numberFormatter = (num) => {
            if (Math.abs(num) < 10000) {
                return Math.round(num * 10) / 10;
            }
            const options = {
                notation: 'compact',
                signDisplay: 'auto',
                maximumFractionDigits: 1,
            };
            return Intl.NumberFormat('en', options).format(num);
        };
        const commaFormatter = (num) => {
            if (num) return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return num;
        };

        const state = reactive({
            loading: true,
            chart: null,
            chartRef: null as HTMLElement | null,
            skeletons: range(4),
            providers: computed(() => store.state.resource.provider.items),
            //
            selectedIndex: 0,
            selectedLabel: computed(() => CLOUD_SERVICE_LABEL[state.activeTab]),
            selectedDateType: DATE_TYPE.daily,
            dateTypes: computed(() => ([
                { name: DATE_TYPE.daily, label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.DAY') },
                { name: DATE_TYPE.monthly, label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.MONTH') },
            ])),
            //
            count: {
                compute: 0,
                container: 0,
                database: 0,
                networking: 0,
                storage: 0,
                security: 0,
                analytics: 0,
                all: 0,
            },
            storageSuffix: 'TB' as Unit,
            storageTrendSuffix: 'TB' as Unit,
            tabs: Object.values(DATA_TYPE),
            activeTab: DATA_TYPE.compute,
            dataMap: computed(() => ({
                [DATA_TYPE.compute]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.COMPUTE') },
                [DATA_TYPE.container]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.CONTAINER') },
                [DATA_TYPE.database]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.DATABASE') },
                [DATA_TYPE.networking]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.NETWORKING') },
                [DATA_TYPE.storage]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.STORAGE') },
                [DATA_TYPE.security]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.SECURITY') },
                [DATA_TYPE.analytics]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.ANALYTICS') },
                [DATA_TYPE.all]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.CLOUD_SERVICE') },
            })),
            summaryData: [] as SummaryData[],
        });
        const chartState = reactive({
            loading: true,
            registry: {},
            data: [] as ChartData[],
        });
        const colorState = reactive({
            aws: computed(() => state.providers.aws.color),
            google: computed(() => state.providers.google_cloud.color),
            azure: computed(() => state.providers.azure.color),
        });

        /* util */
        const disposeChart = () => {
            if (chartState.registry[state.chartRef]) {
                chartState.registry[state.chartRef].dispose();
                delete chartState.registry[state.chartRef];
            }
        };
        const drawChart = () => {
            const createChart = () => {
                disposeChart();
                chartState.registry[state.chartRef] = am4core.create(state.chartRef, am4charts.XYChart);
                return chartState.registry[state.chartRef];
            };
            const chart = createChart();
            state.chart = chart;

            if (!config.get('AMCHARTS_LICENSE.ENABLED')) chart.logo.disabled = true;
            chart.paddingLeft = -5;
            chart.paddingBottom = 0;
            chart.paddingTop = 10;
            chart.data = chartState.data;

            const dateAxis = chart.xAxes.push(new am4charts.CategoryAxis());
            dateAxis.dataFields.category = 'date';
            dateAxis.renderer.minGridDistance = 40;
            dateAxis.renderer.grid.template.disabled = true;
            dateAxis.renderer.labels.template.fill = am4core.color(gray[600]);
            dateAxis.tooltip.disabled = true;
            dateAxis.fontSize = 11;

            const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
            valueAxis.renderer.minGridDistance = 30;
            valueAxis.renderer.grid.template.strokeOpacity = 1;
            valueAxis.renderer.grid.template.stroke = am4core.color(gray[200]);
            valueAxis.renderer.labels.template.fill = am4core.color(primary1);
            valueAxis.tooltip.disabled = true;
            valueAxis.fontSize = 11;
            valueAxis.extraMax = 0.25;
            valueAxis.min = 0;

            const series = chart.series.push(new am4charts.ColumnSeries());
            series.dataFields.valueY = 'count';
            series.dataFields.categoryX = 'date';
            series.fill = am4core.color(primary2);
            series.columns.template.width = am4core.percent(15);
            series.strokeWidth = 0;
            series.tooltipText = '{count}';
            series.tooltip.pointerOrientation = 'down';
            series.tooltip.fontSize = 14;
            series.tooltip.strokeWidth = 0;
            series.tooltip.dy = -5;
            series.tooltip.getFillFromObject = false;
            series.tooltip.label.fill = am4core.color(primary1);
            series.tooltip.background.stroke = am4core.color(primary1);

            const bullet = series.bullets.push(new am4charts.LabelBullet());
            bullet.label.text = '{bulletText}';
            bullet.label.fontSize = 14;
            bullet.label.truncate = false;
            bullet.label.hideOversized = false;
            bullet.label.fill = am4core.color(primary2);
            bullet.label.dy = -10;

            chart.cursor = new am4charts.XYCursor();
            chart.cursor.lineX.strokeOpacity = 0;
            chart.cursor.lineY.strokeOpacity = 0;
            chart.cursor.behavior = 'none';
        };
        const getLocation = (type) => {
            const query: Location['query'] = {
                provider: 'all',
                service: CLOUD_SERVICE_LABEL[type],
            };
            if (type === DATA_TYPE.storage) query.primary = 'false';

            // set filters
            queryHelper.setFilters([{ k: 'project_id', o: '=', v: props.projectId }]);

            const location: Location = {
                name: INVENTORY_ROUTE.CLOUD_SERVICE.TYPE._NAME,
                query: {
                    filters: queryHelper.rawQueryStrings,
                    ...query,
                },
            };
            return location;
        };

        /* api */
        const getCount = async (type) => {
            try {
                const res = await SpaceConnector.client.statistics.topic.cloudServiceSummary({
                    project_id: props.projectId,
                    labels: [CLOUD_SERVICE_LABEL[type]],
                });
                const count = res.results[0]?.total || 0;
                if (type === DATA_TYPE.storage) {
                    state.storageSuffix = byteFormatter(count).split(' ')[1];
                }
                state.count[type] = count;
            } catch (e) {
                console.error(e);
            }
        };
        const getTrend = async (type) => {
            const utcToday = dayjs().utc();
            const dateRange = state.selectedDateType === DATE_TYPE.monthly ? MONTH_COUNT : DAY_COUNT;
            const dateUnit = state.selectedDateType === DATE_TYPE.monthly ? 'month' : 'day';
            const dateFormat = state.selectedDateType === DATE_TYPE.monthly ? 'MMM' : 'MM/DD';

            try {
                const param: any = {
                    granularity: state.selectedDateType,
                    project_id: props.projectId,
                };
                if (type !== DATA_TYPE.all) param.label = CLOUD_SERVICE_LABEL[type];
                const res = await SpaceConnector.client.statistics.topic.dailyCloudServiceSummary(param);
                const data = res.results;

                if (type === DATA_TYPE.storage) {
                    const smallestCount = Math.min(...data.map(d => d.total));
                    const formattedSize = byteFormatter(smallestCount);
                    if (formattedSize) state.storageTrendSuffix = formattedSize.split(' ')[1] as Unit;
                }
                const chartData = data.map((d) => {
                    let count = d.total;
                    if (type === DATA_TYPE.storage) {
                        const formattedSize = byteFormatter(d.total, { unit: state.storageTrendSuffix });
                        if (formattedSize) count = formattedSize.split(' ')[0];
                    }
                    return {
                        date: dayjs(d.date),
                        count,
                    };
                });
                forEach(range(0, dateRange), (i) => {
                    const date = utcToday.subtract(i, dateUnit);
                    if (!(chartData.find(d => d.date.isSame(date, 'day')))) {
                        chartData.push({ date, count: null });
                    }
                });

                const orderedData = orderBy(chartData, ['date'], ['asc']);
                chartState.data = orderedData.map((d, idx) => {
                    let bulletText = '';
                    if (idx % 3 === 1) bulletText = d.count;
                    if (state.selectedDateType === DATE_TYPE.monthly && (d.date.format('M') === '1' || d.date.format('M') === '12')) {
                        return {
                            date: d.date.format('MMM, YY'),
                            count: d.count,
                            bulletText,
                        };
                    }
                    return {
                        date: d.date.format(dateFormat),
                        count: d.count,
                        bulletText,
                    };
                });
            } catch (e) {
                console.error(e);
            }
        };
        const getApiParameter = (type) => {
            let param;
            const defaultParam: any = {
                query: {
                    sort: {
                        key: 'count',
                        desc: true,
                    },
                },
            };
            if (type !== DATA_TYPE.all) defaultParam.labels = [CLOUD_SERVICE_LABEL[type]];
            defaultParam.query.filter = {
                key: 'project_id',
                operator: 'eq',
                value: props.projectId,
            };

            if (type === DATA_TYPE.compute) {
                param = {
                    ...defaultParam,
                    resource_type: 'inventory.Server',
                    is_primary: true,
                };
            } else if (type === DATA_TYPE.storage) {
                param = {
                    ...defaultParam,
                    is_major: true,
                };
                param.query.sort = { key: 'size', desc: true };
                param.fields = [
                    {
                        name: 'size',
                        operator: 'sum',
                        key: 'data.size',
                    },
                ];
            } else {
                param = {
                    ...defaultParam,
                    is_primary: true,
                };
            }
            return param;
        };
        const getSummaryInfo = async (type) => {
            try {
                state.loading = true;
                const param = getApiParameter(type);
                const res = await SpaceConnector.client.statistics.topic.cloudServiceResources(param);
                const summaryData: SummaryData[] = [];

                const summaryQueryHelper = new QueryHelper();
                res.results.forEach((d) => {
                    const filters: QueryStoreFilter[] = [];
                    filters.push({
                        k: 'project_id', o: '=', v: props.projectId,
                    });

                    if (d.resource_type === 'inventory.Server') {
                        filters.push(
                            { k: 'provider', o: '=', v: d.provider },
                            { k: 'cloud_service_type', o: '=', v: d.cloud_service_type },
                        );
                    }

                    summaryData.push({
                        provider: d.provider,
                        label: state.providers[d.provider].label,
                        type: d.display_name || d.cloud_service_group,
                        count: type === DATA_TYPE.storage ? byteFormatter(d.size) : commaFormatter(d.count),
                        to: {
                            name: INVENTORY_ROUTE.CLOUD_SERVICE.DETAIL._NAME,
                            params: {
                                provider: d.provider,
                                group: d.cloud_service_group,
                                name: d.cloud_service_type,
                            },
                            query: {
                                filters: summaryQueryHelper.setFilters(filters).rawQueryStrings,
                            },
                        },
                    });
                });
                state.summaryData = summaryData;
            } catch (e) {
                console.error(e);
            } finally {
                state.loading = false;
            }
        };

        /* event */
        const onClickBox = (idx) => {
            if (idx !== state.selectedIndex) disposeChart();
            state.selectedIndex = idx;
        };
        const onClickDateTypeButton = (type) => {
            state.selectedDateType = type;
        };

        const init = async () => {
            await Promise.all([Object.keys(DATA_TYPE).forEach(d => getCount(d))]);
        };
        const chartInit = async () => {
            await getTrend(DATA_TYPE.compute);
            setTimeout(() => {
                chartState.loading = false;
            }, 300);
        };
        init();
        chartInit();

        watch(() => state.providers, (providers) => {
            if (providers) getSummaryInfo(DATA_TYPE.compute);
        }, { immediate: false });
        watch([() => chartState.loading, () => state.chartRef], async ([loading, chartContext]) => {
            if (!loading && chartContext) {
                drawChart();
            }
        }, { immediate: false });
        watch(() => state.activeTab, async (type) => {
            await Promise.all([getSummaryInfo(type), getTrend(type)]);
            drawChart();
        }, { immediate: false });
        watch(() => state.selectedDateType, async () => {
            await getTrend(state.activeTab);
            drawChart();
        }, { immediate: false });

        onUnmounted(() => {
            if (state.chart) state.chart.dispose();
        });

        return {
            ...toRefs(state),
            chartState,
            colorState,
            onClickBox,
            onClickDateTypeButton,
            byteFormatter,
            commaFormatter,
            numberFormatter,
            getLocation,
        };
    },
};
</script>

<style lang="postcss" scoped>
.title {
    font-size: 1.5rem;
    line-height: 1.6;
    margin-bottom: 0.5rem;
}
.sub-title {
    font-size: 0.875rem;
    line-height: 1.5;
    font-weight: bold;
    margin-bottom: 1rem;
    .suffix {
        font-size: 0.75rem;
        font-weight: normal;
        padding-left: 0.5rem;
    }
}
.box {
    .suffix {
        @apply text-gray-500;
        font-size: 0.75rem;
        padding-left: 0.125rem;
    }
    .count {
        @apply text-primary1;
        font-weight: bold;
    }

    &.selected {
        .suffix, .count {
            @apply text-white;
        }
    }
}
.p-balloon-tab::v-deep {
    .tab-pane {
        padding-bottom: 0;
    }
}
.bottom-part {
    margin-top: 0.625rem;

    .content-wrapper {
        @apply bg-white border border-gray-200 rounded-md;
        position: relative;
        height: auto;
        padding: 1rem;

        @screen lg {
            height: 17.5rem;
        }

        .chart-wrapper {
            position: relative;
            .toggle-button-group {
                position: absolute;
                right: 0.5rem;
                top: 0;
                .p-button {
                    @apply border border-gray-200 text-gray-300;
                    height: 1.25rem;
                    min-width: 2rem;
                    line-height: 1.25rem;
                    font-size: 0.75rem;
                    font-weight: normal;
                    border-radius: 0.125rem;
                    padding: 0.25rem;
                    margin-left: 0.25rem;
                    &.selected {
                        @apply bg-gray-600 border-gray-600 text-white;
                    }
                }
            }
            .chart {
                height: 13rem;
            }
        }
        .summary-wrapper {
            .sub-title {
                padding-left: 0.5rem;
            }
            .summary-content-wrapper {
                height: 5rem;
                overflow-y: auto;
                overflow-x: hidden;

                @screen lg {
                    height: 13rem;
                }

                &.no-data-wrapper {
                    .empty-image {
                        margin: 0 auto 0.5rem auto;
                    }

                    .text {
                        @apply text-primary2;
                        font-size: 0.875rem;
                        font-weight: bold;
                        line-height: 1.5;
                        text-align: center;
                        opacity: 0.7;
                        margin-bottom: 0.625rem;
                    }
                }
            }
            .summary-row {
                position: relative;
                display: block;
                font-size: 0.875rem;
                line-height: 1.2;
                cursor: pointer;
                padding: 0.25rem 0.5rem;
                margin: auto 0;

                &:hover {
                    @apply bg-secondary2;
                    .provider {
                        text-decoration: underline;
                    }
                    .type {
                        text-decoration: underline;
                    }
                    .count {
                        text-decoration: underline;
                    }
                }

                .text-group {
                    display: inline-block;
                    width: 80%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;

                    .type {
                        padding-left: 0.5rem;
                    }
                }

                .count {
                    @apply text-gray-600;
                    position: absolute;
                    right: 0.5rem;
                }
            }
        }
        .region-service-wrapper {
            .sub-title {
                padding-left: 0.5rem;
            }
        }
    }
}
</style>
