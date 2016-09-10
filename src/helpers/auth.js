/** @jsx TVDML.jsx */

import * as TVDML from 'tvdml';
import assign from 'object-assign';

import {authorize} from '../request/soap';
import {noop, getStartParams, removeDocumentFromNavigation} from '../utils';

import Loader from '../components/loader';

const {Promise} = TVDML;

const IDLE = 'idle';
const LOGIN = 'login';
const PASSWORD = 'password';
const AUTHORIZING = 'authorizing';

let uid = 0;

export default function(options = {}) {
	const id = `auth-${getUID()}`;
	const envelope = {
		login: '',
		password: '',
	};

	let {
		onError = noop(),
		onSuccess = noop(),
	} = options;

	let menuButtonPressPipeline = null;
	let state = IDLE;

	let routesList = [
		getLoginRouteName(id),
		getPasswordRouteName(id),
		getAuthorizingRouteName(id),
	];

	TVDML
		.handleRoute(getLoginRouteName(id))
		.pipe(TVDML.passthrough(() => state = LOGIN))
		.pipe(createForm({
			description: 'Enter user login (not e-mail)',
			placeholder: 'Login',
			button: 'Next',

			onSubmit(login) {
				envelope.login = login;
				TVDML.navigate(getPasswordRouteName(id));
			}
		}));

	TVDML
		.handleRoute(getPasswordRouteName(id))
		.pipe(TVDML.passthrough(() => state = PASSWORD))
		.pipe(createForm({
			description: 'Enter account password (minimum 6 symbols)',
			placeholder: 'Password',
			button: 'Authorize',
			secure: true,

			validate(value) {
				return value.length > 5;
			},

			onSubmit(password) {
				envelope.password = password;
				TVDML.navigate(getAuthorizingRouteName(id));
			}
		}));

	TVDML
		.handleRoute(getAuthorizingRouteName(id))
		.pipe(TVDML.passthrough(() => state = AUTHORIZING))
		.pipe(TVDML.render(<Loader title="Authorizing..." />))
		.pipe(() => {
			return new Promise((resolve, reject) => {
					let {login, password} = envelope;

					envelope.reject = reject;
					authorize({login, password}).then(resolve, reject);
				})
				.then(response => {
					if (response.ok) {
						onSuccess.call(instance, response, envelope.login);
					} else {
						let error = new Error('Wrong login or password');
						error.code = 'EBADCREDENTIALS';
						onError.call(instance, error);
					}
				})
				.catch(error => {
					error.code = 'EBADRESPONSE';
					onError.call(instance, error);
				});
		});

	const instance = {
		id,

		present() {
			if (state === IDLE) {
				menuButtonPressPipeline = TVDML
					.subscribe('menu-button-press')
					.pipe(({from: {route: routeFrom, modal}, to: {route: routeTo}}) => {
						if (routeFrom === getLoginRouteName(id) && !modal) {
							let error = new Error('User aborted login process');
							error.code = 'EABORT';
							onError.call(instance, error);
							this.dismiss();
						}

						if (routeTo === getLoginRouteName(id)) {
							envelope.password = '';
							state = LOGIN;
						}

						if (routeTo === getPasswordRouteName(id)) {
							envelope.reject && envelope.reject();
							state = PASSWORD;
						}
					});

				return TVDML.navigate(getLoginRouteName(id));
			} else {
				throw `Incorrect state: "${state}"`;
			}
		},

		reset() {
			if (state !== IDLE) {
				return TVDML
					.navigate(getLoginRouteName(id))
					.then(payload => {
						let {document} = payload;
						let target = document.prevRouteDocument;

						while(target && ~routesList.indexOf(target.route)) {
							removeDocumentFromNavigation(target);
							target = target.prevRouteDocument;
						}

						return payload;
					});
			} else {
				throw `Incorrect state: "${state}"`;
			}
		},

		dismiss() {
			state = IDLE;

			if (menuButtonPressPipeline) {
				menuButtonPressPipeline();
				menuButtonPressPipeline = null;
			}

			navigationDocument.documents
				.filter(({route}) => ~routesList.indexOf(route))
				.forEach(removeDocumentFromNavigation);
		},

		destroy() {
			TVDML.dismissRoute(getLoginRouteName(id));
			TVDML.dismissRoute(getPasswordRouteName(id));
			TVDML.dismissRoute(getAuthorizingRouteName(id));
		}
	};

	return instance;
}

function createForm(params = {}) {
	let {
		onSubmit = noop(),
		validate: customValidate = defaultValidate,
	} = params;

	return TVDML.render(TVDML.createComponent({
		getInitialState() {
			return assign({
				value: '',
				placeholder: '',
				valid: false,
				button: 'Submit',
			}, params);
		},

		componentDidMount() {
			let keyboard = this.textField.getFeature('Keyboard');
			keyboard.onTextChange = () => this.validate(keyboard.text);
		},

		validate(value) {
			this.setState({value, valid: customValidate(value)});
		},

		render() {
			const {BASEURL} = getStartParams();

			return (
				<document>
					<formTemplate>
						<banner>
							<img src={`${BASEURL}/assets/logo.png`} width="218" height="218"/>
							<description>
								{this.state.description}
							</description>
						</banner>
						<textField
							secure={this.state.secure}
							ref={node => this.textField = node}
						>
							{this.state.placeholder}
						</textField>
						<footer>
							<button
								disabled={!this.state.valid}
								onSelect={this.onSubmit}
							>
								<text>
									{this.state.button}
								</text>
							</button>
						</footer>
					</formTemplate>
				</document>
			);
		},

		onSubmit() {
			onSubmit(this.state.value);
		},
	}));
}

function defaultValidate(value) {
	return !!value;
}

function getUID() {
	return ++uid;
}

function getLoginRouteName(id) {
	return `login-${id}`;
}

function getPasswordRouteName(id) {
	return `password-${id}`;
}

function getAuthorizingRouteName(id) {
	return `authorizing-${id}`;
}
