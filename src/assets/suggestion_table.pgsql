CREATE TABLE scrims_suggestion (

    id_suggestion SERIAL PRIMARY KEY,

    channel_id text NULL,
    message_id text NULL,
    suggestion text NULL,

    created_at bigint NOT NULL,
    id_creator int NOT NULL,

    FOREIGN KEY(id_creator) 
        REFERENCES scrims_user(id_user)
        
);

CREATE OR REPLACE FUNCTION get_suggestions(
    id_suggestion int default null,
    channel_id text default null,
    message_id text default null,
    suggestion text default null,
    created_at bigint default null,
    id_creator bigint default null
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
            ''channel_id'', scrims_suggestion.channel_id,
            ''message_id'', scrims_suggestion.message_id,
            ''suggestion'', scrims_suggestion.suggestion,
            ''created_at'', scrims_suggestion.created_at,
            ''id_creator'', scrims_suggestion.id_creator,
            ''creator'', to_json(creator)
        )
    )
    FROM 
    scrims_suggestion 
    LEFT JOIN scrims_user creator ON creator.id_user = scrims_suggestion.id_creator 

    WHERE 
    ($1 is null or scrims_suggestion.id_suggestion = $1) AND
    ($2 is null or scrims_suggestion.channel_id = $2) AND
    ($3 is null or scrims_suggestion.message_id = $3) AND
    ($4 is null or scrims_suggestion.suggestion = $4) AND
    ($5 is null or scrims_suggestion.created_at = $5) AND
    ($6 is null or scrims_suggestion.id_creator = $6) 
' USING id_suggestion, channel_id, message_id, suggestion, created_at, id_creator
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;