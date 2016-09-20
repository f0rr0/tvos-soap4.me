/** @jsx TVDML.jsx */

import * as TVDML from 'tvdml';
import assign from 'object-assign';

import {link, prettifyEpisodeNum} from '../utils';
import {processEntitiesInString} from '../utils/parser';
import {
	getSearchResults,
	getLatestTVShows,
	getPopularTVShows,
} from '../request/soap';

import Tile from '../components/tile';

const {Promise} = TVDML;

const THROTTLE_TIMEOUT = 500;

export default function() {
	return TVDML
		.createPipeline()
		.pipe(TVDML.render(TVDML.createComponent({
			getInitialState() {
				return {
					value: '',
					loading: false,
					latest: [],
					series: [],
					popular: [],
					persons: [],
					episodes: [],
				};
			},

			render() {
				let tvshows = this.state.episodes.reduce((result, item) => {
					if (!result[item.soap_en]) {
						result[item.soap_en] = [];
					}
					result[item.soap_en].push(item);
					return result;
				}, {});

				let episodes = Object.keys(tvshows);

				return (
					<document>
						<head>
							<style content={`
								.shelf_indent {
									margin: 0 0 100;
								}
							`} />
						</head>
						<searchTemplate>
							<searchField
								ref={node => this.searchField = node}
								showSpinner={this.state.loading ? 'true' : undefined}
							/>
							<collectionList>
								{this.renderLatest()}
								{this.renderPopular()}
								{this.renderPersons()}
								{this.renderShows()}
								{episodes.map((name, i) => this.renderEpisodes(name, tvshows[name], (i + 1) === episodes.length))}
							</collectionList>
						</searchTemplate>
					</document>
				);
			},

			renderLatest() {
				if (!this.state.latest.length || this.state.value) return null;

				return (
					<shelf class="shelf_indent">
						<header>
							<title>Latest TV Shows</title>
						</header>
						<section>
							{this.state.latest.map(({
								sid,
								title,
								covers: {big: poster},
							}) => (
								<Tile
									title={title}
									route="tvshow"
									poster={poster}
									payload={{title, sid}}
								/>
							))}
						</section>
					</shelf>
				);
			},

			renderPopular() {
				if (!this.state.popular.length || this.state.value) return null;

				return (
					<shelf>
						<header>
							<title>Popular TV Shows</title>
						</header>
						<section>
							{this.state.popular.map(({
								sid,
								title,
								covers: {big: poster},
							}) => (
								<Tile
									title={title}
									route="tvshow"
									poster={poster}
									payload={{title, sid}}
								/>
							))}
						</section>
					</shelf>
				);
			},

			renderPersons() {
				if (!this.state.persons.length) return null;

				return (
					<shelf class="shelf_indent">
						<header>
							<title>Persons</title>
						</header>
						<section>
							{this.state.persons.map(actor => {
								let {
									id,
									name_en,
									image_original,
								} = actor;

								let [firstName, lastName] = name_en.split(' ');

								return (
									<monogramLockup
										key={id}
										onSelect={link('actor', {id, actor: name_en})}
									>
										<monogram 
											style="tv-placeholder: monogram"
											src={image_original}
											firstName={firstName}
											lastName={lastName}
										/>
										<title>{name_en}</title>
										<subtitle>Actor</subtitle>
									</monogramLockup>
								);
							})}
						</section>
					</shelf>
				);
			},

			renderShows() {
				if (!this.state.series.length) return null;

				return (
					<shelf class="shelf_indent">
						<header>
							<title>TV Shows</title>
						</header>
						<section>
							{this.state.series.map(({
								sid,
								title,
								covers: {big: poster},
							}) => (
								<Tile
									title={title}
									route="tvshow"
									poster={poster}
									payload={{title, sid}}
								/>
							))}
						</section>
					</shelf>
				);
			},

			renderEpisodes(title, list, isLast) {
				return (
					<shelf class={isLast ? undefined : 'shelf_indent'}>
						<header>
							<title>{title}</title>
						</header>
						<section>
							{list.map(({
								sid,
								episode,
								soap_en,
								title_en,
								season: seasonNumber,
								covers: {big: poster},
							}) => {
								let seasonTitle = `Season ${seasonNumber}`;
								let title = processEntitiesInString(title_en);

								return (
									<Tile
										title={title}
										route="season"
										poster={poster}
										payload={{sid, id: seasonNumber, episode, title: `${soap_en} — ${seasonTitle}`}}
										subtitle={prettifyEpisodeNum(seasonNumber, episode)}
									/>
								);
							})}
						</section>
					</shelf>
				);
			},

			componentDidMount() {
				let keyboard = this.searchField.getFeature('Keyboard');
				keyboard.onTextChange = () => this.search(keyboard.text);
				Promise
					.all([
						getLatestTVShows(),
						getPopularTVShows(),
					])
					.then(([latest, popular]) => {
						this.setState({latest, popular})
					});
			},

			search(query) {
				this.setState({value: query});
				this.throttle && clearTimeout(this.throttle);
				this.throttle = setTimeout(this.loadResults.bind(this, query), THROTTLE_TIMEOUT);
			},

			loadResults(query) {
				this.setState({loading: true});
				return getSearchResults(query)
					.catch(() => ({}))
					.then(result => this.setState(assign({loading: false}, result)));
			},
		})));
}