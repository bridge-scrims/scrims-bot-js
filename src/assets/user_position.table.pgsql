
CREATE TABLE scrims_user_position (
    id_user INT NOT NULL,
    id_position INT NOT NULL,

    id_executor INT NULL,
    given_at BIGINT NOT NULL,

    UNIQUE(id_user, id_position),
    FOREIGN KEY(id_user) 
        REFERENCES scrims_user(id_user),
    FOREIGN KEY(id_executor) 
        REFERENCES scrims_user(id_user),
    FOREIGN KEY(id_position) 
        REFERENCES scrims_position(id_position)
);



CREATE OR REPLACE FUNCTION get_user_positions(
    id_user int default null,
    id_position int default null,
    id_executor int default null,
    given_at bigint default null
) 
RETURNS json
AS $$
DECLARE
    retval json;
BEGIN
EXECUTE '
    SELECT
        json_agg(
            json_build_object(
                ''user'', to_json(scrims_user), 
                ''executor'', to_json(executor),
                ''position'', to_json(position),
                ''given_at'', scrims_user_position.given_at,
                ''id_user'', scrims_user_position.id_user,
                ''id_executor'', scrims_user_position.id_executor,
                ''id_position'', scrims_user_position.id_position
            )
        )
    FROM 
    scrims_user_position 
    LEFT JOIN scrims_user scrims_user ON scrims_user.id_user = scrims_user_position.id_user 
    LEFT JOIN scrims_user executor ON executor.id_user = scrims_user_position.id_executor 
    LEFT JOIN scrims_position position ON position.id_position = scrims_user_position.id_position

    WHERE 
    ($1 is null or scrims_user_position.id_user = $1) AND
    ($2 is null or scrims_user_position.id_executor = $2) AND
    ($3 is null or scrims_user_position.id_position = $3) AND
    ($4 is null or scrims_user_position.given_at = $4)
' USING id_user, id_executor, id_position, given_at
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION process_user_position_change()
RETURNS trigger 
AS $$
DECLARE
    user_positions json;
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('user_position_remove', json_build_object('id_user', OLD.id_user, 'id_position', OLD.id_position)::text);
        RETURN OLD;
    END IF;

    EXECUTE 'SELECT get_user_positions( id_user => $1, id_position => $2, id_executor => $3, given_at => $4 )'
    USING NEW.id_user, NEW.id_position, NEW.id_executor, NEW.given_at
    INTO user_positions;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'user_position_update', json_build_object(
            'selector', json_build_object('id_user', OLD.id_user, 'id_position', OLD.id_position), 
            'data', (user_positions->>0)::json
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('user_position_create', user_positions->>0);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;


CREATE TRIGGER user_position_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON scrims_user_position
    FOR EACH ROW
    EXECUTE PROCEDURE process_user_position_change();