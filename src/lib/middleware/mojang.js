const FIFOCache = require("./cache");
const got = require('got');

class MojangAPIError extends Error {

    constructor(message, externalFault, debug) {

        super(message);

        this.externalFault = externalFault
        this.debug = { 'MojangClient': debug }

    }

}

class MojangClient {

    static alternative = 'api.ashcon.app';
    static server = 'api.mojang.com';
    static unavailable = false;

    static cache = new FIFOCache({ stdTTL: 3600, checkperiod: 300, maxKeys: 500 });

    static async getName(uuid) {

        const response = await got(`https://${this.server}/user/profiles/${uuid}/names`, { 'timeout': 3000, responseType: 'json' })
            .catch(error => this.onError(this.server, error, { uuid }))

        const name = await (async () => response.body.slice(-1)[0]["name"])()
            .catch(error => this.onError(this.server, error, { 'Response body': response.body }));

        this.cache.keys().forEach(key => {
            
            const value = this.cache.get(key)
            if (value?.uuid == uuid) {

                this.cache.del(key)
                value.ign = name
                this.cache.set(key, value)

            }

        })
       
        return { uuid, ign: name };

    }

    static async getUUID(ign, usecache) {
        ign = ign.replace(/\W+/g, "").trim().toLowerCase()

        const getResult = async (ign, usecache) => {
            const caught = this.getCaught(ign)
            if (caught && usecache) return caught;
    
            return this.fetchMojangProfile(ign)
                .catch(error => this.fetchMojangProfileAlternativly(ign)
                        .then(alternativeResult => ({ ...alternativeResult, debug: { ...error.debug, ...alternativeResult.debug } }))
                        .catch(alternativeError => {
                            const mojangError = (alternativeError instanceof MojangAPIError) ? alternativeError : error
                            mojangError.debug = { ...error.debug, ...alternativeError.debug }
                            throw mojangError;
                        })
                )
        }

        const result = await getResult(ign, usecache)
        this.cache.set(ign, { uuid: result?.uuid, ign: result?.ign, timestamp: Date.now() })

        if (!result.uuid || !result.ign)
            throw new MojangAPIError(`A player with the name of **${ign}** could not be found.`, false,  result.debug);
            
        return result;

    }

    static getCaught(ign) {

        const cached = this.cache.get(ign)
        if (cached) return { ...cached, debug: { IGN: cached.ign, UUID: cached.uuid, Cache: true, Caught: new Date(cached.timestamp) } };
        return null;

    }

    static async onError(server, error, additionalDebug={}) {

        const debug = {
            Server: server, ErrorType: error.constructor.name, StatusCode: (error?.response?.statusCode || 'None'),
            Code: (error?.code || 'None'), Reason: (error?.response?.body?.reason || 'None'), ...additionalDebug     
        }

        if (error instanceof got.TimeoutError) 
            throw new MojangAPIError(`The Mojang API is currently not available, please try again later.`, true, debug);
        if (error instanceof got.HTTPError)
            throw new MojangAPIError(`Unable to reach the Mojang API at the moment, please try again later.`, true, debug);

        if (!(error instanceof got.RequestError))
            console.error('Unexpected error while making Mojang API request!', error.toString())

        throw new MojangAPIError(`Unable to communicate with the Mojang API at the moment, please try again later.`, true, debug);

    }

    static onAlternativeError(server, ign, error) {

        if (!(error instanceof got.RequestError))
            console.error('Unexpected error while making alternative Mojang API request!', error.toString())

        const debug = {
            Server: server, ErrorType: error.constructor.name, StatusCode: (error?.response?.statusCode || 'None'),
            Code: (error?.code || 'None'), Reason: (error?.response?.body?.reason || 'None')
        }

        if (error?.response?.statusCode === 404) 
            throw new MojangAPIError(`A player with the name of **${ign}** could not be found.`, false, debug);

        error.debug = debug
        throw error;

    }

    static async fetchMojangProfile(ign) {

        const response = await got(`https://${this.server}/users/profiles/minecraft/${ign}`, { 'timeout': 3000, responseType: 'json' })
            .catch(error => this.onError(this.server, error))

        const debug = { Server: this.server, IGN: ign, StatusCode: response?.statusCode, Name: response?.body["name"], ID: response?.body["id"] }
        return { ign: response?.body?.name, uuid: response?.body?.id, debug };

    }

    static async fetchMojangProfileAlternativly(ign) {

        const response = await got(`https://${this.alternative}/mojang/v2/user/${ign}`, { 'timeout': 3000, responseType: 'json' })
            .catch(error => this.onAlternativeError(this.alternative, ign, error))

        const debug = { 
            AlternativeServer: this.alternative, AlternativeStatusCode: response?.statusCode, 
            Username: response?.body["username"], UUID: response?.body["uuid"]?.replaceAll('-', '')
        } 

        return { ign: response?.body["username"], uuid: response?.body["uuid"]?.replaceAll('-', ''), debug };

    }

}

module.exports = MojangClient;