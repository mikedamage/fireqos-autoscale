class History {
  static get defaults() {
    return {
      maxEntries: 48,
      averageWindow: 4,
    };
  }

  constructor(options = {}) {
    this.entries = [];
    this.options = Object.assign({}, this.constructor.defaults, options);
  }

  record(entry) {
    const length = this.entries.push(entry);

    if (length > this.options.maxEntries) {
      const diff = length - this.options.maxEntries;
      this.entries = this.entries.slice(diff);
    }

    return this.averageLast(this.options.averageWindow);
  }

  averageLast(numEntries = this.options.averageWindow) {
    const entries = this.entries.slice(-this.options.averageWindow);
    return this._average(entries);
  }

  _average(nums) {
    return nums.reduce((sum, num) => sum + num, 0) / nums.length;
  }
}

module.exports = History;
