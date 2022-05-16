
CREATE TABLE IF NOT EXISTS scrims_guild_entry_type (

    id_type SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
        
);

DO
$$
BEGIN
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'positions_log_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('positions_log_channel');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'suggestions_log_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestions_log_channel');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'tickets_log_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_log_channel');
    END IF;

    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'tickets_transcript_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_transcript_channel');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'tickets_support_category') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_support_category');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'tickets_report_category') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_report_category');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'tickets_status_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_status_channel');
    END IF;

    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'vouch_status_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('vouch_status_channel');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'prime_status_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('prime_status_channel');
    END IF;

    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'suggestions_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestions_channel');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'epic_suggestions_channel') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('epic_suggestions_channel');
    END IF;

    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'suggestions_vote_const') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestions_vote_const');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'suggestion_up_vote_emoji') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestion_up_vote_emoji');
    END IF;
    if NOT EXISTS (select * FROM scrims_guild_entry_type WHERE name = 'suggestion_down_vote_emoji') THEN
        INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestion_down_vote_emoji');
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION get_guild_entry_type_id (

    id_type bigint default null,
    name text default null

) 
RETURNS bigint 
AS $$
DECLARE
    retval bigint;
BEGIN
EXECUTE '
    SELECT scrims_guild_entry_type.id_type FROM scrims_guild_entry_type 
    WHERE 
    ($1 is null or scrims_guild_entry_type.id_type = $1) AND
    ($2 is null or scrims_guild_entry_type.name = $2)
' USING id_type, name INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS scrims_guild (

    guild_id TEXT UNIQUE,
    name TEXT NOT NULL,
    icon TEXT NULL
        
);

CREATE OR REPLACE FUNCTION process_guild_change()
RETURNS trigger 
AS $$
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('guild_remove', to_json(OLD)::text);
        RETURN OLD;
    END IF;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'guild_update', json_build_object(
            'selector', json_build_object('guild_id', OLD.guild_id), 
            'data', to_json(NEW)
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('guild_create', to_json(NEW)::text);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;

DO $$
BEGIN
    CREATE TRIGGER guild_trigger
        AFTER INSERT OR UPDATE OR DELETE
        ON scrims_guild
        FOR EACH ROW
        EXECUTE PROCEDURE process_guild_change();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS scrims_guild_entry (

    guild_id TEXT NULL,
    id_type bigint NOT NULL,

    value TEXT NULL,

    UNIQUE(guild_id, id_type),
    FOREIGN KEY(id_type) REFERENCES scrims_guild_entry_type(id_type)
        
);

CREATE OR REPLACE FUNCTION get_guild_entrys(
    guild_id text default null,
    id_type bigint default null,
    value text default null
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
            ''guild_id'', scrims_guild_entry.guild_id,
            ''guild'', to_json(scrims_guild),
            ''id_type'', scrims_guild_entry.id_type,
            ''type'', to_json(scrims_guild_entry_type),
            ''value'', scrims_guild_entry.value
        )
    )
    FROM 
    scrims_guild_entry 
    LEFT JOIN LATERAL (SELECT * FROM scrims_guild WHERE scrims_guild.guild_id = scrims_guild_entry.guild_id LIMIT 1) scrims_guild ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_guild_entry_type WHERE scrims_guild_entry_type.id_type = scrims_guild_entry.id_type LIMIT 1) scrims_guild_entry_type ON true
    WHERE 
    ($1 is null or scrims_guild_entry.guild_id = $1) AND
    ($2 is null or scrims_guild_entry.id_type = $2) AND
    ($3 is null or scrims_guild_entry.value = $3)
' USING guild_id, id_type, value
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_guild_entry_change()
RETURNS trigger 
AS $$
DECLARE
    guild_entrys json;
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('guild_entry_remove', to_json(OLD)::text);
        RETURN OLD;
    END IF;

    EXECUTE 'SELECT get_guild_entrys( guild_id => $1, id_type => $2 )' USING NEW.guild_id, NEW.id_type INTO guild_entrys;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'guild_entry_update', json_build_object(
            'selector', json_build_object('guild_id', OLD.guild_id, 'id_type', OLD.id_type), 
            'data', (guild_entrys->>0)::json
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('guild_entry_create', guild_entrys->>0);
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
