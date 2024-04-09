export interface Survey {
    [x: string]: any;
    id?: string;
    name: string;
    owner_user_id: string;
    project_id: string;
    touchpoint_id: string;
    template_id: string;
    status: string;
    num_page: string;
    num_question: string;
    total_responses: string;
    normal_responses: string;
    good_responses: string;
    bad_responses: string;
    responses_volume_id: string;
    alert_status: string;
    completion_rate: string;
    time_spent: string;
    num_collector: string;
    notification_status: string;
    image_src: string;
    active: string;
    created_at: Date;
    modified_at: Date;
    deleted_at: Date;
}