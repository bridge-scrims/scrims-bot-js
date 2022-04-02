
CREATE TABLE scrims_ticket_message (

    id_ticket int NOT NULL,
    id_author int NOT NULL,

    message_id text NOT NULL,
    content text NOT NULL,
    created_at bigint NOT NULL,

    UNIQUE(id_ticket, message_id),
    FOREIGN KEY(id_ticket) 
        REFERENCES scrims_ticket(id_ticket),
    FOREIGN KEY(id_author) 
        REFERENCES scrims_user(id_user)

);

CREATE OR REPLACE FUNCTION get_ticket_messages(
    id_ticket int default null,
    id_author int default null,
    message_id text default null,
    content text default null,
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
            ''created_at'', scrims_ticket_message.created_at
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
    ($5 is null or scrims_ticket_message.created_at = $5)
' USING id_ticket, id_author, message_id, content, created_at
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;