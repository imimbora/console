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
                <li><button class="btn active">KB국민은행</button></li>
                <li><button class="btn">KB증권</button></li>
                <li><button class="btn">KB손해보험</button></li>
                <li><button class="btn">KB국민카드</button></li>
                <li><button class="btn">푸르덴셜생명</button></li>
                <li><button class="btn">KB자산운용</button></li>
                <li><button class="btn">KB캐피탈</button></li>
                <li><button class="btn">KB생명보험</button></li>
                <li><button class="btn">KB부동산신탁</button></li>
                <li><button class="btn">KB저축은행</button></li>
                <li><button class="btn">KB인베스트먼트</button></li>
                <li><button class="btn">KB데이타시스템</button></li>
                <li><button class="btn">KB신용정보</button></li>
            </ul>
        </div>

        <!-- If you want to reload when the state is changed, bind key with reactive state. -->
        <div :key="test.toString()">
            <!-- Give extra parameter objects for api requests in widgets. -->
            <all-summary :extra-params="extraParams" />
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


export default defineComponent({
    name: 'TotalDashboardPage',
    components: {
        GeneralPageLayout,
        AllSummary,
        PButton,
    },
    setup() {
        const vm = getCurrentInstance() as ComponentRenderProxy;

        const state = reactive({
            test: false,
            extraParams: computed(() => (state.test ? { test: true } : {})),
        });

        /** Init */
        (async () => {
            // Widgets does not load required resources.
            // Page components need to load resources first.
            await vm.$store.dispatch('resource/provider/load');
        })();

        return {
            ...toRefs(state),
        };
    },
});
</script>

<style lang="postcss" scoped>
.total-dashboard::v-deep {
    @apply bg-gray-100;
    height: auto;
}
.domain-tab {
    position: relative;
    margin-bottom: 35px;
}
.domain-tab > ul {
    display: flex;
    flex-wrap: wrap;
    margin: 0 -10px;
}
.domain-tab li {
    width: 208px;
    margin-top: 12px;
    padding: 0 10px;
}
.domain-tab .btn {
    overflow: hidden;
    display: block;
    width: 100%;
    height: 41px;
    padding: 0 20px;
    text-align: center;
    font-size: 15px;
    white-space: nowrap;
    text-overflow: ellipsis;
    background-color: #eee;
    border-radius: 4px;
}
.domain-tab .btn:hover {
    background-color: #e9e9e9;
}
.domain-tab .btn.active {
    font-weight: bold;
    color: #fff;
    background-color: #6638B6;
}
</style>
