
CREATE TABLE IF NOT EXISTS scrims_position (

    id_position SERIAL PRIMARY KEY,
    name text NOT NULL UNIQUE,
    sticky boolean NOT NULL,
    level INT NULL
    
);

DO
$$
BEGIN
    if NOT EXISTS (select * FROM scrims_position WHERE name = 'ticket_open_mention') THEN
        INSERT INTO scrims_position (name, level, sticky) VALUES('ticket_open_mention', NULL, true);
    END IF;
    if NOT EXISTS (select * FROM scrims_position WHERE name = 'suggestion_blacklisted') THEN
        INSERT INTO scrims_position (name, level, sticky) VALUES('suggestion_blacklisted', NULL, true);
    END IF;
    if NOT EXISTS (select * FROM scrims_position WHERE name = 'support_blacklisted') THEN
        INSERT INTO scrims_position (name, level, sticky) VALUES('support_blacklisted', NULL, true);
    END IF;

    if NOT EXISTS (select * FROM scrims_position WHERE name = 'owner') THEN
        INSERT INTO scrims_position (name, level, sticky) VALUES('owner', 1, false);
    END IF;
    if NOT EXISTS (select * FROM scrims_position WHERE name = 'staff') THEN
        INSERT INTO scrims_position (name, level, sticky) VALUES('staff', 2, false);
    END IF;
    if NOT EXISTS (select * FROM scrims_position WHERE name = 'support') THEN
        INSERT INTO scrims_position (name, level, sticky) VALUES('support', 3, false);
    END IF;

    if NOT EXISTS (select * FROM scrims_position WHERE name = 'bridge_scrims_member') THEN
        INSERT INTO scrims_position (name, level, sticky) VALUES('bridge_scrims_member', 100, false);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION get_positions(

    id_position bigint default null,
    name text default null,
    sticky boolean default null,
    level int default null

) 
returns json
AS $$
DECLARE
    retval json;
BEGIN
EXECUTE '
    SELECT
    json_agg(scrims_position)
    FROM 
    scrims_position 
    WHERE 
    ($1 is null or id_position = $1) AND
    ($2 is null or name = $2) AND
    ($3 is null or sticky = $3) AND
    ($4 is null or level = $4)
' USING id_position, name, sticky, level
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION get_position_id(

    id_position bigint default null,
    name text default null,
    sticky boolean default null,
    level int default null
    
) 
RETURNS bigint 
AS $$
DECLARE
    retval bigint;
BEGIN
EXECUTE '
    SELECT scrims_position.id_position FROM scrims_position 
    WHERE 
    ($1 is null or scrims_position.id_position = $1) AND
    ($2 is null or scrims_position.name = $2) AND
    ($3 is null or scrims_position.sticky = $3) AND
    ($4 is null or scrims_position.level = $4)
' USING id_position, name, sticky, level
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;