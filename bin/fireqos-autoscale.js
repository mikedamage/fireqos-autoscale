#!/usr/bin/env node

const Autoscaler = require('../lib/autoscaler');
const chalk = require('chalk');
const argv = require('yargs')
  .config()
  .help()
  .option('f', {
    alias: 'frequency',
    default: '15m',
    describe: 'Speed test and update frequency',
    type: 'string',
  })
  .option('t', {
    alias: 'template',
    required: true,
    describe: 'Path to FireQOS configuration template file',
    type: 'string',
  })
  .option('o', {
    alias: 'output',
    default: '/usr/local/etc/firehol/fireqos.conf',
    describe: 'FireQOS config file output path',
    type: 'string',
  })
  .option('w', {
    alias: 'window',
    default: 4,
    describe: 'Number of previous results to average in calculating speed limit',
    type: 'number',
  })
  .option('upScale', {
    default: 0.95,
    describe: 'Percentage of available upload bandwidth to use',
    type: 'number',
  })
  .option('downScale', {
    default: 0.85,
    describe: 'Percentage of available download bandwidth to use',
    type: 'number',
  })
  .option('minUp', {
    default: 500,
    describe: 'Minimum upload speed (kbit/s)',
    type: 'number',
  })
  .option('minDown', {
    default: 500,
    describe: 'Minimum download speed (kbit/s)',
    type: 'number',
  }).argv;

const scaler = new Autoscaler({
  debug: true,
  upScale: argv.upScale,
  downScale: argv.downScale,
  minUp: argv.minUp,
  minDown: argv.minDown,
  template: argv.template,
  output: argv.output,
  frequency: argv.frequency,
  averageWindow: argv.window,
});

process.on('SIGINT', () => {
  scaler.stop();
});

scaler.start();
