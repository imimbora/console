/* eslint-disable camelcase */

import { Tags, TimeStamp } from '@/models';
import { QueryStoreFilter } from '@spaceone/console-core-lib/query/type';
import {
    ALERT_SEVERITY, ALERT_STATE,
    ALERT_STATE_FILTER, ALERT_URGENCY,
    ASSIGNED_STATE,
    FINISH_CONDITION,
    SCOPE,
} from '@/services/monitoring/alert-manager/lib/config';
import { RouteQueryString } from '@/lib/router-query-string';


export interface Rule {
    notification_level: string;
    escalate_minutes?: number;
}

export interface EscalationPolicyFormModel {
    name: string;
    rules: Rule[];
    scope: SCOPE.global | SCOPE.project;
    finish_condition: FINISH_CONDITION.acknowledged | FINISH_CONDITION.resolved;
    repeat_count: number;
    project_id?: string;
}

type responder = {
    resource_type: string;
    resource_id: string;
}

interface ResourceModel {
    resource_id?: string;
    resource_type?: string;
    name?: string;
    ip_address?: string;
}

export interface AlertDataModel {
    responders: responder[];
    alert_number: number;
    alert_id: string;
    title: string;
    state: ALERT_STATE;
    status_message: string;
    description: string;
    assignee: string;
    urgency: ALERT_URGENCY;
    severity: ALERT_SEVERITY;
    is_snoozed: true;
    snoozed_end_time: TimeStamp;
    escalation_step: number;
    escalation_ttl: number;
    webhook_id: string;
    escalation_policy_id: string;
    project_id: string;
    project_dependencies: string[];
    rule: string;
    resource: ResourceModel;
    created_at: TimeStamp;
    updated_at: TimeStamp;
    acknowledged_at: TimeStamp;
    resolved_at: TimeStamp;
    escalated_at: TimeStamp;
    additional_info: object;
}

export interface Event {
    additional_info: object;
    alert_id: string;
    created_at: TimeStamp;
    description: string;
    event_id: string;
    event_key: string;
    event_type: string;
    occurred_at: TimeStamp;
    project_id: string;
    raw_data: object;
    resource: object;
    rule: string;
    severity: string;
    title: string;
    webhook_id: string;
}

export interface AlertBottomFilters {
    state: ALERT_STATE_FILTER;
    urgency: ALERT_URGENCY;
    assigned: ASSIGNED_STATE;
}

export interface AlertListTableFilters extends AlertBottomFilters {
    filters: QueryStoreFilter[];
}

export interface AlertStateUpdateParams {
    alerts: string[];
    state: ALERT_STATE;
    assignee?: string;
    note?: string;
}

export type AlertListPageUrlQuery = Partial<Record<'state' | 'urgency' | 'assigned' | 'filters', RouteQueryString>>

export interface ProjectMember {
    created_at: TimeStamp;
    domain_id?: string;
    labels: string[];
    project_group_info: object;
    project_info?: object;
    resource_id: string;
    resource_type: string;
    role_binding_id?: string;
    role_info?: object;
    tags: Tags;
}
