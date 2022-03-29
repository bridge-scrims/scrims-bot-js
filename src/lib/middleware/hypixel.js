const sleep = ms => new Promise(r => setTimeout(r, ms));

const FIFOCache = require("./cache");
const got = require('got');

class HypixelAPIError extends Error {

    constructor(message, externalFault, debug) {

        super(message);

        this.externalFault = externalFault
        this.debug = { 'HypixelClient': debug }

    }

}

const BEDWARS_ODD_LEVELS = Object.entries({ 500: 0, 1500: 1, 3500: 2, 7000: 3 })
const BEDWARS_LEVELS_PER_PRESTIGE = 100
const BEDWARS_EXP_PER_PRESTIGE = 487000
const BEDWARS_EXP_PER_LEVEL = 5000

class HypixelClient {

    static server = 'api.hypixel.net';
    static unavailable = false;

    static cache = new FIFOCache({ stdTTL: 3600, checkperiod: 300, maxKeys: 500 });

    static getCachedPlayer(uuid) {

        return this.getCaught(`P${uuid}`);

    }

    static getCaught(cachekey) {

        const cached = this.cache.get(cachekey)
        if (cached) return { ...cached, debug: { Cache: true, CaughtAt: new Date(cached.timestamp) } };
        return null;

    }

    static cacheResult(cachekey, result) {

        this.cache.set(cachekey, { ...result, timestamp: Date.now() })

    }

    constructor(apitoken) {

        this.apitoken = apitoken
        this.throttling = { active: false, reset: 0 }

    }

    throttleTimeRemaining() {

        if (!this.throttling.active) return null;
        return (this.throttling.reset - Date.now());

    }

    buildURL(endpoint, params) {

        params = Object.entries(params).map(([key, value]) => `&${key}=${value}`);
        return `https://${HypixelClient.server}/${endpoint}?key=${this.apitoken}${params}`; 

    }
    
    getBedwarsLevelProgress(exp) {

        exp = exp % BEDWARS_EXP_PER_PRESTIGE
        const lastOddLevel = BEDWARS_ODD_LEVELS.slice(-1)[0]
        const strangeLevel = BEDWARS_ODD_LEVELS.filter(([max, _]) => exp < max).map(([_, level]) => level)[0]
        return strangeLevel ?? Math.floor((exp - lastOddLevel[0]) / BEDWARS_EXP_PER_LEVEL) + lastOddLevel[1]+1;

    }
    
    getBedwarsPrestige(exp) {

        const prestige = Math.floor(exp / BEDWARS_EXP_PER_PRESTIGE)
        return (prestige * BEDWARS_LEVELS_PER_PRESTIGE);

    }

    getBedwarsStats(stats) {

        const bwStats = stats?.player?.stats?.Bedwars ?? {}

        const exp = bwStats["Experience"] ?? 0;
        const prestige = this.getBedwarsPrestige(exp) 
        const progress = this.getBedwarsLevelProgress(exp)

        const wins = bwStats["wins_bedwars"] ?? 0
        const losses = bwStats["losses_bedwars"] ?? 0
        const finalKills = bwStats["final_kills_bedwars"] ?? 0
        const finalDeaths = bwStats["final_deaths_bedwars"] ?? 0

        return { 

            exp, prestige, progress, level: (prestige+progress), 
            wins, losses, wlr: (wins/losses), 
            finalKills, finalDeaths, fkdr: (finalKills/finalDeaths),
            ws: bwStats["winstreak"] ?? 0

        };

    }

    async fetchPlayer(uuid, usecache, wait) {

        const cached = HypixelClient.getCaught(`P${uuid}`)
        const result = (cached && usecache) ? cached : (await this.hypixelRequest('player', { uuid }, wait))

        const body = result.body
        if (!body['success']) throw new HypixelAPIError(
            `Unfortunately something went wrong while contacting the Hypixel API, please try again later.`, 
            false, { ...result.debug, Success: body['success'] || 'None' }
        );

        if (!body["player"]) throw new HypixelAPIError(
            `Player was not found on the Hypixel API. Have they ever logged on Hypixel before?`,
            false, { ...result.debug, Player: body['player'] || 'None' }
        );

        const stats = { body, bedwars: this.getBedwarsStats(body) }
        HypixelClient.cacheResult(`P${uuid}`, stats)
        return { ...stats, debug: result.debug };

    }

