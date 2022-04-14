CREATE TABLE scrims_suggestion (

    id_suggestion SERIAL PRIMARY KEY,

    id_guild int NULL,
    channel_id text NULL,
    message_id text NULL,
    suggestion text NULL,

    created_at bigint NOT NULL,
    id_creator int NOT NULL,
    epic bigint NULL,

    FOREIGN KEY(id_guild) REFERENCES scrims_guild(id_guild),
    FOREIGN KEY(id_creator) REFERENCES scrims_user(id_user)
        
);

CREATE OR REPLACE FUNCTION get_suggestions (

    id_suggestion int default null,
    id_guild int default null,
    channel_id text default null,
    message_id text default null,
    suggestion text default null,
    created_at bigint default null,
    id_creator bigint default null,
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
            ''id_guild'', scrims_suggestion.id_guild,
            ''guild'', to_json(scrims_guild),
            ''channel_id'', scrims_suggestion.channel_id,
            ''message_id'', scrims_suggestion.message_id,
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
    LEFT JOIN LATERAL (SELECT * FROM scrims_guild WHERE scrims_guild.id_guild = scrims_suggestion.id_guild LIMIT 1) scrims_guild ON true
    WHERE 
    ($1 is null or scrims_suggestion.id_suggestion = $1) AND
    ($2 is null or scrims_suggestion.channel_id = $2) AND
    ($3 is null or scrims_suggestion.message_id = $3) AND
    ($4 is null or scrims_suggestion.suggestion = $4) AND
    ($5 is null or scrims_suggestion.created_at = $5) AND
    ($6 is null or scrims_suggestion.id_creator = $6) AND
    ($7 is null or scrims_suggestion.epic = $7) AND
    ($8 is null or scrims_suggestion.id_guild = $8)
' USING id_suggestion, channel_id, message_id, suggestion, created_at, id_creator, epic, id_guild
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
            'selector', to_json(OLD), 
            'data', (suggestions->>0)::json
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('suggestion_create', suggestions->>0);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;


CREATE TRIGGER suggestion_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON scrims_suggestion
    FOR EACH ROW
    EXECUTE PROCEDURE process_suggestions_change();