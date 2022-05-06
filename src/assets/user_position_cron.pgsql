-- NEEDS https://github.com/citusdata/pg_cron TO BE CONFIGURED 

-- Will run the above function every minute
SELECT cron.schedule('* * * * *', 'SELECT remove_expired_user_positions();');

-- Make sure function is run in the scrims database
UPDATE cron.job SET database='scrims';