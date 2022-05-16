CREATE TABLE IF NOT EXISTS scrims_suggestion (

    id_suggestion uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    guild_id text null,
    channel_id text NULL,
    message_id text NULL,
    suggestion text NULL,

    attachment_id text NULL,
    created_at bigint NOT NULL,
    id_creator uuid NOT NULL,
    epic bigint NULL,

    FOREIGN KEY(id_creator) REFERENCES scrims_user(id_user),
    FOREIGN KEY(attachment_id) REFERENCES scrims_attachment(attachment_id)
        
);

CREATE OR REPLACE FUNCTION get_suggestions (

    id_suggestion uuid default null,
    guild_id text default null,
    channel_id text default null,
    message_id text default null,
    suggestion text default null,
    attachment_id text default null,
    created_at bigint default null,
    id_creator uuid default null,
    epic bigint default null

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
            ''id_suggestion'', scrims_suggestion.id_suggestion,
            ''guild_id'', scrims_suggestion.guild_id,
            ''guild'', to_json(scrims_guild),
            ''channel_id'', scrims_suggestion.channel_id,
            ''message_id'', scrims_suggestion.message_id,
            ''attachment_id'', scrims_suggestion.attachment_id,
            ''attachment'', to_json(attachment),
            ''suggestion'', scrims_suggestion.suggestion,
            ''created_at'', scrims_suggestion.created_at,
            ''id_creator'', scrims_suggestion.id_creator,
            ''creator'', to_json(creator),
            ''epic'', scrims_suggestion.epic
        )
    )
    FROM 
    scrims_suggestion 
    LEFT JOIN LATERAL (SELECT * FROM scrims_user WHERE scrims_user.id_user = scrims_suggestion.id_creator LIMIT 1) creator ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_guild WHERE scrims_guild.guild_id = scrims_suggestion.guild_id LIMIT 1) scrims_guild ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_attachment WHERE scrims_attachment.attachment_id = scrims_suggestion.attachment_id LIMIT 1) attachment ON true
    WHERE 
    ($1 is null or scrims_suggestion.id_suggestion = $1) AND
    ($2 is null or scrims_suggestion.channel_id = $2) AND
    ($3 is null or scrims_suggestion.message_id = $3) AND
    ($4 is null or scrims_suggestion.suggestion = $4) AND
    ($5 is null or scrims_suggestion.created_at = $5) AND
    ($6 is null or scrims_suggestion.id_creator = $6) AND
    ($7 is null or scrims_suggestion.epic = $7) AND
    ($8 is null or scrims_suggestion.guild_id = $8) AND
    ($9 is null or scrims_suggestion.attachment_id = $9)
' USING id_suggestion, channel_id, message_id, suggestion, created_at, id_creator, epic, guild_id, attachment_id
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_suggestions_change()
RETURNS trigger 
AS $$
DECLARE
    suggestions json;
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('suggestion_remove', to_json(OLD)::text);
        RETURN OLD;
    END IF;

    EXECUTE 'SELECT get_suggestions( id_suggestion => $1 )' USING NEW.id_suggestion INTO suggestions;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'suggestion_update', json_build_object(
            'selector', json_build_object('id_suggestion', OLD.id_suggestion),
            'data', (suggestions->>0)::json
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('suggestion_create', suggestions->>0);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;

DO
$do$
BEGIN
    CREATE TRIGGER suggestion_trigger
        AFTER INSERT OR UPDATE OR DELETE
        ON scrims_suggestion
        FOR EACH ROW
        EXECUTE PROCEDURE process_suggestions_change();
EXCEPTION WHEN OTHERS THEN NULL;
END
$do$;
