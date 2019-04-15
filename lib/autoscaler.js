const {
  promises: { readFile, appendFile },
} = require('fs');
const path = require('path');
const EventEmitter = require('events');
const parseTime = require('timestring');
const speedtest = require('speedtest-net');
const Handlebars = require('handlebars');

// TODO: Figure out how to prevent extreme dips in speed from a single bad test result. Weighted averages?

class Autoscaler extends EventEmitter {
  static get minFrequency() {
    return parseTime('1m', 'ms');
  }

  static get defaults() {
    return {
      upScale: 0.95,
      downScale: 0.85,
      historyLog: null,
      template: null,
      output: null,
      frequency: parseTime('30m', 'ms'),
      testTimeout: parseTime('10s', 'ms'),
    };
  }

  constructor(options = {}) {
    super();
    this.options = Object.assign({}, this.constructor.defaults, options);

    this._validateOptions();
  }

  testSpeed() {
    this.emit('testStart');

    return new Promise((resolve, reject) => {
      const test = speedtest({ maxTime: this.options.testTimeout });

      test.on('error', (err) => {
        this.emit('testError', err);
        reject(err);
      });

      test.on('data', ({ speeds }) => {
        this.emit('testEnd', speeds);
        resolve(speeds);
      });
    });
  }

  async run() {
    const { originalDownload, originalUpload } = await this.testSpeed();
    const upLimit = (originalUpload * this.options.upScale) / 1000;
    const downLimit = (originalDownload * this.options.downScale) / 1000;
    const context = {
      upLimit: `${Math.round(upLimit)}kbit`,
      downLimit: `${Math.round(downLimit)}kbit`,
      timestamp: new Date().toString(),
      templatePath: this.options.template,
    };
    const template = await this._compileTemplate();
    const result = template(context);

    console.log(`Down: ${originalDownload}, Up: ${originalUpload}`);
  }

  _validateOptions() {
    const errors = [];

    if (!this.options.template) errors.push('template is required');
    if (this.options.frequency < this.constructor.minFrequency)
      errors.push(`Frequency must be ${this.constructor.minFrequency} or greater`);

    if (!errors.length) return;
    throw new Error(errors.join('\n'));
  }

  async _compileTemplate() {
    return Handlebars.compile(await readFile(this.options.template, 'utf8'));
  }
}

module.exports = Autoscaler;
