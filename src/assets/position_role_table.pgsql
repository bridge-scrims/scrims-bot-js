
CREATE TABLE IF NOT EXISTS scrims_position_role (

    id_position bigint,
    role_id text,
    guild_id text,

    PRIMARY KEY (id_position, role_id, guild_id),
    FOREIGN KEY(id_position) REFERENCES scrims_position(id_position)

);

CREATE OR REPLACE FUNCTION get_position_roles (
    id_position bigint default null,
    role_id text default null,
    guild_id text default null
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
            ''id_position'', scrims_position_role.id_position,
            ''position'', to_json(position), 
            ''role_id'', scrims_position_role.role_id,
            ''guild_id'', scrims_position_role.guild_id,
            ''guild'', to_json(scrims_guild)
        )
    )
    FROM 
    scrims_position_role 
    LEFT JOIN LATERAL (SELECT * FROM scrims_position WHERE scrims_position.id_position = scrims_position_role.id_position LIMIT 1) position ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_guild WHERE scrims_guild.guild_id = scrims_position_role.guild_id LIMIT 1) scrims_guild ON true
    WHERE (
        ($1 is null or scrims_position_role.id_position = $1) AND
        ($2 is null or scrims_position_role.role_id = $2) AND
        ($3 is null or scrims_position_role.guild_id = $3)
    )
' USING id_position, role_id, guild_id
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_position_role_change()
RETURNS trigger 
AS $$
DECLARE
    position_roles json;
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('position_role_remove', row_to_json(OLD)::text);
        RETURN OLD;
    END IF;

    EXECUTE 'SELECT get_position_roles( id_position => $1, role_id => $2, guild_id => $3 )'
    USING NEW.id_position, NEW.role_id, NEW.guild_id
    INTO position_roles;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'position_role_update', json_build_object(
            'selector', row_to_json(OLD), 
            'data', (position_roles->>0)::json
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('position_role_create', position_roles->>0);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;

DO
$do$
BEGIN
    CREATE TRIGGER position_role_trigger
        AFTER INSERT OR UPDATE OR DELETE
        ON scrims_position_role
        FOR EACH ROW
        EXECUTE PROCEDURE process_position_role_change();
EXCEPTION WHEN OTHERS THEN NULL;
END
$do$;
