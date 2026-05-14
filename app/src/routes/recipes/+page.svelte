<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filter = $state('');
	let filteredRecipes = $derived(
		filter.trim() === ''
			? data.recipes
			: data.recipes.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))
	);
</script>

<div class="page-header">
	<h1>Rezepte</h1>
	<div class="header-actions">
		<a href="/recipes/import" class="btn-import">Fooby Import</a>
		<a href="/recipes/new" class="btn-new">+ Neues Rezept</a>
	</div>
</div>

<input
	type="text"
	class="recipe-filter"
	placeholder="Rezepte filtern…"
	bind:value={filter}
/>

{#if data.recipes.length === 0}
	<p class="empty">Noch keine Rezepte vorhanden.</p>
{:else if filteredRecipes.length === 0}
	<p class="empty">Kein Rezept gefunden.</p>
{:else}
	<!-- Mobile: card list -->
	<ul class="card-list">
		{#each filteredRecipes as recipe}
			<li class="recipe-card">
				<div class="card-main">
					<a
						href={recipe.recipeUrl ?? `/recipes/${recipe.id}/edit`}
						target={recipe.recipeUrl ? '_blank' : undefined}
						rel={recipe.recipeUrl ? 'noopener' : undefined}
						class="card-name"
					>{recipe.name}</a>
					<span class="card-course">{recipe.course === 'main' ? 'Hauptgang' : recipe.course === 'side' ? 'Beilage' : 'Beide'}</span>
					{#if recipe.servings}
						<span class="card-servings">{recipe.servings} P.</span>
					{/if}
					{#if recipe.preparation}
						<p class="card-preparation">{recipe.preparation}</p>
					{/if}
				</div>
				<div class="card-actions">
					<a href="/recipes/{recipe.id}/edit" class="action-edit">Bearbeiten</a>
					<form method="post" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={recipe.id} />
						<button
							type="submit"
							class="action-delete"
							onclick={(e) => {
								if (!confirm(`"${recipe.name}" wirklich löschen?`)) e.preventDefault();
							}}
						>
							Löschen
						</button>
					</form>
				</div>
			</li>
		{/each}
	</ul>

	<!-- Desktop: table -->
	<table class="recipe-table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Gang</th>
				<th>Personen</th>
				<th>Zutaten (Schlüssel)</th>
				<th>Link</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each filteredRecipes as recipe}
				<tr>
					<td class="col-name">
						<a
							href={recipe.recipeUrl ?? `/recipes/${recipe.id}/edit`}
							target={recipe.recipeUrl ? '_blank' : undefined}
							rel={recipe.recipeUrl ? 'noopener' : undefined}
						>{recipe.name}</a>
					</td>
					<td class="col-course">{recipe.course === 'main' ? 'Hauptgang' : recipe.course === 'side' ? 'Beilage' : 'Beide'}</td>
					<td class="col-servings">{recipe.servings ?? '—'}</td>
					<td class="col-keys">{recipe.matchKeys.join(', ')}</td>
					<td class="col-link">
						{#if recipe.recipeUrl}
							<a href={recipe.recipeUrl} target="_blank" rel="noopener">Öffnen</a>
						{/if}
					</td>
					<td>
						<div class="col-actions">
							<a href="/recipes/{recipe.id}/edit">Bearbeiten</a>
							<form method="post" action="?/delete" use:enhance>
								<input type="hidden" name="id" value={recipe.id} />
								<button
									type="submit"
									onclick={(e) => {
										if (!confirm(`"${recipe.name}" wirklich löschen?`)) e.preventDefault();
									}}
								>
									Löschen
								</button>
							</form>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.recipe-filter {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
		margin-bottom: 1.25rem;
		box-sizing: border-box;
	}

	.recipe-filter:focus {
		border-color: var(--green);
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.btn-import {
		display: inline-flex;
		align-items: center;
		padding: 0.55rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
		font-family: inherit;
		text-decoration: none;
		background: var(--surface);
		color: var(--text-muted);
		border-radius: var(--radius);
		border: 1.5px solid var(--border-strong);
		transition: color 0.15s;
	}

	.btn-import:hover {
		color: var(--text);
	}

	.btn-new {
		display: inline-flex;
		align-items: center;
		padding: 0.55rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
		font-family: inherit;
		text-decoration: none;
		background: var(--green);
		color: white;
		border-radius: var(--radius);
		transition: background 0.15s;
	}

	.btn-new:hover {
		background: var(--green-dark);
	}

	.empty {
		color: var(--text-muted);
	}

	/* ── Mobile: card list ── */
	.card-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.recipe-card {
		background: var(--surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 0.875rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.card-course,
	.card-servings {
		font-size: 0.775rem;
		color: var(--text-muted);
	}

	.card-main {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.card-name {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text);
		text-decoration: none;
	}

	.card-name:hover {
		color: var(--green);
		text-decoration: underline;
	}

	.card-preparation {
		font-size: 0.8rem;
		color: var(--text-muted);
		white-space: pre-wrap;
		margin: 0;
	}

	.card-link {
		font-size: 0.8rem;
		color: var(--green);
		text-decoration: none;
	}

	.card-link:hover {
		text-decoration: underline;
	}

	.card-actions {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		flex-shrink: 0;
	}

	.action-edit {
		font-size: 0.875rem;
		color: var(--text-muted);
		text-decoration: none;
	}

	.action-edit:hover {
		color: var(--text);
		text-decoration: underline;
	}

	.action-delete {
		font-size: 0.875rem;
		background: none;
		border: none;
		padding: 0;
		color: var(--red);
		cursor: pointer;
		font-family: inherit;
		text-decoration: underline;
	}

	.action-delete:hover {
		opacity: 0.75;
	}

	/* Hide desktop table on mobile */
	.recipe-table {
		display: none;
	}

	/* ── Desktop ── */
	@media (min-width: 768px) {
		/* Hide mobile cards on desktop */
		.card-list {
			display: none;
		}

		.recipe-table {
			display: table;
			width: 100%;
			border-collapse: collapse;
			background: var(--surface);
			border-radius: var(--radius-lg);
			box-shadow: var(--shadow);
			overflow: hidden;
		}

		th,
		td {
			text-align: left;
			padding: 0.75rem 1rem;
			border-bottom: 1px solid var(--border);
		}

		th {
			font-size: 0.8rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--text-muted);
			background: var(--bg);
		}

		tbody tr:last-child td {
			border-bottom: none;
		}

		tbody tr:hover td {
			background: #faf9f7;
		}

		.col-name a {
			color: var(--text);
			text-decoration: none;
			font-weight: 500;
		}

		.col-name a:hover {
			color: var(--green);
			text-decoration: underline;
		}

		.col-course,
		.col-servings {
			font-size: 0.875rem;
			color: var(--text-muted);
			white-space: nowrap;
		}

		.col-keys {
			font-size: 0.85rem;
			color: var(--text-muted);
		}

		.col-link a {
			font-size: 0.875rem;
			color: var(--green);
			text-decoration: none;
		}

		.col-link a:hover {
			text-decoration: underline;
		}

		.col-actions {
			display: flex;
			align-items: center;
			gap: 1rem;
		}

		.col-actions a,
		.col-actions button {
			font-size: 0.875rem;
			background: none;
			border: none;
			padding: 0;
			cursor: pointer;
			font-family: inherit;
			color: var(--text-muted);
			text-decoration: none;
		}

		.col-actions a:hover {
			color: var(--text);
			text-decoration: underline;
		}

		.col-actions button {
			color: var(--red);
			text-decoration: underline;
		}

		.col-actions button:hover {
			opacity: 0.75;
		}
	}
</style>
