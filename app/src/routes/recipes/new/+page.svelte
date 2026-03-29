<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="page-header">
	<a href="/recipes" class="back-link">← Rezepte</a>
	<h1>Neues Rezept</h1>
</div>

<div class="form-card">
	<form method="post" use:enhance>
		<label>
			<span class="label-text">Name <span class="required">*</span></span>
			<input type="text" name="name" value={form?.name ?? ''} required />
		</label>

		<label>
			<span class="label-text">
				Zutaten <span class="required">*</span>
				<span class="hint">eine pro Zeile, z.B. "2 Karotten"</span>
			</span>
			<textarea name="ingredients" rows="8" required>{form?.ingredients ?? ''}</textarea>
		</label>

		<label>
			<span class="label-text">Personen</span>
			<input type="number" name="servings" min="1" max="20" value={form?.servings ?? ''} style="max-width: 6rem" />
		</label>

		<label>
			<span class="label-text">Rezept-Link</span>
			<input type="url" name="recipeUrl" value={form?.recipeUrl ?? ''} />
		</label>

		{#if form?.message}
			<p class="error">{form.message}</p>
		{/if}

		<div class="buttons">
			<a href="/recipes" class="btn-cancel">Abbrechen</a>
			<button type="submit" class="btn-save">Speichern</button>
		</div>
	</form>
</div>

<style>
	.page-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.back-link {
		font-size: 0.875rem;
		color: var(--text-muted);
		text-decoration: none;
	}

	.back-link:hover {
		color: var(--text);
	}

	.form-card {
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		padding: 1.5rem 1.25rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.label-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}

	.required {
		color: var(--red);
	}

	.hint {
		font-size: 0.775rem;
		color: var(--text-light);
		font-weight: normal;
	}

	input,
	textarea {
		padding: 0.65rem 0.875rem;
		font-size: 1rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
		width: 100%;
	}

	input:focus,
	textarea:focus {
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(77, 122, 88, 0.15);
		background: var(--surface);
	}

	textarea {
		resize: vertical;
	}

	.buttons {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding-top: 0.25rem;
	}

	.btn-save {
		padding: 0.65rem 1.5rem;
		font-size: 0.95rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-save:hover {
		background: var(--green-dark);
	}

	.btn-cancel {
		font-size: 0.9rem;
		color: var(--text-muted);
		text-decoration: none;
	}

	.btn-cancel:hover {
		color: var(--text);
		text-decoration: underline;
	}

	/* Desktop */
	@media (min-width: 768px) {
		.form-card {
			max-width: 600px;
			padding: 2rem;
		}

		.page-header {
			flex-direction: row;
			align-items: center;
			gap: 1rem;
		}
	}
</style>
