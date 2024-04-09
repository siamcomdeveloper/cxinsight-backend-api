export interface Email {
    [x: string]: any;
    id?: string;
    collector_id?: string;
    email_address?: string;
    first_name: string;
    last_name: string;
    sent: string;
    responded: string;
    active: string;
    created_at: Date;
    modified_at: Date;
    deleted_at: Date;
}