import { HorizonError } from './errors/horizon-error';
import axios from 'axios';
import { PublicKey } from '@stellarbeat/js-stellar-domain';
import { err, ok, Result } from 'neverthrow';

export type Account = {
	home_domain: string | undefined;
};

export class HorizonService {
	protected _horizonUrl: string;

	constructor() {
		if (!process.env.HORIZON_URL) {
			throw new HorizonError('Horizon not configured');
		}

		this._horizonUrl = process.env.HORIZON_URL;
	}

	async fetchAccount(
		publicKey: PublicKey
	): Promise<Result<Account | undefined, Error>> {
		const accountResult = await this.fetch(
			this._horizonUrl + '/accounts/' + publicKey
		);
		if (accountResult.isErr()) return err(accountResult.error);

		const account = accountResult.value;

		if (account === undefined) return ok(undefined);

		if (typeof account === 'object' && account.hasOwnProperty('home_domain'))
			return ok(account as Account);

		return ok(undefined);
	}

	protected async fetch(
		url: string
	): Promise<Result<object | undefined, Error>> {
		const source = axios.CancelToken.source();
		const timeout = setTimeout(() => {
			source.cancel('Connection time-out');
			// Timeout Logic
		}, 2050);
		try {
			let response = await axios.get(url, {
				cancelToken: source.token,
				timeout: 2000,
				headers: { 'User-Agent': 'stellarbeat.io' }
			});
			clearTimeout(timeout);
			return ok(response.data);
		} catch (e) {
			if (timeout) clearTimeout(timeout);

			if (axios.isAxiosError(e)) {
				if (e.response && e.response.status === 404) return ok(undefined);
			}

			if (e instanceof Error) return err(new HorizonError(e.message));
			else return err(new HorizonError('horizon fetch failed'));
		}
	}
}
