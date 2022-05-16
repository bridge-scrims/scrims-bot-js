const { Client } = require('pg');
const fs = require('fs/promises');
const path = require('path');

const ASSETS = path.join('src', 'assets')
const config = require("./config.json").dbLogin;

async function addCronStuff() {

    const client = new Client({

        user: config.username,
        password: config.password,
        host: config.hostname,
        port: config.port,
        database: "postgres"

    })

    await client.connect()

    client.on('error', error => console.error(`Unexpected pgsql error ${error}!`))

    const querys = []

    querys.push('DELETE FROM cron.job;')
    querys.push(await fs.readFile(path.join(ASSETS, 'user_position_cron.pgsql'), { encoding: 'utf8' }))
    querys.push(await fs.readFile(path.join(ASSETS, 'ticket_cron.pgsql'), { encoding: 'utf8' }))

    for (let query of querys) {

        await client.query(query).catch(console.error)

    }

    await client.end()

}

async function create() {

    const client = new Client({

        user: config.username,
        password: config.password,
        host: config.hostname,
        port: config.port,
        database: config.database

    })

    await client.connect()
    
    client.on('error', error => console.error(`Unexpected pgsql error ${error}!`))

    const querys = []

    querys.push(await fs.readFile(path.join(ASSETS, 'attachment_table.pgsql'), { encoding: 'utf8' }))
    querys.push(await fs.readFile(path.join(ASSETS, 'user_table.pgsql'), { encoding: 'utf8' }))
    querys.push(await fs.readFile(path.join(ASSETS, 'guild_table.pgsql'), { encoding: 'utf8' }))
    querys.push(await fs.readFile(path.join(ASSETS, 'position_table.pgsql'), { encoding: 'utf8' }))

    querys.push(await fs.readFile(path.join(ASSETS, 'user_position_table.pgsql'), { encoding: 'utf8' }))
    querys.push(await fs.readFile(path.join(ASSETS, 'position_role_table.pgsql'), { encoding: 'utf8' }))
    querys.push(await fs.readFile(path.join(ASSETS, 'suggestion_table.pgsql'), { encoding: 'utf8' }))
    
    querys.push(await fs.readFile(path.join(ASSETS, 'ticket_table.pgsql'), { encoding: 'utf8' }))
    querys.push(await fs.readFile(path.join(ASSETS, 'transcript_table.pgsql'), { encoding: 'utf8' }))
    querys.push(await fs.readFile(path.join(ASSETS, 'session_table.pgsql'), { encoding: 'utf8' }))

    for (let query of querys) {

        await client.query(query).catch(console.error)

    }

    await client.end()
    await addCronStuff()

}

module.exports = create;