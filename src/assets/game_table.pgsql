
CREATE TABLE IF NOT EXISTS scrims_game_type (
    id_type SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

DO $$
BEGIN
    if NOT EXISTS (select * FROM scrims_game_type WHERE name = 'prime_vouch_duel') THEN
        INSERT INTO scrims_game_type (name) VALUES ('prime_vouch_duel');
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION get_game_type_id (
    id_type bigint default null,
    name text default null
) 
RETURNS bigint 
AS $$
DECLARE
    retval bigint;
BEGIN
EXECUTE '
    SELECT scrims_game_type.id_type FROM scrims_game_type WHERE 
    ($1 is null or scrims_game_type.id_type = $1) AND
    ($2 is null or scrims_game_type.name = $2)
' USING id_type, name
INTO retval;
RETURN retval;
END $$ 
LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS scrims_game (
    id_game bigint PRIMARY KEY,
    id_type bigint NOT NULL,
    FOREIGN KEY (id_type) REFERENCES scrims_game_type(id_type)
);

CREATE TABLE IF NOT EXISTS scrims_game_participant (
    id_game bigint NOT NULL,
    id_user uuid NOT NULL,
    id_team int NOT NULL,
    PRIMARY KEY (id_game, id_user, id_team),
    FOREIGN KEY (id_game) REFERENCES scrims_game(id_game),
    FOREIGN KEY (id_user) REFERENCES scrims_user(id_user)
);