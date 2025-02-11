<template>
    <p-button-modal
        :header-title="$t('MONITORING.ALERT.DETAIL.EDIT_MODAL_TITLE')"
        centered
        size="sm"
        fade
        :scrollable="false"
        backdrop
        :visible.sync="proxyVisible"
        :disabled="isNameInvalid"
        @confirm="onClickConfirm"
    >
        <template #body>
            <p-field-group :label="$t('PROJECT.DETAIL.MODAL_CREATE_PROJECT_LABEL')"
                           :invalid-text="nameInvalidText"
                           :invalid="isNameInvalid"
                           required
            >
                <template #default="{invalid}">
                    <p-text-input v-model="alertTitleInput" class="block w-full" :invalid="isNameInvalid"
                                  :placeholder="alertTitle"
                    />
                </template>
            </p-field-group>
        </template>
    </p-button-modal>
</template>

<script lang="ts">
import { PButtonModal, PFieldGroup, PTextInput } from '@spaceone/design-system';
import {
    computed, reactive, toRefs,
} from '@vue/composition-api';
import { makeProxy } from '@/lib/helper/composition-helpers';
import { showErrorMessage, showSuccessMessage } from '@/lib/helper/notice-alert-helper';
import { i18n } from '@/translations';
import { store } from '@/store';


export default {
    name: 'AlertTitleEditModal',
    components: {
        PTextInput,
        PFieldGroup,
        PButtonModal,
    },
    directives: {
        focus: {
            inserted(el) {
                el.focus();
            },
        },
    },
    props: {
        visible: {
            type: Boolean,
            default: false,
        },
        alertId: {
            type: String,
            default: null,
        },
        alertTitle: {
            type: String,
            default: null,
        },
    },
    setup(props, { emit, root }) {
        const state = reactive({
            loading: true,
            proxyVisible: makeProxy('visible', props, emit),
            alertTitleInput: props.alertTitle,
            nameInvalidText: computed(() => {
                if (state.alertTitleInput.length === 0) {
                    return i18n.t('MONITORING.ALERT.ESCALATION_POLICY.FORM.NAME_REQUIRED');
                }
                // if (state.alertTitleInput.length > 40) {
                //     return i18n.t('MONITORING.ALERT.ESCALATION_POLICY.FORM.NAME_INVALID_TEXT');
                // }
                return undefined;
            }),
            isNameInvalid: computed(() => !!state.nameInvalidText),
        });

        const updateAlertTitle = async () => {
            try {
                console.log(props.id);
                state.loading = true;
                await store.dispatch('service/alert/updateAlertData', {
                    updateParams: {
                        title: state.alertTitleInput,
                    },
                    alertId: props.alertId,
                });
                showSuccessMessage(i18n.t('MONITORING.ALERT.DETAIL.HEADER.ALT_S_UPDATE_TITLE'), '', root);
            } catch (e) {
                console.error(e);
                showErrorMessage(i18n.t('MONITORING.ALERT.DETAIL.HEADER.ALT_E_UPDATE_TITLE'), e, root);
            } finally {
                state.loading = false;
            }
        };
        const onClickConfirm = async () => {
            await updateAlertTitle();
            state.proxyVisible = false;
            emit('confirm');
        };
        return {
            ...toRefs(state),
            onClickConfirm,
        };
    },
};
</script>
