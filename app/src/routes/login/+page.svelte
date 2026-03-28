<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="login-wrapper">
	<div class="login-card">
		<h1 class="app-name">Körmerle</h1>
		<p class="tagline">Wochenplanung leicht gemacht</p>

		<form method="post" use:enhance>
			<label>
				E-Mail
				<input type="email" name="email" required autocomplete="email" />
			</label>

			<label>
				Passwort
				<input type="password" name="password" required autocomplete="current-password" />
			</label>

			{#if form?.message}
				<p class="error">{form.message}</p>
			{/if}

			<button type="submit">Anmelden</button>
		</form>
	</div>
</div>

<style>
	.login-wrapper {
		min-height: calc(100vh - var(--nav-h, 0px));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.login-card {
		width: 100%;
		max-width: 380px;
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: 2.25rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.app-name {
		text-align: center;
		font-size: 2rem;
		color: var(--green);
	}

	.tagline {
		text-align: center;
		color: var(--text-muted);
		font-size: 0.9rem;
		margin: -1.25rem 0 0;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	input {
		padding: 0.65rem 0.875rem;
		font-size: 1rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	input:focus {
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(77, 122, 88, 0.15);
		background: var(--surface);
	}

	button {
		width: 100%;
		padding: 0.7rem;
		font-size: 1rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background 0.15s;
	}

	button:hover {
		background: var(--green-dark);
	}
</style>
