<template>
    <div />
</template>

<script lang="ts">
import {
    reactive, toRefs,
} from '@vue/composition-api';

export default {
    name: 'BudgetFormBaseInfo',
    props: {
        budgetId: {
            type: String,
            default: undefined,
        },
    },
    setup() {
        const state = reactive({});

        return {
            ...toRefs(state),
        };
    },
};
</script>

<style lang="postcss" scoped>

</style>
