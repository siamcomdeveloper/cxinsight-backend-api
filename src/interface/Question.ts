export interface Question {
    id?: string;
    survey_id: string;
    page_no: string;
    type_id: string;
    question_label: string;
    order_no: string;
    required: string;
    active: string;
    created_at: Date;
    modified_at: Date;
    deleted_at: Date;
}