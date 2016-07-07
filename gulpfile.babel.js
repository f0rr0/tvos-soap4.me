import gulp from 'gulp';
import gutil from 'gulp-util';

import watch from 'gulp-watch';
import uglify from 'gulp-uglify';
import connect from 'gulp-connect';
import sourcemaps from 'gulp-sourcemaps';

import xtend from 'xtend';
import babelify from 'babelify';
import browserify from 'browserify';
import prettyBytes from 'pretty-bytes';
import incremental from 'browserify-incremental';

import through from 'through2';
import buffer from 'vinyl-buffer';
import source from 'vinyl-source-stream';

const LIVE = process.argv.indexOf('--production') !== -1;

const PORT = 9001;
const DEST = './out';
const SOURCE = './src';
const CACHE = './build.json';

function pass() {
	return through.obj();
}

gulp.task('build', () => {
	let build = browserify(xtend(incremental.args, {
		entries: `${SOURCE}/index.js`,
		debug: true,
	}));

	if (!LIVE) {
		incremental(build, {cacheFile: CACHE});
	}

	return build
		.on('log', (info) => {
			let parts = info.split(/\s*bytes\s*/);
			parts[0] = prettyBytes(+parts[0]);
			gutil.log(gutil.colors.green('Build info:'), parts.join(' '));
		})
		.transform(babelify, {
			global: true,
			ignore: /(lodash)|(pubsub-js)/,
			presets: ['es2015'],
		})
		.bundle()
		.on('error', function(error) {
			gutil.log(gutil.colors.red('Browserify compile error:'), error.message);
			this.emit('end');
		})
		.pipe(source('application.js'))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(LIVE ? uglify() : pass())
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest(DEST))
		.pipe(connect.reload());
});

gulp.task('watch', () => {
	gulp.start('build');
	watch([`${SOURCE}/**/*.js`], () => gulp.start('build'));
});

gulp.task('serve', ['watch'], () => {
	connect.server({
		root: DEST,
		port: PORT,
	});
});

gulp.task('default', ['build']);