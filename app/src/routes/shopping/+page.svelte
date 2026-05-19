<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let assignments = $state<Record<string, string>>({});
	let locallyExcluded = $state(new Set<number>());
	let networkError = $state<string | null>(null);

	let sessionDateStart = $state(data.session?.planStart ?? '');
	let sessionDateEnd = $state(data.session?.planEnd ?? '');

	$effect(() => {
		sessionDateStart = data.session?.planStart ?? '';
		sessionDateEnd = data.session?.planEnd ?? '';
	});

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

	let visibleItems = $derived(data.items.filter((item) => !locallyExcluded.has(item.id)));
	let assignmentsJson = $derived(JSON.stringify(assignments));

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
	{#if !data.session}
		<span class="week-label">Woche ab {formatDate(data.weekStart)}</span>
	{/if}
</div>

{#if !data.session}
	<div class="shopping-card">
		<div class="empty-state">
			{#if form && 'sent' in form}
				<p class="success">{form.sent} Artikel hinzugefügt.</p>
			{/if}
			<form
				method="post"
				action="?/createSession"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'error') {
							networkError = 'Verbindungsfehler – bitte erneut versuchen.';
							return;
						}
						networkError = null;
						locallyExcluded = new Set();
						await update();
					};
				}}
			>
				<div class="date-row">
					<label>
						Von
						<input type="date" name="planStart" value={data.defaultDates?.planStart ?? ''} required />
					</label>
					<label>
						Bis
						<input type="date" name="planEnd" value={data.defaultDates?.planEnd ?? ''} required />
					</label>
				</div>
				<div>
					<button type="submit" class="btn-bring">Einkaufsliste erstellen</button>
				</div>
			</form>
			{#if form && 'message' in form}
				<p class="error">{form.message}</p>
			{/if}
		</div>
	</div>
{:else}
	<div class="shopping-card">
		<div class="session-header">
			<form
				method="post"
				action="?/updateDates"
				use:enhance={() => {
					return async ({ update }) => {
						locallyExcluded = new Set();
						await update();
					};
				}}
			>
				<input type="hidden" name="sessionId" value={data.session.id} />
				<div class="date-row">
					<label>
						Von
						<input type="date" name="planStart" bind:value={sessionDateStart} required />
					</label>
					<label>
						Bis
						<input type="date" name="planEnd" bind:value={sessionDateEnd} required />
					</label>
				</div>
				<button type="submit" class="btn-refresh">Aktualisieren</button>
			</form>
		</div>

		<div class="item-scroll">
			{#if visibleItems.length === 0}
				<p class="empty">Alles da — nichts einzukaufen.</p>
			{:else}
				<ul class="item-list">
					{#each visibleItems as item (item.id)}
						<li>
							<span>{item.displayText}</span>
							<div class="item-actions">
								{#if data.bringLists.length === 2}
									<button
										type="button"
										class="list-toggle"
										onclick={() => toggleList(item.displayText)}
									>
										{getListName(item.displayText)}
									</button>
								{/if}
								<form
									method="post"
									action="?/excludeItem"
									use:enhance={() => {
										locallyExcluded = new Set([...locallyExcluded, item.id]);
										return async ({ update }) => update({ reset: false });
									}}
								>
									<input type="hidden" name="itemId" value={item.id} />
									<button type="submit" class="btn-remove-item" title="Entfernen">✕</button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="actions">
			{#if form && 'message' in form}
				<p class="error">{form.message}</p>
			{/if}

			<div class="actions-spacer"></div>

			<form
				method="post"
				action="?/discardSession"
				use:enhance={() => {
					return async ({ update }) => update();
				}}
			>
				<input type="hidden" name="sessionId" value={data.session.id} />
				<button
					type="submit"
					class="btn-discard"
					onclick={(e) => {
						if (!confirm('Einkaufsliste verwerfen?')) e.preventDefault();
					}}
				>
					Verwerfen
				</button>
			</form>

			<form
				method="post"
				action="?/sendToBring"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'error') {
							networkError = 'Verbindungsfehler – bitte erneut versuchen.';
							return;
						}
						networkError = null;
						await update();
					};
				}}
			>
				<input type="hidden" name="sessionId" value={data.session.id} />
				<input type="hidden" name="assignments" value={assignmentsJson} />
				<button type="submit" class="btn-bring">An Bring! senden</button>
			</form>
		</div>
	</div>
{/if}

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
		display: flex;
		flex-direction: column;
		max-height: calc(100dvh - var(--nav-h) - 6rem);
	}

	.item-scroll {
		overflow-y: auto;
		flex: 1;
		-webkit-overflow-scrolling: touch;
	}

	.empty-state {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty-state form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.session-header {
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.session-header form {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.date-row {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.date-row label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.date-row input[type='date'] {
		font-family: inherit;
		font-size: 0.9rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
	}

	.empty {
		color: var(--text-muted);
		padding: 1.25rem;
		margin: 0;
	}

	.empty-state .empty {
		padding: 0;
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
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.875rem 1rem;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.actions-spacer {
		flex: 1;
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

	.btn-refresh {
		padding: 0.35rem 0.75rem;
		font-size: 0.85rem;
		font-family: inherit;
		background: none;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		white-space: nowrap;
	}

	.btn-refresh:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.btn-discard {
		padding: 0.6rem 1rem;
		font-size: 0.9rem;
		font-family: inherit;
		background: none;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.btn-discard:hover {
		color: var(--red, #d94f4f);
		border-color: var(--red, #d94f4f);
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
