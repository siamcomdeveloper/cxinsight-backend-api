export interface Collector {
    [x: string]: any;
    id?: string;
    survey_id?: string;
    name: string;
    type: string;
    status: string;
    project_id: string;
    link: string;
    responses: string;
    subject: string;
    message: string;
    send: string;
    send_date: Date;
    cutoff: string;
    cutoff_date: Date;
    anonymous: string;
    history_id: string;
    active: string;
    created_at: Date;
    modified_at: Date;
    deleted_at: Date;
}