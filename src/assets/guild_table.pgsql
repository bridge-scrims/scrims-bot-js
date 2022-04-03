
CREATE TABLE scrims_guild_entry_type (

    id_type SERIAL PRIMARY KEY,
    name TEXT NOT NULL
        
);

INSERT INTO scrims_guild_entry_type (name) VALUES ('positions_log_channel');

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

CREATE TABLE scrims_guild_entry (

    guild_id TEXT NOT NULL,
    id_type INT NOT NULL,

    value TEXT NULL,

    UNIQUE(guild_id, id_type),
    FOREIGN KEY(id_type) 
        REFERENCES scrims_guild_entry_type(id_type)
        
);

CREATE OR REPLACE FUNCTION get_guild_entrys(
    guild_id text default null,
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
            ''guild_id'', scrims_guild_entry.guild_id,
            ''id_type'', scrims_guild_entry.id_type,
            ''type'', to_json(guild_entry_type),
            ''value'', scrims_guild_entry.value
        )
    )
    FROM 
    scrims_guild_entry 
    LEFT JOIN scrims_guild_entry_type guild_entry_type ON guild_entry_type.id_type = scrims_guild_entry.id_type 

    WHERE 
    ($1 is null or scrims_guild_entry.guild_id = $1) AND
    ($2 is null or scrims_guild_entry.id_type = $2) AND
    ($3 is null or scrims_guild_entry.value = $3)
' USING guild_id, id_type, value
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;