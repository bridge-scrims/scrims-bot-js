
class DBCache extends Array {

    remove(filter) {

        const remove = this.get(filter)
        remove.forEach(obj => delete this[this.indexOf(obj)])
        return remove;

    }

    valuesMatch(obj1, obj2) {

        if (!obj1 || !obj2) return false;
        return Object.entries(obj1).every(([key, value]) => (value instanceof Object) ? this.valuesMatch(value, obj2[key]) : (obj2[key] == value));

    }

    get(filter) {

        return this.filter(obj => this.valuesMatch(filter, obj));

    }

    set(values) {

        values.forEach(value => this.push(value))

    }

    update(data, filter) {

        const idx = this.indexOf(this.get(filter)[0])
        if (idx === -1) return false;
        
        this[idx] = { ...this[idx], ...data }
        return true;

    }

    push(value) {

        if (value === null) return null;

        const idx = this.indexOf(this.get({ ...value })[0])
        if (idx == -1) super.push(value);
        else this[idx] = value;

        return value;

    }

}

module.exports = DBCache;