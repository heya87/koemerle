<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Track which list each item is assigned to (default: first list)
	let assignments = $state<Record<string, string>>({});

	function getListId(itemText: string): string {
		return assignments[itemText] ?? data.bringLists[0]?.id ?? '';
	}

	function getListName(itemText: string): string {
		const id = getListId(itemText);
		return data.bringLists.find((l) => l.id === id)?.name ?? '';
	}

	function toggleList(itemText: string) {
		const current = getListId(itemText);
		const other = data.bringLists.find((l) => l.id !== current);
		if (other) assignments[itemText] = other.id;
	}

	let assignmentsJson = $derived(JSON.stringify(assignments));

	function formatDate(iso: string): string {
		const [y, m, d] = iso.split('-');
		return `${d}.${m}.${y}`;
	}
</script>

<div class="page-header">
	<h1>Einkaufsliste</h1>
	<span class="week-label">Woche ab {formatDate(data.weekStart)}</span>
</div>

<div class="shopping-card">
	{#if data.shoppingList.length === 0}
		<p class="empty">Alles da — nichts einzukaufen.</p>
	{:else}
		<ul class="item-list">
			{#each data.shoppingList as item}
				<li>
					<span>{item.displayText}</span>
					{#if data.bringLists.length === 2}
						<button type="button" class="list-toggle" onclick={() => toggleList(item.displayText)}>
							{getListName(item.displayText)}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<div class="actions">
		<form method="post" action="?/sendToBring" use:enhance>
			<input type="hidden" name="assignments" value={assignmentsJson} />
			<button type="submit" class="btn-bring">An Bring! senden</button>
		</form>
		{#if form && 'sent' in form}
			<p class="success">{form.sent} Artikel hinzugefügt.</p>
		{/if}
		{#if form && 'message' in form}
			<p class="error">{form.message}</p>
		{/if}
	</div>
</div>

<style>
	.page-header {
		display: flex;
		align-items: baseline;
		gap: 0.875rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.week-label {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.shopping-card {
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		overflow: hidden;
	}

	.empty {
		color: var(--text-muted);
		padding: 1.25rem;
		margin: 0;
	}

	.item-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.item-list li {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border);
		font-size: 0.975rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.item-list li:last-child {
		border-bottom: none;
	}

	.list-toggle {
		font-size: 0.75rem;
		font-family: inherit;
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-raised, #f5f5f5);
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
		transition: background 0.15s, color 0.15s;
	}

	.list-toggle:hover {
		background: var(--green);
		color: white;
		border-color: var(--green);
	}

	.actions {
		padding: 1rem;
		border-top: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.btn-bring {
		padding: 0.6rem 1.25rem;
		font-size: 0.9rem;
		font-family: inherit;
		font-weight: 500;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-bring:hover {
		background: var(--green-dark);
	}

	.success {
		margin: 0;
		font-size: 0.875rem;
		color: var(--green);
	}

	.error {
		margin: 0;
		font-size: 0.875rem;
	}

	@media (min-width: 768px) {
		.shopping-card {
			max-width: 480px;
		}
	}
</style>