    async hypixelRequest(endpoint, params, wait) {

        const url = this.buildURL(endpoint, params)

        if (HypixelClient.unavailable) 
            throw new HypixelAPIError(`Unfortunately the Hypixel API is currently not available, please try again later.`, true, { Unavailable: true });

        if (this.throttling.active && (this.throttleTimeRemaining() < 5*1000 || wait)) 
            return this.runAfterThrottling(() => this.hypixelRequest( ...arguments ));

        if (this.throttling.active) throw new HypixelAPIError(
            `Sadly this application was throttled by the Hypixel API, please try again in a minute.`, true,
            { Throttling: this.throttling.active, ThrottleType: 'Direct', ResetInSeconds: (this.throttleTimeRemaining()/1000) }
        );

        return this.hypixelAPIFetch(url);

    }

    async hypixelAPIFetch(url) {

        return got(url, { 'timeout': 5000, responseType: 'json' }).then((response) => {

            const throttle = ((response.headers['ratelimit-remaining'] < 3) && !this.throttling.active)
            if (throttle) this.enableThrottling(response.headers['ratelimit-reset'] || response.headers['retry-after'])
            const debug = { 
                'RateLimit-Remaining': response.headers['ratelimit-remaining'] || 'None', 
                'RateLimit-Reset': response.headers['ratelimit-reset'] || 'None',
                'Retry-After': response.headers['retry-after'] || 'None', ThrottleActivated: throttle 
            }
            return { body: response.body, debug };

        }).catch(error => this.onError(error));

    }

    async onError(error) {

        const debug = { ErrorType: error.constructor.name, StatusCode: ((error instanceof got.HTTPError) ? error.response.statusCode : 'None') }

        if (error instanceof got.TimeoutError) 
            throw new HypixelAPIError(`Timed out while trying to contact the Hypixel API, please try again later.`, true, debug);

        if (error instanceof got.HTTPError) {
            const code = error.response.statusCode
            if (code === 403) throw new HypixelAPIError(`The Hypixel API denied the given authorization, please try again later.`, true, debug);
            if (code === 429) {
                this.enableThrottling(error.response.headers['ratelimit-reset'] || response.headers['retry-after'])
                throw new HypixelAPIError(
                    `This application was throttled by the Hypixel API, please try again in a minute.`,
                    true, { ...debug, ThrottleActivated: true, ThrottleType: 'Subsequent' }
                );
            }
            throw new HypixelAPIError(`Unable to reach the Hypixel API at the moment, please try again later.`, true, debug);
        } 

        if (!(error instanceof got.RequestError)) 
            console.error(`Unexpected error while making a Hypixel-API fetch!`, true, error.toString())
        
        throw new HypixelAPIError(`Unable to communicate with the Hypixel API at the moment, please try again later.`, true, debug);

    }

    async runAfterThrottling(callback) {

        const timeRemaining = this.throttleTimeRemaining()
        const waitTime = timeRemaining + (Math.random() * 1000)
        await sleep(waitTime)
        if (this.throttling.active) throw new HypixelAPIError(
            `This application was throttled by the Hypixel-API, please try again in a minute.`, true,
            { ThrottleType: 'Unexpected', 'Waited': waitTime/1000, 'Expected': timeRemaining, ThrottleActivated: true }
        );
        return callback();

    }

    async enableThrottling(seconds) {

        this.throttling.active = true
        this.throttling.reset = Date.now() + (seconds*1000)

        await sleep(seconds*1000)

        this.throttling.active = false
        this.throttling.reset = 0

    }
        
}

module.exports = HypixelClient;