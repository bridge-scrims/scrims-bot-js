-- NEEDS https://github.com/citusdata/pg_cron TO BE CONFIGURED 

-- Will run the above function every minute
SELECT cron.schedule('* * * * *', 'SELECT remove_expired_user_positions();');

-- Make sure function is run in the scrims database
<<<<<<< HEAD
UPDATE cron.job SET database='scrims';
=======
UPDATE TABLE cron.job SET database='scrims' WHERE command='SELECT remove_expired_user_positions();';
>>>>>>> main
