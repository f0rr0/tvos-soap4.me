/** @jsx TVDML.jsx */

import * as TVDML from 'tvdml';

import {get as i18n} from '../localization';
import styles from '../common/styles';

export default class Authorize extends TVDML.Component {
	render() {
		console.log(777, this.props, this.state);

		const {description, onAuthorize} = this.props;

		return (
			<document>
				<head>
					{styles}
				</head>
				<alertTemplate>
					<title class="grey_text">
						{i18n('authorize-caption')}
					</title>
					<description class="grey_description">
						{description || i18n('authorize-description')}
					</description>
					<button onSelect={onAuthorize}>
						<text>
							{i18n('authorize-control-trigger')}
						</text>
					</button>
				</alertTemplate>
			</document>
		);
	}

	componentDidUpdate(prevProps, prevState) {
		console.log(888, prevProps, prevState);
	}

	componentWillUnmount() {
		console.log(999);
	}
}

/*export default function Authorize(props) {
	const {description, onAuthorize} = props;

	return (
		<document>
			<head>
				{styles}
			</head>
			<alertTemplate>
				<title class="grey_text">
					{i18n('authorize-caption')}
				</title>
				<description class="grey_description">
					{description || i18n('authorize-description')}
				</description>
				<button onSelect={onAuthorize}>
					<text>
						{i18n('authorize-control-trigger')}
					</text>
				</button>
			</alertTemplate>
		</document>
	);
}*/
