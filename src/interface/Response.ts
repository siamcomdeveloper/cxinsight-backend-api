export interface SurveyResponse {
    [x: string]: any;
    id?: string;
    survey_id?: string;
    collector_id?: string;
    time_spent?: string;
    complete_status?: string;
    ip_address?: string;
    email_address?: string;
    mobile_number?: string;
    first_name?: string;
    last_name?: string;
    alert_status?: string;
    active?: string;
    created_at?: Date;
    modified_at?: Date;
    deleted_at?: Date;
}