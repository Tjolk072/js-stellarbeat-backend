import 'reflect-metadata';
import { PublicKey } from '@stellarbeat/js-stellar-domain';
import { err, ok, Result } from 'neverthrow';
import { inject, injectable } from 'inversify';
import { Url } from '../value-objects/Url';
import { HttpService, isHttpError } from './HttpService';
import { isObject } from '../utilities/TypeGuards';

export type Account = {
	home_domain: string | undefined;
};

@injectable()
export class HorizonService {
	constructor(
		@inject('HttpService') protected httpService: HttpService,
		protected horizonUrl: Url
	) {
		this.horizonUrl = horizonUrl;
		this.httpService = httpService;
	}

	async fetchAccount(
		publicKey: PublicKey
	): Promise<Result<Account | undefined, Error>> {
		const accountResult = await this.fetch(
			this.horizonUrl.value + '/accounts/' + publicKey
		);
		if (accountResult.isErr()) return err(accountResult.error);

		const account = accountResult.value;

		if (account === undefined) return ok(undefined);

		// eslint-disable-next-line no-prototype-builtins
		if (typeof account === 'object' && account.hasOwnProperty('home_domain'))
			return ok(account as Account);

		return ok(undefined);
	}

	protected async fetch(
		url: string
	): Promise<Result<Record<string, unknown> | undefined, Error>> {
		const urlResult = Url.create(url);
		if (urlResult.isErr()) return err(urlResult.error);
		const response = await this.httpService.get(urlResult.value);
		if (response.isErr()) {
			if (isHttpError(response.error)) {
				if (response.error.response && response.error.response.status === 404)
					return ok(undefined);
			}
			return err(response.error);
		}
		if (isObject(response.value.data)) return ok(response.value.data);
		return err(new Error('Data object missing in Horizon response'));
	}
}
