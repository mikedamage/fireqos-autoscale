#!/usr/bin/env node

const { createReadStream, appendFile } = require('fs');
const path = require('path');
const chalk = require('chalk');
const argv = require('yargs')
  .config()
  .help()
  .option('f', {
    alias: 'frequency',
    default: '30m',
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
  .option('u', {
    alias: 'up-scale',
    default: 0.95,
    describe: 'Percentage of available upload bandwidth to use',
    type: 'number',
  })
  .option('d', {
    alias: 'down-scale',
    default: 0.85,
    describe: 'Percentage of available download bandwidth to use',
    type: 'number',
  })
  .option('l', {
    alias: 'history-log',
    describe: 'Path to file used to store past speed test results',
    type: 'string',
  }).argv;
