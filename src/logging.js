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
    return `[${date.toISOString()}]`;
}

async function rotateLog() {
    const logFile = fs.createWriteStream(path.join(LOGGINGPATH, `${stringifyDate(new Date())}.log`), { flags: 'a' });
    const log = console.log
    const error = console.error
    const warn = console.warn

    console.log = ((...d) => {
        log.apply(console, [getTime()].concat(d))
        logFile.write(getTime() + " " + util.format(...d) + '\n');
    })

    console.error = ((...d) => {
        error.apply(console, [getTime()].concat(d))
        logFile.write(getTime() + " " + util.format(...d) + '\n');
    })

    console.warn = ((...d) => {
        warn.apply(console, [getTime()].concat(d))
        logFile.write(getTime() + " " + util.format(...d) + '\n');
    })

    logFile.write("------- Log Start -------\n");
    await removeOld()
}
    

async function rotateLater() {
    const midNight = new Date(Date.now() + 86400000)
    midNight.setUTCHours(0, 0, 0, 0)

    await sleep(midNight.getTime()-Date.now())
    console.log("Rotating log...")

    await rotateLog().catch(console.error)
    await rotateLater().catch(console.error)
}
    
async function setup() {
    if (!fs.existsSync(LOGGINGPATH)) fs.mkdirSync(LOGGINGPATH)
    await rotateLog().catch(console.error)
    rotateLater().catch(console.error)
}

module.exports = setup;

