
CREATE TABLE scrims_position_role (
    id_position INT NOT NULL,
    id_role text NOT NULL,
    id_guild text NOT NULL,

    FOREIGN KEY(id_position) 
    REFERENCES scrims_position(id_position)
);

/* Bridge Scrims Server */
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'developer'), '904492690043990046', '759894401957888031');
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'support'), '834247683484024893', '759894401957888031');
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'staff'), '913083965215227925', '759894401957888031');
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'owner'), '760148398857912380', '759894401957888031');

/* Bridge Scrims Test Server */
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'developer'), '911778679141597185', '911760601926217819');
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'support'), '913084031191633920', '911760601926217819');
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'staff'), '913083965215227925', '911760601926217819');

/* Other Test Server */
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'bridge_scrims_member'), '936942269423038556', '936349840223371305');
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'developer'), '954375653493465129', '936349840223371305');
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'support'), '954375761119285298', '936349840223371305');
INSERT INTO scrims_position_role VALUES (get_position_id( name => 'staff'), '954375559314567272', '936349840223371305');


CREATE OR REPLACE FUNCTION get_position_roles(
    id_position int default null,
    id_role text default null,
    id_guild text default null
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
            ''id_position'', scrims_position_role.id_position,
            ''position'', to_json(position), 
            ''id_role'', scrims_position_role.id_role,
            ''id_guild'', scrims_position_role.id_guild
        )
    )
    FROM 
    scrims_position_role 
    LEFT JOIN scrims_position position ON position.id_position = scrims_position_role.id_position
    WHERE 
    ($1 is null or scrims_position_role.id_position = $1) AND
    ($2 is null or scrims_position_role.id_role = $2) AND
    ($3 is null or scrims_position_role.id_guild = $3)
' USING id_position, id_role, id_guild
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION process_position_role_change()
RETURNS trigger 
AS $$
DECLARE
    position_roles json;
BEGIN

    IF (TG_OP = 'DELETE') THEN 
        PERFORM pg_notify('position_role_remove', row_to_json(OLD)::text);
        RETURN OLD;
    END IF;

    EXECUTE 'SELECT get_position_roles( id_position => $1, id_role => $2, id_guild => $3 )'
    USING NEW.id_position, NEW.id_role, NEW.id_guild
    INTO position_roles;

    IF (TG_OP = 'UPDATE') THEN PERFORM pg_notify(
        'position_role_update', json_build_object(
            'selector', row_to_json(OLD), 
            'data', (position_roles->>0)::json
        )::text
    );
    ELSEIF (TG_OP = 'INSERT') THEN PERFORM pg_notify('position_role_create', position_roles->>0);
    END IF;

    return NEW;

END $$
LANGUAGE plpgsql;


CREATE TRIGGER position_role_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON scrims_position_role
    FOR EACH ROW
    EXECUTE PROCEDURE process_position_role_change();