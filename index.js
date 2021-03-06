'use strict';
var chalk = require('chalk');
var table = require('text-table');
var hooker = require('hooker');
var dateTime = require('date-time');
var prettyMs = require('pretty-ms');
var numberIsNan = require('number-is-nan');
var barChar = require('figures').square;
var argv = process.argv.slice(2);
var write = process.stdout.write.bind(process.stdout);

function log(str) {
  write(str + '\n', 'utf8');
}

module.exports = function (grunt, verbose, cb) {
  var now = new Date();
  var startTimePretty = dateTime();
  var startTime = now.getTime();
  var prevTime = startTime;
  var prevTaskName = 'loading tasks';
  var tableData = [];

  if (argv.indexOf('--help') !== -1 ||
    argv.indexOf('-h') !== -1 ||
    // for `quiet-grunt`
    argv.indexOf('--quiet') !== -1 ||
    argv.indexOf('-q') !== -1 ||
    argv.indexOf('--version') !== -1 ||
    argv.indexOf('-V') !== -1) {
    return;
  }

  hooker.hook(grunt.log, 'header', function () {
    var name = grunt.task.current.nameArgs;
    var diff = Date.now() - prevTime;

    if (name.indexOf('watch') == 0) {
      spitOutResults();
      now = new Date();
      startTimePretty = dateTime();
      startTime = now.getTime();
      prevTime = startTime;
      prevTaskName = 'loading tasks';
      tableData = [];
      return;
    }

    if (prevTaskName && prevTaskName !== name) {
      tableData.push([prevTaskName, diff]);
    }

    prevTime = Date.now();
    prevTaskName = name;
  });

  function formatTable(tableData) {
    var totalTime = Date.now() - startTime;
    var longestTaskName = tableData.reduce(function (acc, row) {
      var avg = row[1] / totalTime;

      if (avg < 0.01 && !grunt.option('verbose') && !verbose) {
        return acc;
      }

      return Math.max(acc, row[0].length);
    }, 0);

    var maxColumns = process.stdout.columns || 80;
    var maxBarWidth;

    if (longestTaskName > maxColumns / 2) {
      maxBarWidth = (maxColumns - 20) / 2;
    } else {
      maxBarWidth = maxColumns - (longestTaskName + 20);
    }

    function shorten(taskName) {
      var nameLength = taskName.length;

      if (nameLength <= maxBarWidth) {
        return taskName;
      }

      var partLength = Math.floor((maxBarWidth - 3) / 2);
      var start = taskName.substr(0, partLength + 1);
      var end = taskName.substr(nameLength - partLength);

      return start.trim() + '...' + end.trim();
    }

    function createBar(percentage) {
      var rounded = Math.round(percentage * 100);

      if (rounded === 0) {
        return '0%';
      }

      var barLength = Math.ceil(maxBarWidth * percentage) + 1;
      var bar = new Array(barLength).join(barChar);

      return bar + ' ' + rounded + '%';
    }

    var tableDataProcessed = tableData.map(function (row) {
      var avg = row[1] / totalTime;

      if (numberIsNan(avg) ||  (avg < 0.01 && !grunt.option('verbose') && !verbose)) {
        return;
      }

      return [shorten(row[0]), chalk.blue(prettyMs(row[1])), chalk.blue(createBar(avg))];
    }).reduce(function (acc, row) {
      if (row) {
        acc.push(row);
        return acc;
      }

      return acc;
    }, []);

    tableDataProcessed.push([chalk.magenta('Total', prettyMs(totalTime))]);

    return table(tableDataProcessed, {
      align: ['l', 'r', 'l'],
      stringLength: function (str) {
        return chalk.stripColor(str).length;
      }
    });
  }

  process.on('SIGINT', function () {
    process.exit();
  });

  function spitOutResults() {
    // `grunt.log.header` should be unhooked above, but in some cases it's not
    log('\n\n' + chalk.underline('Execution Time') + chalk.gray(' (' + startTimePretty + ')'));
    log(formatTable(tableData) + '\n');
    if (cb) {
      cb(tableData, log);
    }
  }

  process.on('exit', function (exitCode) {
    hooker.unhook(grunt.log, 'header');
    var diff = Date.now() - prevTime;
    if (prevTaskName) {
      tableData.push([prevTaskName, diff]);
    }
    spitOutResults();
  });
};
