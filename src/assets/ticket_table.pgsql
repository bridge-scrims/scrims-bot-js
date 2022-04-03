
CREATE TABLE scrims_ticket_type (

    id_type SERIAL PRIMARY KEY,
    name text NOT NULL 

);

CREATE OR REPLACE FUNCTION get_ticket_type_id (
    id_type int default null,
    name text default null
) 
RETURNS int 
AS $$
DECLARE
    retval INTEGER;
BEGIN
EXECUTE '
    SELECT scrims_ticket_type.id_type FROM scrims_ticket_type 
    WHERE 
    ($1 is null or scrims_ticket_type.id_type = $1) AND
    ($2 is null or scrims_ticket_type.name = $2)
' USING id_type, name
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

INSERT INTO scrims_ticket_type (name) VALUES('support');
INSERT INTO scrims_ticket_type (name) VALUES('report');

CREATE TABLE scrims_ticket_status (

    id_status SERIAL PRIMARY KEY,
    name text NOT NULL 

);

CREATE OR REPLACE FUNCTION get_ticket_status_id (
    id_status int default null,
    name text default null
) 
RETURNS int 
AS $$
DECLARE
    retval INTEGER;
BEGIN
EXECUTE '
    SELECT scrims_ticket_status.id_status FROM scrims_ticket_status 
    WHERE 
    ($1 is null or scrims_ticket_status.id_status = $1) AND
    ($2 is null or scrims_ticket_status.name = $2)
' USING id_status, name
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

INSERT INTO scrims_ticket_status (name) VALUES('open');
INSERT INTO scrims_ticket_status (name) VALUES('closed');
INSERT INTO scrims_ticket_status (name) VALUES('deleted');

CREATE TABLE scrims_ticket (

    id_ticket SERIAL PRIMARY KEY,
    id_type int NOT NULL,
    id_user int NOT NULL,
    id_status int NOT NULL,

    channel_id text NOT NULL,
    guild_id text NOT NULL,
    created_at bigint NOT NULL,

    FOREIGN KEY(id_user) 
        REFERENCES scrims_user(id_user),
    FOREIGN KEY(id_type) 
        REFERENCES scrims_ticket_type(id_type),
    FOREIGN KEY(id_status)
        REFERENCES scrims_ticket_status(id_status)

);

CREATE OR REPLACE FUNCTION get_ticket_id (
    id_ticket int default null,
    id_type int default null,
    id_user int default null,
    id_status int default NULL,
    channel_id text default null,
    guild_id text default null,
    created_at bigint default null
) 
RETURNS int 
AS $$
DECLARE
    retval INTEGER;
BEGIN
EXECUTE '
    SELECT scrims_ticket.id_ticket FROM scrims_ticket 
    WHERE 
    ($1 is null or scrims_ticket.id_ticket = $1) AND
    ($2 is null or scrims_ticket.id_user = $2) AND
    ($3 is null or scrims_ticket.channel_id = $3) AND
    ($4 is null or scrims_ticket.guild_id = $4) AND
    ($5 is null or scrims_ticket.created_at = $5) AND 
    ($6 is null or scrims_ticket.id_type = $6) AND
    ($7 is null or scrims_ticket.id_status = $7)
' USING id_ticket, id_user, channel_id, guild_id, created_at, id_type, id_status
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION get_tickets (
    id_ticket int default null,
    id_type int default null,
    id_user int default null,
    id_status int default NULL,
    channel_id text default null,
    guild_id text default null,
    created_at bigint default null
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
            ''id_ticket'', scrims_ticket.id_ticket,
            ''id_type'', scrims_ticket.id_type,
            ''type'', to_json(ticket_type),
            ''id_user'', scrims_ticket.id_user,
            ''user'', to_json(scrims_user),
            ''id_status'', scrims_ticket.id_status,
            ''status'', to_json(ticket_status),
            ''channel_id'', scrims_ticket.channel_id,
            ''guild_id'', scrims_ticket.guild_id,
            ''created_at'', scrims_ticket.created_at
        )
    )
    FROM 
    scrims_ticket 
    LEFT JOIN scrims_user ON scrims_user.id_user = scrims_ticket.id_user 
    LEFT JOIN scrims_ticket_type ticket_type ON ticket_type.id_type = scrims_ticket.id_type 
    LEFT JOIN scrims_ticket_status ticket_status ON ticket_status.id_status = scrims_ticket.id_status 

    WHERE 
    ($1 is null or scrims_ticket.id_ticket = $1) AND
    ($2 is null or scrims_ticket.id_user = $2) AND
    ($3 is null or scrims_ticket.channel_id = $3) AND
    ($4 is null or scrims_ticket.guild_id = $4) AND
    ($5 is null or scrims_ticket.created_at = $5) AND
    ($6 is null or scrims_ticket.id_type = $6) AND
    ($7 is null or scrims_ticket.id_status = $7)
' USING id_ticket, id_user, channel_id, guild_id, created_at, id_type, id_status
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;