
CREATE TABLE IF NOT EXISTS pending_user_merge (

    FOREIGN KEY(id_to_link) REFERENCES (scrims_user) PRIMARY KEY,
    code int NOT NULL UNIQUE, /* bucky barr */
    expires_at bigint NOT NULL

);


CREATE OR REPLACE FUNCTION remove_expired_pending_merges() 
RETURNS VOID
AS $$ 
DECLARE 
    expired_link pending_user_merge;
BEGIN

FOR expired_link IN
        DELETE FROM pending_user_merge WHERE (NOT (expires_at is null)) AND is_expired(expires_at) RETURNING *
    LOOP
        PERFORM pg_notify('pending_user_merge_expire', to_json(expired_link)::text);
    END LOOP;

END $$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_pending_user_merge (

    id_to_link uuid NULL,
    code int NULL

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
            ''to_link'', to_json(to_link),
            ''id_to_link'', pending_user_link.id_to_link,
            ''code'', pending_user_merge.code,
            ''expires_at'', pending_user_merge.expires_at
        )
    )
    LEFT JOIN LATERAL (SELECT * FROM scrims_user WHERE scrims_user.id_user = pending_user_merge.id_to_link LIMIT 1) to_link ON true
    FROM 
    pending_user_merge
    WHERE 
    ($1 is null or pending_user_merge.id_to_link = $1) AND
    ($2 is null or pending_user_merge.code = $2)
' USING id_to_link, code
INTO retval;
RETURN COALESCE(retval, '[]'::json);
END $$ 
LANGUAGE plpgsql;
