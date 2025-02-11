<template>
    <fragment>
        <p v-if="!isEditMode" class="content-wrapper">
            <span class="project">
                <p-copy-button :value="alertData.project_id">
                    <p-anchor :to="referenceRouter(
                                  alertData.project_id,
                                  { resource_type: 'identity.Project' })"
                              highlight
                    >
                        {{ projects[alertData.project_id] ? projects[alertData.project_id].label : alertData.project_id }}
                    </p-anchor>
                </p-copy-button>
            </span>
            <p-button style-type="gray-border" size="sm" class="add-button ml-2"
                      @click="startEdit(alertData.project_id)"
            >
                {{ $t('MONITORING.ALERT.DETAIL.INFO.CHANGE') }}
            </p-button>
        </p>
        <div v-else class="content-wrapper">
            <project-select-dropdown :selected-project-ids="dataForUpdate ? [dataForUpdate] : []"
                                     @select="onSelectProject"
                                     class="dropdown"
            />
            <div class="button-group ml-2">
                <p-button :outline="true" size="sm" class="cancel-button"
                          @click="cancelEdit(alertData.project_id)"
                >
                    {{ $t('COMMON.TAGS.CANCEL') }}
                </p-button>
                <p-button
                    style-type="primary"
                    size="sm"
                    @click="openModal"
                >
                    {{ $t('MONITORING.ALERT.DETAIL.INFO.SAVE_CHANGES') }}
                </p-button>
            </div>
        </div>
        <p-button-modal
            :header-title="$t('MONITORING.ALERT.DETAIL.INFO.CHANGE_PROJECT_MODAL_TITLE')"
            centered
            size="sm"
            fade
            :scrollable="false"
            backdrop
            theme-color="alert"
            :visible.sync="modalVisible"
            @confirm="onClickSave(EDIT_MODE.PROJECT)"
        >
            <template #body>
                <p class="modal-body">{{ $t('MONITORING.ALERT.DETAIL.INFO.CHANGE_PROJECT_MODAL_DESC') }}</p>
            </template>
        </p-button-modal>
    </fragment>
</template>

<script lang="ts">
import {
    PButton, PAnchor, PButtonModal, PCopyButton,
} from '@spaceone/design-system';
import { computed, reactive, toRefs } from '@vue/composition-api';
import { useAlertInfoItem } from '@/services/monitoring/alert-manager/alert/alert-detail/modules/alert-key-info/composables';
import { EDIT_MODE } from '@/services/monitoring/alert-manager/lib/config';
import { referenceRouter } from '@/lib/reference/referenceRouter';
import { store } from '@/store';
import ProjectSelectDropdown from '@/common/modules/project/ProjectSelectDropdown.vue';

export default {
    name: 'AlertInfoProject',
    components: {
        ProjectSelectDropdown,
        PAnchor,
        PButton,
        PButtonModal,
        PCopyButton,
    },
    props: {
        id: {
            type: String,
            default: undefined,
        },
        alertData: {
            type: Object,
            default: () => ({}),
        },
    },
    setup(props) {
        const {
            state: alertDetailItemState,
            cancelEdit,
            startEdit,
            updateAlert,
            onClickSave,
        } = useAlertInfoItem({
            alertId: props.id,
            isEditMode: false,
            dataForUpdate: props.alertData?.project_id,
        });

        const state = reactive({
            projects: computed(() => store.state.resource.project.items),
            isModalLoading: true,
            modalVisible: false,
        });

        const openModal = () => {
            state.modalVisible = true;
        };

        const onSelectProject = (selected) => {
            alertDetailItemState.dataForUpdate = selected[0]?.id;
        };

        return {
            EDIT_MODE,
            ...toRefs(alertDetailItemState),
            ...toRefs(state),
            referenceRouter,
            cancelEdit,
            startEdit,
            updateAlert,
            onClickSave,
            onSelectProject,
            openModal,
        };
    },
};
</script>

<style lang="postcss" scoped>
@import '../styles/alertInfoItem.pcss';
.modal-body {
    margin-top: 2rem;
}
.project-select-dropdown::v-deep {
        max-width: 25rem;
        flex-grow: 1;
}
</style>
