CREATE TABLE IF NOT EXISTS scrims_session_type (
 
    id_type SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE

);

DO
$$
BEGIN
    if NOT EXISTS (select * FROM scrims_session_type WHERE name = 'prime_council_vouch_duels') THEN
        INSERT INTO scrims_session_type (name) VALUES ('prime_council_vouch_duels');
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION get_session_type_id (

    id_type bigint default null,
    name text default null

) 
RETURNS bigint 
AS $$
DECLARE
    retval bigint;
BEGIN
EXECUTE '
    SELECT scrims_session_type.id_type FROM scrims_session_type WHERE 
    ($1 is null or scrims_session_type.id_type = $1) AND
    ($2 is null or scrims_session_type.name = $2)
' USING id_type, name
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS scrims_session (
 
    id_session uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    id_type bigint NOT NULL,

    id_creator uuid NULL,
    started_at bigint NOT NULL,

    FOREIGN KEY (id_type) REFERENCES scrims_session_type(id_type),
    FOREIGN KEY (id_creator) REFERENCES scrims_user(id_user)

);

CREATE OR REPLACE FUNCTION get_session_id (

    id_session uuid default null,
    id_type bigint default null,
    id_creator uuid default null,
    started_at bigint default null

) 
RETURNS bigint 
AS $$
DECLARE
    retval bigint;
BEGIN
EXECUTE '
    SELECT scrims_session.id_session FROM scrims_session WHERE 
    ($1 is null or scrims_session.id_session = $1) AND
    ($2 is null or scrims_session.id_type = $2) AND
    ($3 is null or scrims_session.id_creator = $3) AND
    ($4 is null or scrims_session.started_at = $4) 
' USING id_session, id_type, id_creator, started_at
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_sessions (

    id_session uuid default null,
    id_type bigint default null,
    id_creator uuid default null,
    started_at bigint default null

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
                ''id_session'', scrims_session.id_session,

                ''id_type'', scrims_session.id_type,
                ''type'', to_json(session_type),

                ''id_creator'', scrims_session.id_creator,
                ''creator'', to_json(creator_user),

                ''started_at'', scrims_session.started_at
            )
        )
    FROM 
    scrims_session
    LEFT JOIN LATERAL (SELECT * FROM scrims_session_type WHERE scrims_session_type.id_type = scrims_session.id_type LIMIT 1) session_type ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_user WHERE scrims_user.id_user = scrims_session.id_creator LIMIT 1) creator_user ON true
    WHERE 
    ($1 is null or scrims_session.id_session = $1) AND
    ($2 is null or scrims_session.id_type = $2) AND
    ($3 is null or scrims_session.id_creator = $3) AND
    ($4 is null or scrims_session.started_at = $4) 
' USING id_session, id_type, id_creator, started_at
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS scrims_session_participant (
 
    id_session uuid,
    id_user uuid,

    joined_at bigint NOT NULL,
    participation_time bigint NOT NULL,

    PRIMARY KEY (id_session, id_user),
    FOREIGN KEY (id_session) REFERENCES scrims_session(id_session),
    FOREIGN KEY (id_user) REFERENCES scrims_user(id_user)

);

CREATE OR REPLACE FUNCTION get_session_participants (

    id_session uuid default null,
    id_user uuid default null,
    joined_at bigint default null,
    participation_time bigint default null

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
                ''id_session'', scrims_session_participant.id_session,
                ''session'', sessions->>0,

                ''id_user'', scrims_session_participant.id_user,
                ''user'', to_json(scrims_user),

                ''joined_at'', scrims_session_participant.joined_at,
                ''participation_time'', scrims_session_participant.participation_time
            )
        )
    FROM 
    scrims_session_participant
    LEFT JOIN LATERAL get_sessions(id_session => scrims_session_participant.id_session) sessions ON true
    LEFT JOIN LATERAL (SELECT * FROM scrims_user WHERE scrims_user.id_user = scrims_session_participant.id_user LIMIT 1) scrims_user ON true
    WHERE 
    ($1 is null or scrims_session_participant.id_session = $1) AND
    ($2 is null or scrims_session_participant.id_user = $2) AND
    ($3 is null or scrims_session_participant.joined_at = $3) AND
    ($4 is null or scrims_session_participant.participation_time = $4) 
' USING id_session, id_user, joined_at, participation_time
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;