const {
  promises: { readFile, writeFile },
} = require('fs');
const EventEmitter = require('events');
const parseTime = require('timestring');
const speedtest = require('speedtest-net');
const Handlebars = require('handlebars');
const execa = require('execa');
const log = require('fancy-log');
const History = require('./history');
const systemctl = require('./systemctl');

class Autoscaler extends EventEmitter {
  static get minFrequency() {
    return parseTime('1m', 'ms');
  }

  static get defaults() {
    return {
      debug: false,
      upScale: 0.95,
      downScale: 0.85,
      minUp: 500, // kbits/sec
      minDown: 500,
      template: null,
      output: null,
      averageWindow: 4,
      frequency: '15m',
      testTimeout: '5s',
    };
  }

  constructor(options = {}) {
    super();
    this.options = Object.assign({}, this.constructor.defaults, options);
    this.history = {
      up: new History({ averageWindow: this.options.averageWindow }),
      down: new History({ averageWindow: this.options.averageWindow }),
    };
    this.frequency = this._parseTime(this.options.frequency);
    this.testTimeout = this._parseTime(this.options.testTimeout);
    this.timer = null;
    this._validateOptions();
  }

  get debug() {
    if (!this.options.debug) return { log: () => {}, dir: () => {} };
    return log;
  }

  get running() {
    return this.timer > 0;
  }

  get calculateLimit() {
    return {
      up: (speed) => Math.max(this.history.up.record(speed * 1000) * this.options.upScale, this.options.minUp),
      down: (speed) => Math.max(this.history.down.record(speed * 1000) * this.options.downScale, this.options.minDown),
    };
  }

  testSpeed() {
    this.emit('testStart');
    this.debug('Beginning speed test');

    return new Promise((resolve, reject) => {
      const test = speedtest({ maxTime: this.testTimeout });

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

  start() {
    if (this.running) return;
    this.emit('start');
    this.debug('Starting autoscale interval');
    this.autoscale();
    this.timer = setInterval(this.autoscale.bind(this), this.frequency);
  }

  stop() {
    if (!this.running) return;
    this.emit('stop');
    this.debug('Stopping autoscale interval');
    clearInterval(this.timer);
    this.timer = null;
  }

  async autoscale() {
    this.emit('autoscale');
    this.debug('Beginning autoscale run');

    await this.stopFireQOS();

    const { download, upload } = await this.testSpeed();
    const upLimit = this.calculateLimit.up(upload);
    const downLimit = this.calculateLimit.down(download);

    this.debug(`Speed test complete. Down limit: ${downLimit}, Up limit: ${upLimit}`);

    const context = {
      upLimitRaw: upLimit,
      downLimitRaw: downLimit,
      upLimit: `${Math.round(upLimit)}kbit`,
      downLimit: `${Math.round(downLimit)}kbit`,
      timestamp: new Date().toString(),
      templatePath: this.options.template,
      output: this.options.output,
    };

    this.debug.dir(context);

    const template = await this._compileTemplate();
    const result = template(context);

    this.emit('writeFile', context);
    await this.writeConfig(result);
    await this.startFireQOS();
  }

  async writeConfig(contents) {
    this.debug(`Saving config file: ${this.options.output}`);
    return writeFile(this.options.output, contents);
  }

  async startFireQOS() {
    this.debug('Starting FireQOS');
    return systemctl.start('fireqos');
  }

  async stopFireQOS() {
    this.debug('Stopping FireQOS');
    return systemctl.stop('fireqos');
  }

  async serviceRunning() {
    const { stdout } = await systemctl.isActive('fireqos');
    return stdout === 'active';
  }

  _validateOptions() {
    const errors = [];

    if (!this.options.template) errors.push('template is required');
    if (this.frequency < this.constructor.minFrequency)
      errors.push(`Frequency must be ${this.constructor.minFrequency} or greater`);

    if (!errors.length) return;
    throw new Error(errors.join('\n'));
  }

  _parseTime(time) {
    if (typeof time === 'number') return time;
    return parseTime(time, 'ms');
  }

  async _compileTemplate() {
    return Handlebars.compile(await readFile(this.options.template, 'utf8'));
  }
}

module.exports = Autoscaler;
