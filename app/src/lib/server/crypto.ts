import { symmetricEncrypt, symmetricDecrypt } from 'better-auth/crypto';
import { env } from '$env/dynamic/private';

/**
 * Encrypts/decrypts secrets we store ourselves (Bring!/Biogmüsabo passwords on the
 * families table), keyed with the same BETTER_AUTH_SECRET the app already requires —
 * no separate encryption key to generate or manage.
 */

function key(): string {
	if (!env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');
	return env.BETTER_AUTH_SECRET;
}

export async function encryptSecret(plain: string): Promise<string> {
	return symmetricEncrypt({ key: key(), data: plain });
}

export async function decryptSecret(encrypted: string): Promise<string> {
	return symmetricDecrypt({ key: key(), data: encrypted });
}
