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

	let removed = $state(new Set<string>());
	let visibleList = $derived(data.shoppingList.filter((item) => !removed.has(item.matchKey)));
	let networkError = $state<string | null>(null);

	function formatDate(iso: string): string {
		const [y, m, d] = iso.split('-');
		return `${d}.${m}.${y}`;
	}
</script>

{#if networkError}
	<div class="network-error-banner">
		<span>{networkError}</span>
		<button type="button" class="btn-dismiss-error" onclick={() => (networkError = null)}>✕</button>
	</div>
{/if}

<div class="page-header">
	<h1>Einkaufsliste</h1>
	<span class="week-label">Woche ab {formatDate(data.weekStart)}</span>
</div>

<div class="shopping-card">
	{#if visibleList.length === 0}
		<p class="empty">Alles da — nichts einzukaufen.</p>
	{:else}
		<ul class="item-list">
			{#each visibleList as item}
				<li>
					<span>{item.displayText}</span>
					<div class="item-actions">
						{#if data.bringLists.length === 2}
							<button type="button" class="list-toggle" onclick={() => toggleList(item.displayText)}>
								{getListName(item.displayText)}
							</button>
						{/if}
						<button type="button" class="btn-remove-item" title="Entfernen" onclick={() => removed = new Set([...removed, item.matchKey])}>✕</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="actions">
		<form method="post" action="?/sendToBring" use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'error') {
					networkError = 'Verbindungsfehler – bitte erneut versuchen.';
					return;
				}
				networkError = null;
				await update();
			};
		}}>
			<input type="hidden" name="assignments" value={assignmentsJson} />
			<input type="hidden" name="removed" value={JSON.stringify([...removed])} />
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

	.item-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.btn-remove-item {
		background: none;
		border: none;
		color: var(--text-light);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}

	.btn-remove-item:hover {
		color: var(--red, #d94f4f);
		background: #fdf0f0;
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

	.network-error-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: #fdf0f0;
		border: 1.5px solid var(--red, #d94f4f);
		border-radius: var(--radius);
		padding: 0.6rem 0.875rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		color: var(--red, #d94f4f);
	}

	.btn-dismiss-error {
		background: none;
		border: none;
		color: var(--red, #d94f4f);
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0.1rem 0.3rem;
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.shopping-card {
			max-width: 480px;
		}
	}
</style>
