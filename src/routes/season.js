/** @jsx TVDML.jsx */

import * as TVDML from 'tvdml';
import assign from 'object-assign';

import {link} from '../utils';
import * as settings from '../settings';
import {processEntitiesInString} from '../utils/parser';
import {deepEqualShouldUpdate} from '../utils/components';

import * as user from '../user';
import authFactory from '../helpers/auth';
import {defaultErrorHandlers} from '../helpers/auth/handlers';

import {
	localization,
	mediaQualities,
	mediaLocalizations,
	addToMyTVShows,
	saveElapsedTime,
	getMediaStream,
	getTVShowSeason,
	getEpisodeMedia,
	getTVShowDescription,
	markSeasonAsWatched,
	markSeasonAsUnwatched,
	markEpisodeAsWatched,
	markEpisodeAsUnwatched,
} from '../request/soap';

import Loader from '../components/loader';
import Authorize from '../components/authorize';

const {Promise} = TVDML;

const {VIDEO_QUALITY} = settings.params;
const {SD, HD, FULLHD} = settings.values[VIDEO_QUALITY];

const subtitlesList = [
	localization.ORIGINAL_SUBTITLES,
	localization.LOCALIZATION_SUBTITLES,
];

export default function() {
	return TVDML
		.createPipeline()
		.pipe(TVDML.passthrough(({navigation: {sid, id, title, episode}}) => ({sid, id, title, episode})))
		.pipe(TVDML.render(TVDML.createComponent({
			getInitialState() {
				let authorized = user.isAuthorized();

				return {
					authorized,
					loading: true,
				};
			},

			componentDidMount() {
				this.userStateChangePipeline = user
					.subscription()
					.pipe(() => this.setState({
						authorized: user.isAuthorized(),
					}));

				// To improuve UX on fast request we are adding rendering timeout.
				let waitForAnimations = new Promise((resolve) => setTimeout(resolve, 500));

				Promise
					.all([this.loadData(), waitForAnimations])
					.then(([payload]) => this.setState(assign({loading: false}, payload)));
			},

			componentWillUnmount() {
				this.userStateChangePipeline.unsubscribe();
			},

			shouldComponentUpdate: deepEqualShouldUpdate,

			loadData() {
				let {sid, id} = this.props;

				return Promise
					.all([
						getTVShowSeason(sid, id),
						getTVShowDescription(sid),
					])
					.then(([season, tvshow]) => ({tvshow, season}))
					.then(payload => assign({}, payload, getSeasonExtendedData(payload.season)));
			},

			render() {
				if (this.state.loading) {
					return <Loader title={this.props.title} />
				}

				let highlighted = false;
				let {title} = this.state.tvshow;
				let {episodes} = this.state;

				return (
					<document>
						<head>
							<style content={`
								.controls_container {
									margin: 40 0 0;
									tv-align: center;
									tv-content-align: top;
								}

								.control {
									margin: 0 24;
								}

								.item {
									background-color: rgba(255, 255, 255, 0.05);
									tv-highlight-color: rgba(255, 255, 255, 0.9);
								}
							`} />
						</head>
						<compilationTemplate theme="light">
							<background>
								<heroImg src={this.state.poster} />
							</background>
							<list>
								<segmentBarHeader>
									<title>{title}</title>
									<subtitle>Season {this.state.season.season}</subtitle>
								</segmentBarHeader>
								<section>
									{episodes.map((episode, i) => {
										let {
											title_en,
											spoiler,
											watched,
											episode: episodeNumber,
										} = episode;

										let file = getEpisodeMedia(episode);
										let mediaQualityCode = file && mediaQualities[file.quality];
										let mediaTranslationCode = file && mediaLocalizations[file.translate];

										let hasHD = file && mediaQualityCode !== SD;
										let hasSubtitles = !!~subtitlesList.indexOf(mediaTranslationCode);

										let highlight = false;
										let title = processEntitiesInString(title_en);
										let description = processEntitiesInString(spoiler);

										if (this.props.episode) {
											highlight = episodeNumber === this.props.episode;
										} else if (!highlighted && !watched) {
											highlight = true;
											highlighted = true;
										}

										let badges = [
											this.state[`eid-${episodeNumber}`] && (
												<badge src="resource://button-checkmark" />
											),
											hasSubtitles && (
												<badge src="resource://cc" />
											),
											hasHD && (
												<badge src="resource://hd" />
											),
										];

										return (
											<listItemLockup
												class="item"
												autoHighlight={highlight ? 'true' : undefined}
												onSelect={this.onPlayEpisode.bind(this, episodeNumber)}
											>
												<ordinal minLength="3">{episodeNumber}</ordinal>
												<title style="tv-text-highlight-style: marquee-on-highlight">
													{title}
												</title>
												<decorationLabel>
													{badges.filter(Boolean).reduce((result, item, i) => {
														i && result.push('  ');
														result.push(item);
														return result;
													}, [])}
												</decorationLabel>
												<relatedContent>
													<lockup>
														<img src={this.state.poster} style="tv-placeholder: tv" width="400" height="400" />
														<row class="controls_container">
															{this.state.authorized && (this.state[`eid-${episodeNumber}`] ? (
																<buttonLockup
																	class="control"
																	onSelect={this.onMarkAsNew.bind(this, episodeNumber)}
																>
																	<badge src="resource://button-remove" />
																	<title>Mark as Unwatched</title>
																</buttonLockup>
															) : (
																<buttonLockup
																	class="control"
																	onSelect={this.onMarkAsWatched.bind(this, episodeNumber, true)}
																>
																	<badge src="resource://button-add" />
																	<title>Mark as Watched</title>
																</buttonLockup>
															))}
															{this.state.authorized && (
																<buttonLockup 
																	class="control"
																	onSelect={this.onMore}
																>
																	<badge src="resource://button-more" />
																	<title>More</title>
																</buttonLockup>
															)}
														</row>
														<description
															handlesOverflow="true"
															style="margin: 40 0 0; tv-text-max-lines: 2"
															onSelect={this.onShowDescription.bind(this, {title, description})}
														>{description}</description>
													</lockup>
												</relatedContent>
											</listItemLockup>
										);
									})}
								</section>
							</list>
						</compilationTemplate>
					</document>
				);
			},

			onPlayEpisode(episodeNumber) {
				let {sid, id} = this.props;
				let {episodes, poster, authorized} = this.state;
				let markAsWatched = this.onMarkAsWatched.bind(this);

				if (!authorized) {
					let authHelper = authFactory({
						onError: defaultErrorHandlers,
						onSuccess: ({token, till}, login) => {
							user.set({token, till, login, logged: 1});
							this.loadData().then(payload => {
								this.setState(payload);
								authHelper.dismiss();
								this.onPlayEpisode(episodeNumber);
							});
						},
					});

					return TVDML
						.renderModal(<Authorize onAuthorize={() => authHelper.present()} />)
						.sink();
				}

				let resolvers = {
					initial() {
						return episodeNumber;
					},

					next({id}) {
						let [sid, season, episodeNumber] = id.split('-');
						let episode = getEpisode(episodeNumber, episodes);
						let index = episodes.indexOf(episode);
						let nextEpisode = ~index ? episodes[index + 1] : {};
						return nextEpisode.episode || null;
					},
				};

				TVDML
					.createPlayer({
						items(item, request) {
							let episodeNumber = resolvers[request] && resolvers[request](item);
							let episode = getEpisode(episodeNumber, episodes);
							return getEpisodeItem(sid, episode, poster);
						},

						markAsStopped(item, elapsedTime) {
							let {id} = item;
							let [sid, season, episodeNumber] = id.split('-');
							let episode = getEpisode(episodeNumber, episodes);
							let {eid} = getEpisodeMedia(episode);
							return saveElapsedTime(eid, elapsedTime);
						},

						markAsWatched(item) {
							let {id} = item;

							if (!getActiveDocument()) {
								let [sid, season, episodeNumber] = id.split('-');
								return markAsWatched(episodeNumber);
							}
						},

						uidResolver(item) {
							return item.id;
						},
					})
					.then(player => player.play());
			},

			onMarkAsNew(episodeNumber) {
				let {id, sid} = this.props;
				this.setState({[`eid-${episodeNumber}`]: false});
				return markEpisodeAsUnwatched(sid, id, episodeNumber);
			},

			onMarkAsWatched(episodeNumber, addTVShowToSubscriptions) {
				let {id, sid} = this.props;
				this.setState({[`eid-${episodeNumber}`]: true});
				return Promise.all([
					markEpisodeAsWatched(sid, id, episodeNumber),
					addTVShowToSubscriptions ? addToMyTVShows(sid) : Promise.resolve(),
				]);
			},

			onShowDescription({title, description}) {
				TVDML
					.renderModal(
						<document>
							<descriptiveAlertTemplate>
								<title>
									{title}
								</title>
								<description>
									{description}
								</description>
							</descriptiveAlertTemplate>
						</document>
					)
					.sink();
			},

			onMore() {
				let hasWatchedEpisodes = this.state.episodes.some(({watched}) => watched > 0);
				let hasUnwatchedEpisodes = this.state.episodes.some(({watched}) => watched < 1);

				TVDML
					.renderModal(
						<document>
							<alertTemplate>
								<title>More</title>
								{hasUnwatchedEpisodes && (
									<button onSelect={this.onMarkSeasonAsWatched}>
										<text>Mark Season as Watched</text>
									</button>
								)}
								{hasWatchedEpisodes && (
									<button onSelect={this.onMarkSeasonAsUnwatched}>
										<text>Mark Season as Unwatched</text>
									</button>
								)}
							</alertTemplate>
						</document>
					)
					.sink();
			},

			onMarkSeasonAsWatched() {
				let {sid, id} = this.props;

				return markSeasonAsWatched(sid, id)
					.then(this.loadData.bind(this))
					.then(this.setState.bind(this))
					.then(TVDML.removeModal);
			},

			onMarkSeasonAsUnwatched() {
				let {sid, id} = this.props;

				return markSeasonAsUnwatched(sid, id)
					.then(this.loadData.bind(this))
					.then(this.setState.bind(this))
					.then(TVDML.removeModal);
			},
		})));
}

function getEpisode(episodeNumber, episodes) {
	let [episode] = episodes.filter(({episode}) => episode === episodeNumber);
	return episode;
}

function getEpisodeItem(sid, episode, poster) {
	if (!episode) return null;

	let {
		season,
		spoiler,
		title_en,
		episode: episodeNumber,
		screenshots: {big: episodePoster},
	} = episode;

	let title = processEntitiesInString(title_en);
	let description = processEntitiesInString(spoiler);

	let id = [sid, season, episodeNumber].join('-');
	let file = getEpisodeMedia(episode);
	let media = {sid, file};

	return getMediaStream(media).then(({stream, start_from}) => ({
		id,
		title,
		description,
		url: stream,
		artworkImageURL: poster || episodePoster,
		resumeTime: start_from && parseFloat(start_from),
	}));
}

function getSeasonExtendedData(season) {
	let {episodes, covers: {big: poster}} = season;

	return episodes.reduce((result, {episode, watched}) => {
		result[`eid-${episode}`] = !!watched;
		return result;
	}, {
		poster,
		episodes,
	});
}