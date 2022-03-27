CREATE TABLE scrims_ticket (

    id_ticket SERIAL PRIMARY KEY,
    id_user int NOT NULL,

    channel_id text NOT NULL,
    guild_id text NOT NULL,
    created_at bigint NOT NULL,

    FOREIGN KEY(id_user) 
        REFERENCES scrims_user(id_user)

);

CREATE OR REPLACE FUNCTION get_ticket_id(
    id_ticket int default null,
    id_user int default null,
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
    ($5 is null or scrims_ticket.created_at = $5)
' USING id_ticket, id_user, channel_id, guild_id, created_at
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION get_tickets(
    id_ticket int default null,
    id_user int default null,
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
            ''id_user'', scrims_ticket.id_user,
            ''user'', to_json(scrims_user),
            ''channel_id'', scrims_ticket.channel_id,
            ''guild_id'', scrims_ticket.guild_id,
            ''created_at'', scrims_ticket.created_at
        )
    )
    FROM 
    scrims_ticket 
    LEFT JOIN scrims_user ON scrims_user.id_user = scrims_ticket.id_user 

    WHERE 
    ($1 is null or scrims_ticket.id_ticket = $1) AND
    ($2 is null or scrims_ticket.id_user = $2) AND
    ($3 is null or scrims_ticket.channel_id = $3) AND
    ($4 is null or scrims_ticket.guild_id = $4) AND
    ($5 is null or scrims_ticket.created_at = $5)
' USING id_ticket, id_user, channel_id, guild_id, created_at
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;