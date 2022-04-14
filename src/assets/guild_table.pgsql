
CREATE TABLE scrims_guild_entry_type (

    id_type SERIAL PRIMARY KEY,
    name TEXT NOT NULL
        
);

INSERT INTO scrims_guild_entry_type (name) VALUES ('positions_log_channel');
INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestions_log_channel');
INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_log_channel');

INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_transcript_channel');
INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_support_category');
INSERT INTO scrims_guild_entry_type (name) VALUES ('tickets_report_category');

INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestions_channel');
INSERT INTO scrims_guild_entry_type (name) VALUES ('epic_suggestions_channel');

INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestions_vote_const');
INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestion_up_vote_emoji');
INSERT INTO scrims_guild_entry_type (name) VALUES ('suggestion_down_vote_emoji');

CREATE OR REPLACE FUNCTION get_guild_entry_type_id (

    id_type int default null,
    name text default null

) 
RETURNS int 
AS $$
DECLARE
    retval INTEGER;
BEGIN
EXECUTE '
    SELECT scrims_guild_entry_type.id_type FROM scrims_guild_entry_type 
    WHERE 
    ($1 is null or scrims_guild_entry_type.id_type = $1) AND
    ($2 is null or scrims_guild_entry_type.name = $2)
' USING id_type, name
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

CREATE TABLE scrims_guild (

    id_guild SERIAL PRIMARY KEY,
    
    discord_id TEXT NULL,
    name TEXT NOT NULL,
    icon TEXT NULL
        
);

CREATE OR REPLACE FUNCTION get_guild_id (

    discord_id text default null,
    name text default null,
    icon text default null

) 
RETURNS int 
AS $$
DECLARE
    retval INTEGER;
BEGIN
EXECUTE '
    SELECT scrims_guild.id_guild FROM scrims_guild 
    WHERE 
    ($1 is null or scrims_guild.discord_id = $1) AND
    ($2 is null or scrims_guild.name = $2) AND
    ($3 is null or scrims_guild.icon = $3)
' USING discord_id, name, icon
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

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
            'selector', to_json(OLD), 
            'data', to_json(NEW)
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('guild_create', to_json(NEW)::text);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;

CREATE TRIGGER guild_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON scrims_guild
    FOR EACH ROW
    EXECUTE PROCEDURE process_guild_change();


CREATE TABLE scrims_guild_entry (

    id_guild INT NULL,
    id_type INT NOT NULL,

    value TEXT NULL,

    UNIQUE(id_guild, id_type),
    FOREIGN KEY(id_guild) REFERENCES scrims_guild(id_guild),
    FOREIGN KEY(id_type) REFERENCES scrims_guild_entry_type(id_type)
        
);

CREATE OR REPLACE FUNCTION get_guild_entrys(
    id_guild int default null,
    id_type int default null,
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
            ''id_guild'', scrims_guild_entry.id_guild,
            ''guild'', to_json(scrims_guild),
            ''id_type'', scrims_guild_entry.id_type,
            ''type'', to_json(scrims_guild_entry_type),
            ''value'', scrims_guild_entry.value
        )
    )
    FROM 
    scrims_guild_entry 
    LEFT JOIN LATERAL (SELECT * FROM scrims_guild WHERE scrims_guild.id_guild = scrims_guild_entry.id_guild LIMIT 1) scrims_guild ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_guild_entry_type WHERE scrims_guild_entry_type.id_type = scrims_guild_entry.id_type LIMIT 1) scrims_guild_entry_type ON true
    WHERE 
    ($1 is null or scrims_guild_entry.id_guild = $1) AND
    ($2 is null or scrims_guild_entry.id_type = $2) AND
    ($3 is null or scrims_guild_entry.value = $3)
' USING id_guild, id_type, value
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
            'selector', to_json(OLD), 
            'data', (guild_entrys->>0)::json
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('guild_entry_create', guild_entrys->>0);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;


CREATE TRIGGER guild_entry_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON scrims_guild_entry
    FOR EACH ROW
    EXECUTE PROCEDURE process_guild_entry_change();