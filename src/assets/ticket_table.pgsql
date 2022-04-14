
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
    id_guild int NOT NULL,

    channel_id text NOT NULL,
    created_at bigint NOT NULL,

    FOREIGN KEY(id_user) REFERENCES scrims_user(id_user),
    FOREIGN KEY(id_type) REFERENCES scrims_ticket_type(id_type),
    FOREIGN KEY(id_status) REFERENCES scrims_ticket_status(id_status),
    FOREIGN KEY(id_guild) REFERENCES scrims_guild(id_guild)

);

CREATE OR REPLACE FUNCTION get_ticket_id (

    id_ticket int default null,
    id_type int default null,
    id_user int default null,
    id_status int default NULL,
    id_guild int default null,
    channel_id text default null,
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
    ($4 is null or scrims_ticket.id_guild = $4) AND
    ($5 is null or scrims_ticket.created_at = $5) AND 
    ($6 is null or scrims_ticket.id_type = $6) AND
    ($7 is null or scrims_ticket.id_status = $7)
' USING id_ticket, id_user, channel_id, id_guild, created_at, id_type, id_status
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION get_tickets (

    id_ticket int default null,
    id_type int default null,
    id_user int default null,
    id_status int default NULL,
    id_guild int default null,
    channel_id text default null,
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
            ''type'', to_json(scrims_ticket_type),

            ''id_user'', scrims_ticket.id_user,
            ''user'', to_json(scrims_user),

            ''id_status'', scrims_ticket.id_status,
            ''status'', to_json(scrims_ticket_status),

            ''id_guild'', scrims_ticket.id_guild,
            ''guild'', to_json(scrims_guild),

            ''channel_id'', scrims_ticket.channel_id,
            ''created_at'', scrims_ticket.created_at
        )
    )
    FROM 
    scrims_ticket 
    LEFT JOIN LATERAL (SELECT * FROM scrims_ticket_type WHERE scrims_ticket_type.id_type = scrims_ticket.id_type LIMIT 1) scrims_ticket_type ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_user WHERE scrims_user.id_user = scrims_ticket.id_user LIMIT 1) scrims_user ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_ticket_status WHERE scrims_ticket_status.id_status = scrims_ticket.id_status LIMIT 1) scrims_ticket_status ON true 
    LEFT JOIN LATERAL (SELECT * FROM scrims_guild WHERE scrims_guild.id_guild = scrims_ticket.id_guild LIMIT 1) scrims_guild ON true
    WHERE 
    ($1 is null or scrims_ticket.id_ticket = $1) AND
    ($2 is null or scrims_ticket.id_user = $2) AND
    ($3 is null or scrims_ticket.channel_id = $3) AND
    ($4 is null or scrims_ticket.id_guild = $4) AND
    ($5 is null or scrims_ticket.created_at = $5) AND
    ($6 is null or scrims_ticket.id_type = $6) AND
    ($7 is null or scrims_ticket.id_status = $7)
' USING id_ticket, id_user, channel_id, id_guild, created_at, id_type, id_status
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_ticket_change()
RETURNS trigger 
AS $$
DECLARE
    tickets json;
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('ticket_remove', to_json(OLD)::text);
        RETURN OLD;
    END IF;

    EXECUTE 'SELECT get_tickets( id_ticket => $1 )' USING NEW.id_ticket INTO tickets;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'ticket_update', json_build_object(
            'selector', to_json(OLD), 
            'data', (tickets->>0)::json
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('ticket_create', tickets->>0);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;


CREATE TRIGGER ticket_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON scrims_ticket
    FOR EACH ROW
    EXECUTE PROCEDURE process_ticket_change();