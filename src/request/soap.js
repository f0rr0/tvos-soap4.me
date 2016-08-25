import md5 from 'blueimp-md5';

import {get as getToken} from '../token';
import * as request from '../request';

function addHeaders(headers) {
	return (XHR) => {
		Object
			.keys(headers)
			.forEach(key => XHR.setRequestHeader(key, headers[key]));
		return XHR;
	}
}

export function get(url) {
	return request
		.get(url, {prepare: addHeaders(headers())})
		.then(request.toJSON());
}

export function post(url, parameters) {
	return request
		.post(url, parameters, {prepare: addHeaders(headers())})
		.then(request.toJSON());
}

export function getMyTVShows() {
	return get('https://soap4.me/api/soap/my/');
}

export function getAllTVShows() {
	return get('https://soap4.me/api/soap/');
}

export function getTVShow(sid) {
	return getAllTVShows().then(series => {
		let tvshow = null;

		series.some(item => {
			if (item.sid === sid) {
				tvshow = item;
				return true;
			}
		});

		return tvshow;
	});
}

export function getTVShowEpisodes(sid) {
	return get(`https://soap4.me/api/episodes/${sid}/`);
}

export function getTVShowSeasons(sid) {
	return getTVShowEpisodes(sid).then(episodes => episodes.reduce((result, item) => {
		let seasonIndex = item.season - 1;
		let episodeIndex = item.episode;

		if (!result[seasonIndex]) {
			result[seasonIndex] = {
				id: item.season_id,
				season: item.season,
				episodes: [],
				subtitles: [],
			};
		}

		let episodeCollection = result[seasonIndex].episodes;

		if (~item.translate.toLowerCase().indexOf('субтитры')) {
			episodeCollection = result[seasonIndex].subtitles;
		}

		if (!episodeCollection[episodeIndex]) {
			episodeCollection[episodeIndex] = {};
		}
		episodeCollection[episodeIndex][item.quality] = item;
		return result;
	}, []));
}

export function getTVShowSeason(sid, id) {
	return getTVShowSeasons(sid).then(seasons => seasons.filter(season => season.id === id)[0]);
}

export function markEpisodeAsWatched(eid) {
	let token = getToken();
	let payload = {
		eid,
		token,
		what: 'mark_watched',
	};

	return post('https://soap4.me/callback/', payload);
}

export function markEpisodeAsUnWatched(eid) {
	let token = getToken();
	let payload = {
		eid,
		token,
		what: 'mark_unwatched',
	};

	return post('https://soap4.me/callback/', payload);
}

export function getEpisodeMediaURL(eid, sid, episodeHash) {
	let token = getToken();
	let hash = md5(token + eid + sid + episodeHash);
	let payload = {
		eid,
		hash,
		token,
		do: 'load',
		what: 'player',
	};

	return post('https://soap4.me/callback/', payload).then(({server}) => {
		return `https://${server}.soap4.me/${token}/${eid}/${hash}/`;
	});
}

export function addToMyTVShows(sid) {
	let token = getToken();
	return post(`https://soap4.me/api/soap/watch/${sid}/`, {token});
}

export function removeFromMyTVShows(sid) {
	let token = getToken();
	return post(`https://soap4.me/api/soap/unwatch/${sid}/`, {token});
}

export function getSearchResults(query) {
	return get(`https://soap4.me/api/search/?q=${encodeURIComponent(query)}`);
}

function headers() {
	let token = getToken();
	let headers = {
		'X-Api-Token': token,
		'User-Agent': 'xbmc for soap',
	};

	return headers;
}
