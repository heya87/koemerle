<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="header">
	<h1>Rezepte</h1>
	<a href="/recipes/new" class="button">+ Neues Rezept</a>
</div>

{#if data.recipes.length === 0}
	<p>Noch keine Rezepte vorhanden.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th>Zutaten (Schlüssel)</th>
				<th>Link</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.recipes as recipe}
				<tr>
					<td>{recipe.name}</td>
					<td class="keys">{recipe.matchKeys.join(', ')}</td>
					<td>
						{#if recipe.recipeUrl}
							<a href={recipe.recipeUrl} target="_blank" rel="noopener">Öffnen</a>
						{/if}
					</td>
					<td class="actions">
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
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.button {
		padding: 0.5rem 1rem;
		text-decoration: none;
		border: 1px solid #333;
		border-radius: 4px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th, td {
		text-align: left;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid #eee;
	}

	th {
		font-weight: 600;
		border-bottom: 2px solid #ccc;
	}

	.keys {
		font-size: 0.85rem;
		color: #555;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.actions a, .actions button {
		font-size: 0.9rem;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
		text-decoration: underline;
		color: inherit;
	}

	.actions button {
		color: #c00;
	}
</style>
