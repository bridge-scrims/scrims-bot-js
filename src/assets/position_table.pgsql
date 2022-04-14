
CREATE TABLE scrims_position (

    id_position SERIAL PRIMARY KEY,
    name text NOT NULL,
    sticky boolean NOT NULL,
    level INT NULL
    
);

INSERT INTO scrims_position (name, level, sticky) VALUES('server_booster', NULL, true);
INSERT INTO scrims_position (name, level, sticky) VALUES('screensharer', NULL, true);
INSERT INTO scrims_position (name, level, sticky) VALUES('developer', NULL, true);
INSERT INTO scrims_position (name, level, sticky) VALUES('artist', NULL, true);
INSERT INTO scrims_position (name, level, sticky) VALUES('editor', NULL, true);

INSERT INTO scrims_position (name, level, sticky) VALUES('prime', NULL, true);
INSERT INTO scrims_position (name, level, sticky) VALUES('private', NULL, true);
INSERT INTO scrims_position (name, level, sticky) VALUES('premium', NULL, true);

INSERT INTO scrims_position (name, level, sticky) VALUES('ticket_open_mention', NULL, true);
INSERT INTO scrims_position (name, level, sticky) VALUES('suggestion_blacklisted', NULL, true);
INSERT INTO scrims_position (name, level, sticky) VALUES('support_blacklisted', NULL, true);

INSERT INTO scrims_position (name, level, sticky) VALUES('owner', 1, false);
INSERT INTO scrims_position (name, level, sticky) VALUES('staff', 2, false);
INSERT INTO scrims_position (name, level, sticky) VALUES('support', 3, false);

INSERT INTO scrims_position (name, level, sticky) VALUES('bridge_scrims_member', 100, false);


CREATE OR REPLACE FUNCTION get_positions(

    id_position int default null,
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

    id_position int default null,
    name text default null,
    sticky boolean default null,
    level int default null
    
) 
RETURNS int 
AS $$
DECLARE
    retval INTEGER;
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