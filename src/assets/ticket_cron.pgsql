-- NEEDS https://github.com/citusdata/pg_cron TO BE CONFIGURED 

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM cron.job WHERE command='SELECT remove_expired_tickets();') THEN
        PERFORM cron.schedule('* * * * *', 'SELECT remove_expired_tickets();');
    END IF;
END $$;

-- Make sure function is run in the scrims database
UPDATE cron.job SET database='scrims' WHERE command='SELECT remove_expired_tickets();';