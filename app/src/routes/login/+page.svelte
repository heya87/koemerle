<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="login-wrapper">
	<h1>Körmerle</h1>
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

<style>
	.login-wrapper {
		max-width: 360px;
		margin: 6rem auto;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	h1 {
		text-align: center;
		margin: 0;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9rem;
	}

	input {
		padding: 0.5rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	button {
		padding: 0.6rem;
		font-size: 1rem;
		cursor: pointer;
	}

	.error {
		color: red;
		margin: 0;
		font-size: 0.9rem;
	}
</style>
