/** @jsx jsx */

import {jsx} from 'tvdml';

export default function Loader(props) {
	const {title, heroImg} = props;
	let banner;

	if (heroImg) {
		banner = (
			<banner>
				<heroImg src={heroImg} />
			</banner>
		);
	}

	return (
		<document>
			<loadingTemplate>
				{banner}
				<activityIndicator>
					<title>{title}</title>
				</activityIndicator>
			</loadingTemplate>
		</document>
	);
}
