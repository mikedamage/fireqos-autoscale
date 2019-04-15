const execa = require('execa');

function systemctl(command) {
  return async (...args) => execa('systemctl', [command, ...args]);
}

module.exports = {
  start: systemctl('start'),
  restart: systemctl('restart'),
  stop: systemctl('stop'),
  isActive: systemctl('is-active'),
};
