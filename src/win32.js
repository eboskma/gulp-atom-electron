'use strict';

var fs = require('fs');
var path = require('path');
var es = require('event-stream');
var rename = require('gulp-rename');
var temp = require('temp').track();
var rcedit = require('rcedit');
var util = require('./util');

exports.getAppPath = function(opts) {
	return 'resources/app';
};

function patchExecutable(opts) {
	var regexp = /^resources\/default_app/;
	return es.through(function (f) {
		if (f.relative !== 'atom.exe' || process.platform !== 'win32') {
			this.emit('data', f);
			return;
		}

		var that = this;
		var patch = {
			'version-string': {
				CompanyName: opts.companyName || 'GitHub, Inc.',
				FileDescription: opts.productName,
				LegalCopyright: opts.copyright || 'Copyright (C) 2014 GitHub, Inc. All rights reserved',
				ProductName: opts.productName,
				ProductVersion: opts.productVersion
			}
		};

		if (opts.winIcon) {
			patch.icon = opts.winIcon;
		}

		var tempPath = temp.path();

		fs.writeFile(tempPath, f.contents, function (err) {
			if (err) { return that.emit('error', err); }

			rcedit(tempPath, patch, function (err) {
				if (err) { return that.emit('error', err); }

				fs.readFile(tempPath, function (err, data) {
					if (err) { return that.emit('error', err); }

					f.contents = data;

					fs.unlink(tempPath, function (err) {
						if (err) { return that.emit('error', err); }
						
						that.emit('data', f);
					})
				});
			});
		});
	});
}

function removeDefaultApp() {
	var defaultAppPath = path.join('resources', 'default_app');

	return es.through(function (f) {
		if (!util.startsWith(f.relative, defaultAppPath)) {
			this.emit('data', f);
		}
	});
}

function renameApp(opts) {
	return rename(function (path) {
		if (path.dirname === '.' && path.basename === 'atom' && path.extname === '.exe') {
			path.basename = opts.productName;
		}
	});
}

exports.patch = function(opts) {
	var pass = es.through();

	var src = pass
		.pipe(removeDefaultApp())
		.pipe(patchExecutable(opts))
		.pipe(renameApp(opts));

	return es.duplex(pass, src);
};
