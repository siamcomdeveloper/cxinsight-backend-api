export interface Answer {
    [x: string]: any;
    id?: string;
    survey_id: string;
    collector_id: string;
    response_id: string;
    question_id: string;
    question_type_id: string;

    answer_id: string;
    answer: string;
    comment: string;
    analyze_entity: string;
    analyze_sentiment: string;

    skip_status: string;
    alert_status: string;
    active: string;
    created_at: Date;
    modified_at: Date;
    deleted_at: Date;
}