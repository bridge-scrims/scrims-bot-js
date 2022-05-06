const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const path = require('path');
const util = require('util');
const fs = require('fs'); 

const LOGGINGPATH = path.join("logs")
const MAXLOGS = 10

function stringifyDate(date) {
    const month = (date.getUTCMonth()+1).toString().padStart(2, '0')
    const day = date.getUTCDate().toString().padStart(2, '0')
    return `${date.getUTCFullYear()}${month}${day}`
}
       
async function removeOld() {
    const files = await fs.promises.readdir(LOGGINGPATH).catch(() => null)
    if (!files) return false;

    const logs = files
        .filter(file => file.endsWith('.log'))
        .map(file => file.slice(0, -4))
        .sort((name1, name2) => name2 - name1)

    while (logs.length > MAXLOGS) {
        const oldFile = logs.pop()
        await fs.promises.rm(path.join(LOGGINGPATH, `${oldFile}.log`))
    }
}

function getTime() {
    const date = new Date()
    const hours = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    const seconds = date.getUTCSeconds().toString().padStart(2, '0')
    return `[${hours}:${minutes}:${seconds}] `;
}

async function rotateLog() {
    const logFile = fs.createWriteStream(path.join(LOGGINGPATH, `${stringifyDate(new Date())}.log`), { flags: 'a' });
    const logStdout = process.stdout;

    console.log = ((...d) => {
        logFile.write(getTime() + util.format(...d) + '\n');
        logStdout.write(getTime() + util.format(...d) + '\n');
    })
    console.error = console.log
    console.warn = console.log
    console.log("------- Log Start -------")

    await removeOld()
}
    

async function rotateLater() {
    const midNight = new Date(Date.now() + 86400000)
    midNight.setUTCHours(0, 0, 0, 0)

    await sleep(midNight.getTime()-Date.now())
    console.log("------- Log End -------")

    await rotateLog().catch(console.error)
    await rotateLater().catch(console.error)
}
    
async function setup() {
    await rotateLog().catch(console.error)
    rotateLater().catch(console.error)
}

module.exports = setup;

