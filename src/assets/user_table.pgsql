
CREATE TABLE IF NOT EXISTS scrims_user (

    id_user uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    joined_at bigint NOT NULL,

    discord_id text NULL,
    discord_username text NULL,
    discord_discriminator int NULL,
    discord_accent_color int NULL,
    discord_avatar text NULL,
    
    mc_uuid uuid NULL,
    mc_name text NULL,
    mc_verified boolean DEFAULT false,

    country text NULL,
    timezone text NULL
    
);

DO
$do$
BEGIN
    DROP FUNCTION get_user_id(uuid, text, text, int, text, text);
    DROP FUNCTION get_users(uuid, bigint, text, text, int, int, text, text, text, boolean, text, text);
EXCEPTION WHEN OTHERS THEN NULL;
END
$do$;

CREATE OR REPLACE FUNCTION get_users (
    id_user uuid default null,
    joined_at bigint default null,

    discord_id text default null,
    discord_username text default null,
    discord_discriminator int default null,
    discord_accent_color int default null,
    discord_avatar text default null,

    mc_uuid uuid default null,
    mc_name text default null,
    mc_verified boolean default null,

    country text default null,
    timezone text default null
) 
returns json
AS $$
DECLARE
    retval json;
BEGIN
EXECUTE '
    SELECT
    json_agg(scrims_user)
    FROM 
    scrims_user 
    WHERE 
    ($1 is null or id_user = $1) AND
    ($2 is null or joined_at = $2) AND
    ($3 is null or discord_id = $3) AND
    ($4 is null or discord_username = $4) AND
    ($5 is null or discord_discriminator = $5) AND
    ($6 is null or discord_accent_color = $6) AND
    ($7 is null or discord_avatar = $7) AND
    ($8 is null or mc_uuid = $8) AND
    ($9 is null or mc_name = $9) AND
    ($10 is null or mc_verified = $10) AND
    ($11 is null or country = $11) AND
    ($12 is null or timezone = $12)
' USING id_user, joined_at, discord_id, discord_username, discord_discriminator, 
    discord_accent_color, discord_avatar, mc_uuid, mc_name, mc_verified, country, timezone
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION get_user_id (
    id_user uuid default null,
    discord_id text default null,
    discord_username text default null,
    discord_discriminator int default null,
    mc_uuid uuid default null,
    mc_name text default null
) 
returns uuid 
AS $$
DECLARE
    retval uuid;
BEGIN
EXECUTE '
    SELECT scrims_user.id_user FROM scrims_user
    WHERE 
    ($1 is null or scrims_user.id_user = $1) AND
    ($2 is null or scrims_user.discord_id = $2) AND
    ($3 is null or scrims_user.discord_username = $3) AND
    ($4 is null or scrims_user.discord_discriminator = $4) AND
    ($5 is null or scrims_user.mc_uuid = $5) AND
    ($6 is null or scrims_user.mc_name = $6)
' USING id_user, discord_id, discord_username, discord_discriminator, mc_uuid, mc_name
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION process_scrims_user_change()
RETURNS trigger 
AS $$
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('scrims_user_remove', json_build_object('id_user', OLD.id_user)::text);
        RETURN OLD;
    END IF;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'scrims_user_update', json_build_object(
            'selector', json_build_object('id_user', OLD.id_user), 
            'data', row_to_json(NEW)
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('scrims_user_create', row_to_json(NEW)::text);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;


DO
$do$
BEGIN
    CREATE TRIGGER scrims_user_trigger
        AFTER INSERT OR UPDATE OR DELETE
        ON scrims_user
        FOR EACH ROW
        EXECUTE PROCEDURE process_scrims_user_change();
EXCEPTION WHEN OTHERS THEN NULL;
END
$do$;

CREATE OR REPLACE FUNCTION merge_scrims_users(id_user_a uuid, id_user_b uuid)
RETURNS uuid
AS $$
DECLARE
    tname text;
    cname text;
BEGIN

    FOR tname, cname IN
        SELECT
            r.table_name, r.column_name
        FROM information_schema.constraint_column_usage       u
        INNER JOIN information_schema.referential_constraints fk
                ON u.constraint_catalog = fk.unique_constraint_catalog
                    AND u.constraint_schema = fk.unique_constraint_schema
                    AND u.constraint_name = fk.unique_constraint_name
        INNER JOIN information_schema.key_column_usage        r
                ON r.constraint_catalog = fk.constraint_catalog
                    AND r.constraint_schema = fk.constraint_schema
                    AND r.constraint_name = fk.constraint_name
        WHERE
            u.column_name = 'id_user' AND
            u.table_catalog = 'scrims' AND
            u.table_schema = 'public' AND
            u.table_name = 'scrims_user'
    LOOP
        BEGIN
            EXECUTE 'UPDATE ' || tname || ' SET ' || cname || '=$1 WHERE ' || cname || '=$2' USING id_user_a, id_user_b;
        EXCEPTION WHEN unique_violation THEN
            EXECUTE 'DELETE FROM ' || tname || ' WHERE ' || cname || '=$1' USING id_user_b;
            -- This could happen if both scrims_users have simularities.
        END;
    END LOOP;

    FOR cname IN
        SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scrims_user' 
    LOOP
        EXECUTE ('UPDATE scrims_user SET ' || cname || '=(SELECT ' || cname || ' FROM scrims_user WHERE id_user=$1) WHERE id_user=$2 AND ' || cname || ' IS NULL') USING id_user_b, id_user_a;
    END LOOP;

    EXECUTE 'DELETE FROM scrims_user WHERE id_user=$1' USING id_user_b;
    RETURN id_user_a;

END $$
LANGUAGE plpgsql;

