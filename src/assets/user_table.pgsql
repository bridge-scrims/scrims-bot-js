
CREATE TABLE scrims_user (

    id_user uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    joined_at bigint NOT NULL,

    discord_id text NULL,
    discord_username text NULL,
    discord_discriminator int NULL,
    discord_accent_color int NULL,
    discord_avatar text NULL,
    
    mc_uuid text NULL,
    mc_name text NULL,
    mc_verified boolean DEFAULT false,

    country text NULL,
    timezone text NULL
    
);

CREATE OR REPLACE FUNCTION get_users (
    id_user uuid default null,
    joined_at bigint default null,

    discord_id text default null,
    discord_username text default null,
    discord_discriminator int default null,
    discord_accent_color int default null,
    discord_avatar text default null,

    mc_uuid text default null,
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
    discord_accent_color, discord_avatar,  mc_uuid, mc_name, mc_verified, country, timezone
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION get_user_id (
    id_user uuid default null,
    discord_id text default null,
    discord_username text default null,
    discord_discriminator int default null,
    mc_uuid text default null,
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


CREATE TRIGGER scrims_user_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON scrims_user
    FOR EACH ROW
    EXECUTE PROCEDURE process_scrims_user_change();