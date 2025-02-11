<template>
    <div class="all-summary">
        <p-balloon-tab v-model="activeTab" :tabs="tabs"
                       tail stretch @change="onChangeTab"
        >
            <template #tab="{name}">
                <div class="content" :class="{selected: name === activeTab}">
                    <div class="count">
                        <router-link :to="name !== 'billing' ? getLocation(name) : ''" class="anchor">
                            <span class="number">
                                <span v-if="name === 'billing'" class="dollar-sign">$</span>
                                <span>{{ count[name] }}</span>
                            </span>
                        </router-link>
                        <span v-if="name === 'storage'" class="suffix">{{ storageBoxSuffix }}</span>
                    </div>
                    <div class="title">
                        {{ dataMap[name].label }}
                    </div>
                </div>
            </template>
            <div class="bottom-part">
                <div class="content-wrapper grid grid-cols-12 gap-2">
                    <div class="chart-wrapper col-span-12 lg:col-span-9">
                        <div class="title">
                            <span>{{ $t('COMMON.WIDGETS.ALL_SUMMARY.TREND_TITLE') }}</span>
                            <span v-if="activeTab === 'storage'" class="suffix">({{ storageTrendSuffix }})</span>
                            <span v-if="activeTab === 'billing'" class="suffix">(USD)</span>
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
                    <div class="summary-wrapper col-span-12 lg:col-span-3">
                        <div class="title col-span-3">
                            {{ $t('COMMON.WIDGETS.ALL_SUMMARY.TYPE_TITLE', { service: dataMap[activeTab].summaryTitle || dataMap[activeTab].label }) }}
                        </div>
                        <template v-if="!loading && summaryData.length > 0">
                            <div class="summary-content-wrapper block md:grid md:grid-cols-3 lg:block">
                                <router-link :to="activeTab !== 'billing' ? getLocation(activeTab) : ''"
                                             class="summary-row col-span-3 md:col-span-1 lg:col-span-3"
                                             :class="{'link-text': activeTab !== 'billing'}"
                                >
                                    <div class="text-group">
                                        <span>{{ $t('COMMON.WIDGETS.ALL_SUMMARY.ALL') }}</span>
                                    </div>
                                    <span class="count">{{ count[activeTab] }} {{ activeTab === 'storage' ? storageBoxSuffix : '' }}</span>
                                </router-link>
                                <router-link v-for="(data, idx) of summaryData" :key="idx"
                                             :to="data.to"
                                             class="summary-row col-span-3 md:col-span-1 lg:col-span-3"
                                             :class="{'link-text': !!data.to.name}"
                                >
                                    <div class="text-group">
                                        <span class="provider" :style="{ color: providers[data.provider] ? providers[data.provider].color : ''}">
                                            {{ providers[data.provider] ? providers[data.provider].label : providers[data.provider] }}
                                        </span>
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
                </div>
            </div>
        </p-balloon-tab>
    </div>
</template>

<script lang="ts">
import {
    reactive, toRefs, watch, computed,
    onUnmounted, ComponentRenderProxy, getCurrentInstance,
} from '@vue/composition-api';
import {
    forEach, orderBy, range,
} from 'lodash';
import bytes from 'bytes';
import dayjs from 'dayjs';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themesAnimated from '@amcharts/amcharts4/themes/animated';
import { Location } from 'vue-router';

import {
    PChartLoader, PSkeleton, PButton, PBalloonTab,
} from '@spaceone/design-system';

import { SpaceConnector } from '@spaceone/console-core-lib/space-connector';
import { QueryHelper } from '@spaceone/console-core-lib/query';
import { commaFormatter } from '@spaceone/console-core-lib';
import { QueryStoreFilter } from '@spaceone/console-core-lib/query/type';
import { gray, primary, primary1 } from '@/styles/colors';
import { store } from '@/store';
import { INVENTORY_ROUTE } from '@/services/inventory/routes';
import config from '@/lib/config';

