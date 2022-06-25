const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * @callback AsyncCallback
 * @param { ...any } args
 * @returns { Promise<any> }
 */

class AsyncFunctionBuffer {

    
    constructor(call, cooldown) {

        /**
         * @type { AsyncCallback }
         */
        this.call = call

        this.index = 0
        this.discardMode = (cooldown < 0)
        this.cooldown = Math.abs(cooldown)*1000
        this.lastCall = null

    }

    async __run(...args) {

        if (this.lastCall) {
            const diff = Date.now() - this.lastCall
            if (diff < this.cooldown) await sleep(this.cooldown-diff)
        }

        const result = await this.call(...args).catch(error => error)
        this.index -= 1
        this.lastCall = Date.now()
        return result;

    }

    finishUp(value) {

        if (value instanceof Error) throw value;
        return value;

    }

    async run(...args) {
  
        if (this.index > 0 && this.discardMode) return; 

        this.index += 1
        if (this._running instanceof Promise) {
            this._running = this._running.then(() => this.__run(...args)).catch(() => this.__run(...args)).then(this.finishUp)
        }else {
            this._running = this.__run(...args).then(this.finishUp)
        }
        
        return this._running;

    }


}

module.exports = AsyncFunctionBuffer