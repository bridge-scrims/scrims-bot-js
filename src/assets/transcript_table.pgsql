
CREATE TABLE IF NOT EXISTS scrims_ticket_message (

    id_ticket uuid NOT NULL,
    id_author uuid NOT NULL,

    message_id text NOT NULL,
    reference_id text NULL,

    content text NOT NULL,
    deleted bigint NULL,
    created_at bigint NOT NULL,

    PRIMARY KEY (id_ticket, message_id, created_at),
    FOREIGN KEY (id_ticket) REFERENCES scrims_ticket(id_ticket),
    FOREIGN KEY (id_author) REFERENCES scrims_user(id_user)

);

DO 
$$
BEGIN
    IF NOT EXISTS (SELECT * FROM information_schema.columns WHERE table_name='scrims_ticket_message' and column_name='reference_id') 
        THEN ALTER TABLE scrims_ticket_message ADD COLUMN reference_id text NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END 
$$;

CREATE OR REPLACE FUNCTION get_ticket_messages (
    id_ticket uuid default null,
    id_author uuid default null,
    message_id text default null,
    content text default null,
    deleted bigint default null,
    created_at bigint default null
) 
returns json
AS $$
DECLARE
    retval json;
BEGIN
EXECUTE '
    SELECT
    json_agg(
        json_build_object(
            ''id_ticket'', scrims_ticket_message.id_ticket,
            ''ticket'', to_json(ticket),
            ''id_author'', scrims_ticket_message.id_author,
            ''author'', to_json(author),
            ''message_id'', scrims_ticket_message.message_id,
            ''content'', scrims_ticket_message.content,
            ''deleted'', scrims_ticket_message.deleted,
            ''created_at'', scrims_ticket_message.created_at,
            ''reference_id'', scrims_ticket_message.reference_id
        )
    )
    FROM 
    scrims_ticket_message 
    LEFT JOIN scrims_ticket ticket ON ticket.id_ticket = scrims_ticket_message.id_ticket 
    LEFT JOIN scrims_user author ON author.id_user = scrims_ticket_message.id_author 
    WHERE 
    ($1 is null or scrims_ticket_message.id_ticket = $1) AND
    ($2 is null or scrims_ticket_message.id_author = $2) AND
    ($3 is null or scrims_ticket_message.message_id = $3) AND
    ($4 is null or scrims_ticket_message.content = $4) AND
    ($5 is null or scrims_ticket_message.deleted = $5) AND
    ($6 is null or scrims_ticket_message.created_at = $6)
' USING id_ticket, id_author, message_id, content, deleted, created_at
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;


CREATE TABLE IF NOT EXISTS scrims_ticket_message_attachment (

    id_ticket uuid NOT NULL,
    message_id text NOT NULL,
    attachment_id text NOT NULL,

    PRIMARY KEY (id_ticket, message_id, attachment_id),
    FOREIGN KEY(id_ticket) REFERENCES scrims_ticket(id_ticket),
    FOREIGN KEY(attachment_id) REFERENCES scrims_attachment(attachment_id)

);

CREATE OR REPLACE FUNCTION get_ticket_message_attachments (
    id_ticket uuid default null,
    message_id text default null,
    attachment_id text default null
) 
returns json
AS $$
DECLARE
    retval json;
BEGIN
EXECUTE '
    SELECT
    json_agg(
        json_build_object(
            ''id_ticket'', scrims_ticket_message_attachment.id_ticket,
            ''ticket'', to_json(ticket),
            ''message_id'', scrims_ticket_message_attachment.message_id,
            ''attachment_id'', scrims_ticket_message_attachment.attachment_id,
            ''attachment'', to_json(attachment)
        )
    )
    FROM 
    scrims_ticket_message_attachment 
    LEFT JOIN LATERAL (SELECT * FROM scrims_ticket WHERE scrims_ticket.id_ticket = scrims_ticket_message_attachment.id_ticket LIMIT 1) ticket ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_attachment WHERE scrims_attachment.attachment_id = scrims_ticket_message_attachment.attachment_id LIMIT 1) attachment ON true
    WHERE 
    ($1 is null or scrims_ticket_message_attachment.id_ticket = $1) AND
    ($2 is null or scrims_ticket_message_attachment.message_id = $2) AND
    ($3 is null or scrims_ticket_message_attachment.attachment_id = $3)
' USING id_ticket, message_id, attachment_id
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;