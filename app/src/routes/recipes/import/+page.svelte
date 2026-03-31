<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { form, data }: { form: ActionData; data: PageData } = $props();

	let searchQuery = $state(form?.query ?? '');

	let previewName = $state(form?.preview?.name ?? '');
	let previewIngredients = $state(form?.preview?.ingredients ?? '');
	let previewUrl = $state(form?.preview?.url ?? '');
	let previewImageUrl = $state(form?.preview?.imageUrl ?? null);

	$effect(() => {
		if (form?.preview) {
			previewName = form.preview.name;
			previewIngredients = form.preview.ingredients;
			previewUrl = form.preview.url;
			previewImageUrl = form.preview.imageUrl ?? null;
		}
	});
</script>

<div class="page-header">
	<a href="/recipes" class="back-link">← Rezepte</a>
	<h1>Von Fooby importieren</h1>
</div>

<div class="import-layout">
	<!-- Left: search + results -->
	<div class="panel panel-left">
		<form method="post" action="?/search" use:enhance class="search-form">
			<input
				type="text"
				name="query"
				placeholder="Rezept suchen…"
				bind:value={searchQuery}
				required
				autofocus
			/>
			<button type="submit" class="btn-search">Suchen</button>
		</form>

		{#if data.basket.length > 0}
			<div class="basket-chips">
				{#each data.basket as item}
					<button
						type="button"
						class="chip"
						onclick={() => {
						const current = searchQuery.trim();
						searchQuery = current ? `${current} ${item.matchKey}` : item.matchKey;
					}}
					>{item.displayText}</button>
				{/each}
			</div>
		{/if}

		{#if form?.message && !form?.preview}
			<p class="error">{form.message}</p>
		{/if}

		{#if form?.results}
			{#if form.results.length === 0}
				<p class="empty">Keine Rezepte gefunden.</p>
			{:else}
				<ul class="results-list">
					{#each form.results as result}
						<li class:active={previewUrl === result.url}>
							<form method="post" action="?/preview" use:enhance>
								<input type="hidden" name="url" value={result.url} />
								<input type="hidden" name="query" value={form.query} />
								<button type="submit" class="result-btn">{result.name}</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>

	<!-- Right: preview + save -->
	<div class="panel panel-right">
		{#if form?.preview || previewName}
			<form method="post" action="?/save" use:enhance class="preview-form">
				{#if previewImageUrl}
					<img src={previewImageUrl} alt={previewName} class="preview-image" />
				{/if}

				<label>
					<span class="label-text">Name</span>
					<input type="text" name="name" bind:value={previewName} required />
				</label>

				<label>
					<span class="label-text">Zutaten</span>
					<textarea name="ingredients" rows="10" required bind:value={previewIngredients}></textarea>
				</label>

				<input type="hidden" name="recipeUrl" value={previewUrl} />

				{#if form?.message && form?.preview}
					<p class="error">{form.message}</p>
				{/if}

				<div class="buttons">
					<a href={previewUrl} target="_blank" rel="noopener" class="btn-open">Auf Fooby ansehen ↗</a>
					<button type="submit" class="btn-save">Rezept speichern</button>
				</div>
			</form>
		{:else}
			<p class="placeholder">Rezept aus der Liste auswählen für Vorschau.</p>
		{/if}
	</div>
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

	.import-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.panel {
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		padding: 1.25rem;
	}

	/* Search form */
	.search-form {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.search-form input {
		flex: 1;
		padding: 0.65rem 0.875rem;
		font-size: 1rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
	}

	.search-form input:focus {
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(77, 122, 88, 0.15);
	}

	.btn-search {
		padding: 0.65rem 1rem;
		font-size: 0.9rem;
		font-family: inherit;
		font-weight: 500;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-search:hover {
		background: var(--green-dark);
	}

	.basket-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}

	.chip {
		padding: 0.3rem 0.75rem;
		font-size: 0.8rem;
		font-family: inherit;
		background: var(--bg);
		border: 1.5px solid var(--border-strong);
		border-radius: 999px;
		cursor: pointer;
		color: var(--text-muted);
		transition: background 0.1s, color 0.1s;
	}

	.chip:hover {
		background: var(--green);
		color: white;
		border-color: var(--green);
	}

	/* Results list */
	.results-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.results-list li {
		border-radius: var(--radius);
	}

	.results-list li.active .result-btn {
		background: var(--green);
		color: white;
	}

	.result-btn {
		width: 100%;
		text-align: left;
		padding: 0.6rem 0.75rem;
		font-size: 0.9rem;
		font-family: inherit;
		background: none;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		color: var(--text);
		transition: background 0.1s;
	}

	.result-btn:hover {
		background: var(--bg);
	}

	.preview-image {
		width: 100%;
		height: 180px;
		object-fit: cover;
		border-radius: var(--radius);
	}

	/* Preview form */
	.preview-form {
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
		width: 100%;
	}

	input:focus,
	textarea:focus {
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(77, 122, 88, 0.15);
	}

	textarea {
		resize: vertical;
	}

	.placeholder {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.empty {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.error {
		color: var(--red);
		font-size: 0.875rem;
	}

	.buttons {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
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
	}

	.btn-save:hover {
		background: var(--green-dark);
	}

	.btn-open {
		font-size: 0.875rem;
		color: var(--text-muted);
		text-decoration: none;
	}

	.btn-open:hover {
		color: var(--text);
		text-decoration: underline;
	}

	/* Desktop: side by side */
	@media (min-width: 768px) {
		.page-header {
			flex-direction: row;
			align-items: center;
			gap: 1rem;
		}

		.import-layout {
			flex-direction: row;
			align-items: flex-start;
		}

		.panel-left {
			width: 320px;
			flex-shrink: 0;
		}

		.panel-right {
			flex: 1;
		}
	}
</style>
