const {
  promises: { readFile, writeFile },
} = require('fs');
const path = require('path');
const EventEmitter = require('events');
const parseTime = require('timestring');
const speedtest = require('speedtest-net');
const Handlebars = require('handlebars');
const execa = require('execa');
const History = require('./history');
const systemctl = require('./systemctl');

class Autoscaler extends EventEmitter {
  static get minFrequency() {
    return parseTime('1m', 'ms');
  }

  static get defaults() {
    return {
      upScale: 0.95,
      downScale: 0.85,
      template: null,
      output: null,
      averageLast: 4,
      frequency: parseTime('30m', 'ms'),
      testTimeout: parseTime('10s', 'ms'),
    };
  }

  constructor(options = {}) {
    super();
    this.options = Object.assign({}, this.constructor.defaults, options);
    this.history = {
      up: new History({ averageLast: this.options.averageLast }),
      down: new History({ averageLast: this.options.averageLast }),
    };
    this.timer = null;
    this._validateOptions();
  }

  get running() {
    return this.timer > 0;
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

  async start() {
    if (this.running) return;
    this.emit('start');
    await this.autoscale();
    this.timer = setInterval(this.autoscale.bind(this), this.options.frequency);
  }

  stop() {
    if (!this.running) return;
    this.emit('stop');
    clearInterval(this.timer);
    this.timer = null;
  }

  async autoscale() {
    this.emit('autoscale');

    const { originalDownload, originalUpload } = await this.testSpeed();
    const upLimit = (this.history.up.record(originalUpload) * this.options.upScale) / 1000;
    const downLimit = (this.history.down.record(originalDownload) * this.options.downScale) / 1000;
    const context = {
      upLimitRaw: upLimit,
      downLimitRaw: downLimit,
      upLimit: `${Math.round(upLimit)}kbit`,
      downLimit: `${Math.round(downLimit)}kbit`,
      timestamp: new Date().toString(),
      templatePath: this.options.template,
      output: this.options.output,
    };
    const template = await this._compileTemplate();
    const result = template(context);

    this.emit('writeFile', context);
    await writeFile(this.options.output, result);
    await this.restartFireQOS();
  }

  restartFireQOS() {
    return systemctl.restart('fireqos');
  }

  async serviceRunning() {
    const { stdout } = await systemctl.isActive('fireqos');
    return stdout === 'active';
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
