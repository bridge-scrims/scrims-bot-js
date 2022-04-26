-- NEEDS https://github.com/citusdata/pg_cron TO BE CONFIGURED 

CREATE OR REPLACE FUNCTION remove_expired_user_positions() 
RETURNS VOID
AS $$ BEGIN

DELETE FROM scrims_user_position WHERE (NOT (scrims_user_position.expires_at is null)) AND is_expired(scrims_user_position.expires_at);

END $$
LANGUAGE plpgsql;

-- Will run the above function every minute
SELECT cron.schedule('* * * * *', 'SELECT remove_expired_user_positions();');

-- Make sure function is run in the scrims database
UPDATE TABLE cron.job SET database='scrims';