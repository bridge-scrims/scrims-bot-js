CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS scrims_attachment (

    attachment_id text NOT NULL,

    filename text NULL,
    content_type text NULL,
    url text NOT NULL,

    UNIQUE(attachment_id)

);

CREATE OR REPLACE FUNCTION get_attachments (
    attachment_id text default null,
    filename text default null,
    content_type text default null,
    url text default null
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
            ''attachment_id'', scrims_attachment.attachment_id,
            ''filename'', scrims_attachment.filename,
            ''content_type'', scrims_attachment.content_type,
            ''url'', scrims_attachment.url
        )
    )
    FROM 
    scrims_attachment 
    WHERE 
    ($1 is null or scrims_attachment.attachment_id = $1) AND
    ($2 is null or scrims_attachment.filename = $2) AND
    ($3 is null or scrims_attachment.content_type = $3) AND
    ($4 is null or scrims_attachment.url = $4)
' USING attachment_id, filename, content_type, url
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_attachment_id (

    attachment_id text default null,
    filename text default null,
    content_type text default null,
    url text default null

) 
RETURNS text 
AS $$
DECLARE
    retval text;
BEGIN
EXECUTE '
    SELECT scrims_attachment.attachment_id FROM scrims_attachment 
    WHERE 
    ($1 is null or scrims_attachment.attachment_id = $1) AND
    ($2 is null or scrims_attachment.filename = $2) AND
    ($3 is null or scrims_attachment.content_type = $3) AND
    ($4 is null or scrims_attachment.url = $4)
' USING attachment_id, filename, content_type, url
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_attachment_change()
RETURNS trigger 
AS $$
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('scrims_attachment_remove', json_build_object('attachment_id', OLD.attachment_id)::text);
        RETURN OLD;
    END IF;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'scrims_attachment_update', json_build_object(
            'selector', json_build_object('attachment_id', OLD.attachment_id), 
            'data', row_to_json(NEW)
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('scrims_attachment_create', row_to_json(NEW)::text);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;

DO
$do$
BEGIN
    CREATE TRIGGER guild_entry_trigger
        AFTER INSERT OR UPDATE OR DELETE
        ON scrims_guild_entry
        FOR EACH ROW
        EXECUTE PROCEDURE process_guild_entry_change();
EXCEPTION WHEN OTHERS THEN NULL;
END
$do$;