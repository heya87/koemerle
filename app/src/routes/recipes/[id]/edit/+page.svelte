<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const recipe = data.recipe;
</script>

<h1>Rezept bearbeiten</h1>

<form method="post" use:enhance>
	<label>
		Name *
		<input type="text" name="name" value={form?.name ?? recipe.name} required />
	</label>

	<label>
		Zutaten * <span class="hint">(eine pro Zeile, z.B. "2 Karotten")</span>
		<textarea name="ingredients" rows="8" required>{form?.ingredients ?? recipe.ingredients}</textarea>
	</label>

	<label>
		Rezept-Link
		<input type="url" name="recipeUrl" value={form?.recipeUrl ?? recipe.recipeUrl ?? ''} />
	</label>

	<p class="keys">Schlüssel: {recipe.matchKeys.join(', ')}</p>

	{#if form?.message}
		<p class="error">{form.message}</p>
	{/if}

	<div class="buttons">
		<a href="/recipes">Abbrechen</a>
		<button type="submit">Speichern</button>
	</div>
</form>

<style>
	form {
		max-width: 560px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.hint {
		font-size: 0.8rem;
		color: #888;
		font-weight: normal;
	}

	input, textarea {
		padding: 0.5rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-family: inherit;
	}

	.keys {
		font-size: 0.85rem;
		color: #555;
		margin: 0;
	}

	.buttons {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	button {
		padding: 0.5rem 1.25rem;
		font-size: 1rem;
		cursor: pointer;
	}

	a {
		color: inherit;
	}

	.error {
		color: red;
		margin: 0;
	}
</style>
