const TableRow = require("../postgresql/row");

class ScrimsPosition extends TableRow {

    static sortByLevel(a, b) {
        const getWorth = (e) => (((e.level ?? undefined) < 100) ? e.level : (e.name.length*1000));
        return (getWorth(a) - getWorth(b)) || (a.id_position - b.id_position);
    }

    static uniqueKeys = ['id_position']
    static columns = ['id_position', 'name', 'sticky', 'level']
    static ranks = ['prime', 'private', 'premium']

    constructor(client, positionData) {

        super(client, positionData);

        /** @type {number} */
        this.id_position

        /** @type {string} */
        this.name

        /** @type {boolean} */
        this.sticky

        /** @type {number|null} */
        this.level

    }
    
    get managed() {

        return this.name === "banned";
        
    }

    get dontLog() {

        return false;

    }

    hasLevel() {

        return (typeof this.level === "number");

    }

    /**
     * @param {string} name 
     */
    setName(name) {
        
        this.name = name
        return this;

    }

    /**
     * @param {boolean} sticky 
     */
    setSticky(sticky) {
        
        this.sticky = sticky
        return this;

    }

    /**
     * @param {number} level 
     */
    setLevel(level) {

        this.level = level
        return this;

    }

    getConnectedRoles(guild_id) {

        return this.client.positionRoles.cache.get({ id_position: this.id_position, guild_id }).map(posRole => posRole.role).filter(v => v);

    }

    isRank() {

        return ScrimsPosition.ranks.includes(this.name);

    }

    isRankLevel(name) {

        const idxa = ScrimsPosition.ranks.indexOf(this.name)
        const idxb = ScrimsPosition.ranks.indexOf(name)
        return !(idxa === -1 || idxb === -1) && (idxa >= idxb);

    }

    get capitalizedName() {

        return this.name && this.name[0].toUpperCase() + this.name.slice(1);

    }

    getPositionLevelPositions() {

       if (!this.hasLevel()) return [ this ];
       return this.client.positions.cache.filter(pos => pos.hasLevel() && (pos.level <= this.level));

    }

}

module.exports = ScrimsPosition;