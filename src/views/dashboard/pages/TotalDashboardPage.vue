<template>
    <!-- You can choose a layout in src/common/components/layouts.
         Give component's name to root element or component with dash case. -->
    <general-page-layout class="total-dashboard">
        <!-- You can use tailwindcss class names.
             See tailwind.config.js to use customized classes. -->
        <div class="flex flex-wrap justify-between items-center">
            <p class="text-xl font-bold mb-4">
                ROOT DOMAIN - TOTAL DASHBOARD
            </p>
            <!-- To use spaceone design system components, see storybook. -->
            <p-button class="mb-4" size="sm" style-type="secondary"
                      :outline="true"
                      @click="test = !test"
            >
                Click me to {{ test ? 'STOP insert' : 'INSERT' }} 'test' to api parameters
            </p-button>
        </div>

        <!-- KB Domain Tab -->
        <div class="domain-tab">
            <ul>
                <li v-for="(item, index) in data" :key="index">
                    <button :class="['btn', { 'active': item.domain_id === currentDomain.domainId }]"
                            @click="switchDomain(item)"
                    >
                        {{ item.name }}
                    </button>
                </li>
            </ul>
        </div>

        <!-- If you want to reload when the state is changed, bind key with reactive state. -->
        <div :key="test.toString()" class="contents-wrapper">
            <!-- Give extra parameter objects for api requests in widgets. -->
            <div class="col-span-12 lg:col-span-12
                        widget-wrapper"
            >
                <all-summary :extra-params="extraParams" class="col-span-12" />
                <resource-map :extra-params="extraParams" class="col-span-12" />
                <personal-health-dashboard :extra-params="extraParams" class="col-span-12" />
                <trusted-advisor :extra-params="extraParams" class="col-span-12" />
                <top-projects :extra-params="extraParams" class="col-span-12" />
            </div>
            <!-- <div class="col-span-12 lg:col-span-3
                    widget-wrapper"
            /> -->
        </div>
    </general-page-layout>
</template>

<script lang="ts">
import {
    ComponentRenderProxy, computed, defineComponent, getCurrentInstance, reactive, ref, toRefs,
} from '@vue/composition-api';

import { PButton } from '@spaceone/design-system';

import GeneralPageLayout from '@/common/components/layouts/GeneralPageLayout.vue';
import AllSummary from '@/views/dashboard/modules/AllSummary.vue';
import ResourceMap from '@/views/dashboard/modules/ResourceMap.vue';
import PersonalHealthDashboard from '@/views/dashboard/modules/PersonalHealthDashboard.vue';
import TrustedAdvisor from '@/views/dashboard/modules/TrustedAdvisor.vue';
import TopProjects from '@/views/dashboard/modules/TopProjects.vue';

import { SpaceConnector } from '@spaceone/console-core-lib/space-connector';

const DATA_LENGTH = 13;

export default defineComponent({
    name: 'TotalDashboardPage',
    components: {
        PButton,
        GeneralPageLayout,
        AllSummary,
        ResourceMap,
        PersonalHealthDashboard,
        TrustedAdvisor,
        TopProjects,
    },
    setup() {
        const vm = getCurrentInstance() as ComponentRenderProxy;

        const state = reactive({
            test: false,
            extraParams: computed(() => (state.test ? state.currentDomain : {})),
            data: [],
            currentDomain: computed(() => vm.$store.state.domain),
        });

        /** Init */
        (async () => {
            // Widgets does not load required resources.
            // Page components need to load resources first.
            await vm.$store.dispatch('resource/provider/load');
        })();

        const getDomainList = async (): Promise<void> => {
            try {
                const res = await SpaceConnector.client.identity.domain.list();
                state.data = [
                    ...res.results.splice(144, DATA_LENGTH),
                ];
            } catch (e) {
                console.error(e);
            }
        };
        getDomainList();

        const switchDomain = (domain) => {
            vm.$store.dispatch('domain/load', domain.name);
        };

        return {
            ...toRefs(state),
            switchDomain,
        };
    },
});
</script>

<style lang="postcss" scoped>
.total-dashboard::v-deep {
    @apply bg-gray-100;
    height: auto;
    .page-contents {
        @apply bg-gray-100;
        max-width: 1368px;
        padding: 1.5rem;
        margin: 0 auto;
    }
}

.contents-wrapper {
    display: grid;
    @apply grid-cols-12;
    grid-auto-flow: row;
    grid-gap: 1.25rem;
}

.widget-wrapper {
    @apply grid-cols-12;
    grid-auto-rows: max-content;
    display: inline-grid;
    grid-gap: 1.25rem;
}

.domain-tab {
    position: relative;
    margin-bottom: 3rem;
    ul {
        display: flex;
        flex-wrap: wrap;
        margin: 0 -10px;
        li {
            width: 20%;
            margin-top: 1rem;
            padding: 0 10px;
        }
    }
    .btn {
        overflow: hidden;
        display: block;
        width: 100%;
        height: 3rem;
        padding: 0 20px;
        text-align: center;
        white-space: nowrap;
        text-overflow: ellipsis;
        background-color: #eee;
        border-radius: 4px;
        &:hover {
            background-color: #e9e9e9;
        }
        &.active {
            font-weight: bold;
            color: #fff;
            @apply bg-primary;
        }
    }
}
</style>
