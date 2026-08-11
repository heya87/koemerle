import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { validateSetupToken, completeSetupToken } from '$lib/server/families';

export const load: PageServerLoad = async ({ params }) => {
	const result = await validateSetupToken(params.token);
	return { valid: result.valid, reason: result.valid ? null : result.reason };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const result = await validateSetupToken(params.token);
		if (!result.valid) return fail(400, { message: 'Dieser Link ist ungültig oder abgelaufen.' });

		const fd = await request.formData();
		const password = fd.get('password')?.toString() ?? '';
		const confirm = fd.get('confirm')?.toString() ?? '';

		if (password.length < 8) return fail(400, { message: 'Passwort muss mindestens 8 Zeichen haben.' });
		if (password !== confirm) return fail(400, { message: 'Passwörter stimmen nicht überein.' });

		await completeSetupToken(result.tokenId, result.userId, password);
		return redirect(303, '/login?activated=1');
	}
};
