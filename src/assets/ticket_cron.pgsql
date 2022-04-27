-- NEEDS https://github.com/citusdata/pg_cron TO BE CONFIGURED 

CREATE OR REPLACE FUNCTION remove_expired_tickets() 
RETURNS VOID
AS $$ BEGIN

DELETE FROM scrims_ticket WHERE is_expired(scrims_ticket.created_at+2629800);

END $$
LANGUAGE plpgsql;

-- Will run the above function every minute
SELECT cron.schedule('* * * * *', 'SELECT remove_expired_tickets();');

-- Make sure function is run in the scrims database
UPDATE TABLE cron.job SET database='scrims';