am4core.useTheme(am4themesAnimated);

/* enum */
enum DATE_TYPE {
    daily = 'DAILY',
    monthly = 'MONTHLY',
}
enum DATA_TYPE {
    compute = 'compute',
    database = 'database',
    storage = 'storage',
    billing = 'billing',
}
enum CLOUD_SERVICE_LABEL {
    compute = 'Compute',
    database = 'Database',
    storage = 'Storage',
    billing = 'Billing'
}

/* type */
type Unit = 'b' | 'gb' | 'kb' | 'mb' | 'pb' | 'tb' | 'B' | 'GB' | 'KB' | 'MB' | 'PB' | 'TB';
interface ChartData {
    date: string;
    count: number | null;
    fillOpacity?: number;
    bulletColor?: string;
    bulletText?: string | number;
    tooltipText?: string | number;
}

interface SummaryData {
    type: string;
    provider: string;
    count: number | string;
    to: string | Location;
}

const DAY_COUNT = 14;
const MONTH_COUNT = 12;
const BOX_SWITCH_INTERVAL = 10000;

export default {
    name: 'AllSummary',
    components: {
        PButton,
        PSkeleton,
        PChartLoader,
        PBalloonTab,
    },
    props: {
        extraParams: {
            type: Object,
            default: () => ({}),
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

        const state = reactive({
            loading: false,
            chart: null as any,
            chartRef: null as HTMLElement | null,
            skeletons: range(4),
            providers: computed(() => store.state.resource.provider.items),
            //
            selectedDateType: DATE_TYPE.daily,
            dateTypes: computed(() => ([
                { name: DATE_TYPE.daily, label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.DAY') },
                { name: DATE_TYPE.monthly, label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.MONTH') },
            ])),
            //
            count: {
                compute: 0,
                database: 0,
                storage: 0,
                billing: 0,
            },
            storageBoxSuffix: 'TB' as Unit,
            storageTrendSuffix: 'TB' as Unit,
            tabs: computed(() => Object.values(DATA_TYPE)),
            activeTab: DATA_TYPE.compute,
            dataMap: computed(() => ({
                [DATA_TYPE.compute]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.COMPUTE') },
                [DATA_TYPE.database]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.DATABASE') },
                [DATA_TYPE.storage]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.STORAGE') },
                [DATA_TYPE.billing]: { label: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.OVERALL_SPENDINGS'), summaryTitle: vm.$t('COMMON.WIDGETS.ALL_SUMMARY.RESOURCE') },
            })),
            summaryData: [] as SummaryData[],
        });
        const chartState = reactive({
            loading: true,
            registry: {},
            data: [] as ChartData[],
        });

        /* util */
        const disposeChart = () => {
            // @ts-ignore
            if (chartState.registry[state.chartRef]) {
                // @ts-ignore
                chartState.registry[state.chartRef].dispose();
                // @ts-ignore
                delete chartState.registry[state.chartRef];
            }
        };
        const drawChart = () => {
            const createChart = () => {
                disposeChart();
                // @ts-ignore
                chartState.registry[state.chartRef] = am4core.create(state.chartRef, am4charts.XYChart);
                // @ts-ignore
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
            dateAxis.renderer.labels.template.fill = am4core.color(gray[400]);
            dateAxis.tooltip.disabled = true;
            dateAxis.fontSize = 11;

            const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
            valueAxis.renderer.minGridDistance = 30;
            valueAxis.renderer.grid.template.strokeOpacity = 1;
            valueAxis.renderer.grid.template.stroke = am4core.color(gray[200]);
            valueAxis.renderer.labels.template.fill = am4core.color(gray[400]);
            valueAxis.tooltip.disabled = true;
            valueAxis.fontSize = 11;
            valueAxis.extraMax = 0.15;
            if (state.activeTab === DATA_TYPE.billing) {
                valueAxis.renderer.labels.template.adapter.add('text', (text, target) => numberFormatter(target.dataItem.value));
            } else {
                valueAxis.min = 0;
            }

            const series = chart.series.push(new am4charts.ColumnSeries());
            series.dataFields.valueY = 'count';
            series.dataFields.categoryX = 'date';
            series.fill = am4core.color(primary1);
            series.columns.template.width = am4core.percent(30);
            series.columns.template.column.cornerRadiusTopLeft = 3;
            series.columns.template.column.cornerRadiusTopRight = 3;
            series.strokeWidth = 0;
            series.columns.template.propertyFields.fillOpacity = 'fillOpacity';

            series.tooltipText = '{tooltipText}';
            series.tooltip.pointerOrientation = 'down';
            series.tooltip.fontSize = 14;
            series.tooltip.strokeWidth = 0;
            series.tooltip.dy = -5;
            series.tooltip.getFillFromObject = false;
            series.tooltip.label.fill = am4core.color(primary);
            series.tooltip.background.stroke = am4core.color(primary);

            const bullet = series.bullets.push(new am4charts.LabelBullet());
            bullet.label.text = '{bulletText}';
            bullet.label.fontSize = 14;
            bullet.label.truncate = false;
            bullet.label.hideOversized = false;
            bullet.label.propertyFields.fill = 'bulletColor';
            bullet.label.dy = -10;
            if (state.activeTab === DATA_TYPE.billing) {
                bullet.label.adapter.add('dy', (dy, target) => {
                    if (target.dataItem.valueY < 0) return 10;
                    return dy;
                });
            }

            chart.cursor = new am4charts.XYCursor();
            chart.cursor.lineX.strokeOpacity = 0;
            chart.cursor.lineY.strokeOpacity = 0;
            chart.cursor.behavior = 'none';
        };

        let tabInterval;
        const setTabInterval = () => {
            tabInterval = setInterval(() => {
                disposeChart();
                let activeTabIndex = state.tabs.indexOf(state.activeTab);
                if (activeTabIndex < 3) {
                    activeTabIndex += 1;
                } else {
                    activeTabIndex = 0;
                }
                state.activeTab = state.tabs[activeTabIndex];
            }, BOX_SWITCH_INTERVAL);
        };
        const getLocation = (type) => {
            const query: Location['query'] = {
                provider: 'all',
                service: CLOUD_SERVICE_LABEL[type],
            };
            if (type === DATA_TYPE.storage) query.primary = 'false';

            const location: Location = {
                name: INVENTORY_ROUTE.CLOUD_SERVICE.TYPE._NAME,
                query: {
                    filters: queryHelper.rawQueryStrings,
                    ...query,
                },
            };
            return location;
        };
        const setChartData = (data) => {
            const chartData: ChartData[] = [];
            const dateType = state.selectedDateType;
            const dateRange = dateType === DATE_TYPE.monthly ? MONTH_COUNT : DAY_COUNT;
            const dateUnit = dateType === DATE_TYPE.monthly ? 'month' : 'day';
            const dateFormat = dateType === DATE_TYPE.monthly ? 'YYYY-MM' : 'YYYY-MM-DD';

            if (state.activeTab === DATA_TYPE.storage) {
                const smallestCount = Math.min(...data.map(d => d.total));
                const formattedSize = byteFormatter(smallestCount);
                if (formattedSize) state.storageTrendSuffix = formattedSize.split(' ')[1] as Unit;
            }
            const formattedData = data.map((d) => {
                let count = d.total;
                if (state.activeTab === DATA_TYPE.storage) {
                    const formattedSize = byteFormatter(d.total, { unit: state.storageTrendSuffix });
                    if (formattedSize) count = formattedSize.split(' ')[0];
                }
                return {
                    date: d.date,
                    count,
                };
            });

            // fill default value
            forEach(range(0, dateRange), (i) => {
                let date = dayjs.utc().subtract(i, dateUnit);
                if (state.activeTab === DATA_TYPE.billing && state.selectedDateType === DATE_TYPE.daily) {
                    date = date.subtract(1, 'day');
                }
                if (formattedData.find(d => date.format(dateFormat) === d.date)) {
                    chartData.push(formattedData.find(d => date.format(dateFormat) === d.date));
                } else {
                    chartData.push({ date: date.format(dateFormat), count: null });
                }
            });

            const orderedData = orderBy(chartData, ['date'], ['asc']);
            chartState.data = orderedData.map((d, idx) => {
                const tooltipText = state.activeTab === DATA_TYPE.billing ? numberFormatter(d.count) : d.count || '';
                let bulletText;
                if ((dateType === DATE_TYPE.daily && idx % 3 === 1) || (dateType === DATE_TYPE.monthly && idx % 3 === 2)) {
                    bulletText = tooltipText;
                }

                let fillOpacity = 1;
                let bulletColor = primary;
                if (state.activeTab === DATA_TYPE.billing && idx === orderedData.length - 1) {
                    fillOpacity = 0.5;
                    bulletColor = primary1;
                }

                const date = dayjs(d.date);
                let dateLabel;
                if (dateType === DATE_TYPE.monthly && (date.format('M') === '1' || date.format('M') === '12')) {
                    dateLabel = date.format('MMM, YY');
                } else {
                    const labelFormat = dateType === DATE_TYPE.monthly ? 'MMM' : 'MM/DD';
                    dateLabel = date.format(labelFormat);
                }

                return {
                    date: dateLabel,
                    count: d.count,
                    fillOpacity,
                    bulletColor,
                    bulletText,
                    tooltipText,
                };
            });
        };

        /* api */
        const getBillingCount = async () => {
            try {
                const res = await SpaceConnector.client.statistics.topic.billingSummary({
                    ...props.extraParams,
                    granularity: DATE_TYPE.monthly,
                    start: dayjs.utc().startOf('month').format('YYYY-MM-DD'),
                    end: dayjs.utc().endOf('month').format('YYYY-MM-DD'),
                });
                if (res.results.length > 0) {
                    const count = res.results[0].billing_data[0].cost;
                    state.count.billing = commaFormatter(numberFormatter(count));
                }
            } catch (e) {
                console.error(e);
            }
        };
        const getCount = async (type) => {
            try {
                const res = await SpaceConnector.client.statistics.topic.cloudServiceSummary({
                    ...props.extraParams,
                    labels: [CLOUD_SERVICE_LABEL[type]],
                });
                let count = 0 as number | string;
                res.results.forEach((d) => {
                    if (type === DATA_TYPE.storage) {
                        state.storageBoxSuffix = byteFormatter(d.total).split(' ')[1] as Unit;
                        count = parseFloat(byteFormatter(d.total).split(' ')[0]);
                        count = commaFormatter(count);
                    } else {
                        count = numberFormatter(d.total);
                    }
                    state.count[type] = count;
                });
            } catch (e) {
                console.error(e);
            }
        };
        const getTrend = async (type) => {
            try {
                let data;
                if (type === DATA_TYPE.billing) {
                    let start;
                    let end;
                    if (state.selectedDateType === DATE_TYPE.monthly) {
                        start = dayjs.utc().subtract(MONTH_COUNT - 1, 'month').format('YYYY-MM');
                        end = dayjs.utc().format('YYYY-MM');
                    } else {
                        start = dayjs.utc().subtract(DAY_COUNT, 'day').format('YYYY-MM-DD');
                        end = dayjs.utc().subtract(1, 'day').format('YYYY-MM-DD');
                    }
                    const res = await SpaceConnector.client.statistics.topic.billingSummary({
                        ...props.extraParams,
                        granularity: state.selectedDateType,
                        start,
                        end,
                    });
                    if (res.results.length > 0) {
                        data = res.results[0].billing_data.map(d => ({
                            date: d.date,
                            total: d.cost,
                        }));
                    } else {
                        data = [];
                    }
                } else {
                    const res = await SpaceConnector.client.statistics.topic.dailyCloudServiceSummary({
                        ...props.extraParams,
                        label: CLOUD_SERVICE_LABEL[type],
                        granularity: state.selectedDateType,
                    });
                    data = res.results;
                }
                setChartData(data);
            } catch (e) {
                console.error(e);
            }
        };
        const getApiParameter = (type) => {
            let param;
            const defaultParam: any = {
                ...props.extraParams,
                labels: [CLOUD_SERVICE_LABEL[type]],
                is_major: true,
                query: {
                    sort: {
                        key: 'count',
                        desc: true,
                    },
                },
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
                    let detailLocation: Location;

                    if (d.resource_type === 'inventory.Server') {
                        const filters: QueryStoreFilter[] = [];
                        filters.push({ k: 'provider', o: '=', v: d.provider },
                            { k: 'cloud_service_type', o: '=', v: d.cloud_service_type });
                        detailLocation = {
                            name: INVENTORY_ROUTE.SERVER._NAME,
                            query: {
                                filters: summaryQueryHelper.setFilters(filters).rawQueryStrings,
                            },
                        };
                    } else {
                        detailLocation = {
                            name: INVENTORY_ROUTE.CLOUD_SERVICE.DETAIL._NAME,
                            params: {
                                provider: d.provider,
                                group: d.cloud_service_group,
                                name: d.cloud_service_type,
                            },
                        };
                    }
                    summaryData.push({
                        provider: d.provider,
                        type: d.display_name || d.cloud_service_group,
                        count: type === DATA_TYPE.storage ? byteFormatter(d.size) : commaFormatter(d.count),
                        to: detailLocation,
                    });
                });
                state.summaryData = summaryData;
            } catch (e) {
                console.error(e);
            } finally {
                state.loading = false;
            }
        };
        const getBillingSummaryInfo = async () => {
            try {
                state.loading = true;
                const res = await SpaceConnector.client.statistics.topic.billingSummary({
                    ...props.extraParams,
                    granularity: DATE_TYPE.monthly,
                    aggregation: 'inventory.CloudServiceType',
                    start: dayjs.utc().startOf('month').format('YYYY-MM-DD'),
                    end: dayjs.utc().endOf('month').format('YYYY-MM-DD'),
                });
                const summaryData: SummaryData[] = [];
                res.results.forEach((d) => {
                    if (numberFormatter(d.billing_data[0].cost) !== 0) {
                        let detailLocation: Location = {};
                        if (d.provider && d.cloud_service_group && d.cloud_service_type) {
                            detailLocation = {
                                name: INVENTORY_ROUTE.CLOUD_SERVICE.DETAIL._NAME,
                                params: {
                                    provider: d.provider,
                                    group: d.cloud_service_group,
                                    name: d.cloud_service_type,
                                },
                            };
                        }

                        summaryData.push({
                            provider: d.provider,
                            type: d.cloud_service_group || d.service_code,
                            count: numberFormatter(d.billing_data[0].cost),
                            to: detailLocation,
                        });
                    }
                });
                state.summaryData = summaryData;
            } catch (e) {
                console.error(e);
            } finally {
                state.loading = false;
            }
        };

        /* event */
        const onChangeTab = (name) => {
            if (state.activeTab !== name) disposeChart();
            state.activeTab = name;
            if (tabInterval) clearInterval(tabInterval);
        };
        const onClickDateTypeButton = (type) => {
            state.selectedDateType = type;
            if (tabInterval) clearInterval(tabInterval);
        };

        const init = async () => {
            await Promise.all([
                getSummaryInfo(DATA_TYPE.compute),
                Object.keys(DATA_TYPE).forEach(d => getCount(d)),
                getBillingCount(),
            ]);
            setTabInterval();
        };
        const chartInit = async () => {
            await getTrend(DATA_TYPE.compute);
            setTimeout(() => {
                chartState.loading = false;
            }, 300);
        };
        init();
        chartInit();

        watch([() => chartState.loading, () => state.chartRef], async ([loading, chartContext]) => {
            if (!loading && chartContext) {
                drawChart();
            }
        }, { immediate: false });
        watch(() => state.activeTab, async (type) => {
            if (type === DATA_TYPE.billing) {
                await Promise.all([getBillingSummaryInfo(), getTrend(type)]);
                drawChart();
            } else {
                await Promise.all([getSummaryInfo(type), getTrend(type)]);
                drawChart();
            }
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
            onChangeTab,
            onClickDateTypeButton,
            commaFormatter,
            numberFormatter,
            getLocation,
        };
    },
};
</script>

<style lang="postcss" scoped>
.p-balloon-tab::v-deep {
    .balloon-group {
        flex-wrap: wrap;
        button {
            width: 40%;
            &:not(.active) {
                @apply border-transparent;
            }
        }
    }

    @screen sm {
        .balloon-group {
            flex-wrap: nowrap;
            justify-content: space-evenly;
            button {
                width: 100%;
            }
        }
    }
}
.content {
    text-align: left;
    padding: 0.5rem 0;
    .count {
        @apply text-indigo-400;
        display: inline-block;
        line-height: 2.5rem;
        &:hover {
            .anchor {
                border-bottom: 2px solid;
                &.billing {
                    border: none;
                }
            }
        }
        .dollar-sign {
            @apply text-gray-500;
            font-size: 1.5rem;
            font-weight: normal;
            padding-right: 0.25rem;
        }
        .number {
            font-size: 2rem;
            font-weight: bold;
        }
        .suffix {
            @apply text-gray-500;
            font-size: 0.875rem;
            font-weight: normal;
            padding-left: 0.5rem;
        }
    }
    .title {
        @apply text-gray-900;
        font-size: 1rem;
        text-transform: capitalize;
    }
    &.selected {
        .count {
            @apply text-white;

            .dollar-sign {
                @apply text-white;
            }

            .suffix {
                @apply text-white;
                opacity: 1;
            }
        }

        .title {
            @apply text-white;
            font-weight: bold;
        }
    }
}

.bottom-part {
    margin-top: 1rem;

    .content-wrapper {
        @apply bg-white;
        position: relative;
        height: 27.5rem;
        border-radius: 0.375rem;
        padding: 1.25rem 1.5rem;

        @screen md {
            height: 25rem;
        }

        @screen lg {
            height: 17.5rem;
        }

        .title {
            font-size: 1rem;
            font-weight: bold;
            margin-bottom: 1rem;
            .suffix {
                font-size: 0.75rem;
                font-weight: normal;
                padding-left: 0.5rem;
            }
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
            .title {
                padding: 0 0.5rem;
                margin-bottom: 1.25rem;
            }

            .summary-content-wrapper {
                height: 5rem;
                overflow-y: auto;
                overflow-x: hidden;

                @screen lg {
                    height: 12rem;
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

                    .p-button {
                        min-width: auto;
                        height: 1.25rem;
                        font-size: 0.75rem;
                        line-height: 1.2;
                        padding: 0.5rem;
                    }
                }
            }

            .summary-row {
                position: relative;
                display: block;
                font-size: 0.875rem;
                line-height: 1.2;
                cursor: default;
                padding: 0.25rem 0.5rem;
                margin: auto 0;

                &.link-text:hover {
                    @apply bg-secondary2;
                    cursor: pointer;
                    .text-group, .provider, .type, .count {
                        text-decoration: underline;
                    }
                }

                .text-group {
                    display: inline-block;
                    width: 80%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    vertical-align: text-top;

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
    }
}
</style>
