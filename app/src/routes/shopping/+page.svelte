<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let assignments = $state<Record<string, string>>({});
	let locallyExcluded = $state(new Set<number>());
	let networkError = $state<string | null>(null);

	let lagerDialog: HTMLDialogElement | undefined = $state();
	let lagerDialogItem = $state<ShoppingItem | null>(null);
	let lagerDialogText = $state('');

	function openLagerDialog(item: ShoppingItem) {
		lagerDialogItem = item;
		lagerDialogText = item.lagerSuggestion;
		lagerDialog?.showModal();
	}

	let sessionDateStart = $state(data.session?.planStart ?? '');
	let sessionDateEnd = $state(data.session?.planEnd ?? '');

	$effect(() => {
		sessionDateStart = data.session?.planStart ?? '';
		sessionDateEnd = data.session?.planEnd ?? '';
	});

	type ShoppingItem = (typeof data.items)[number];

	function getListId(item: ShoppingItem): string {
		return assignments[item.displayText] ?? item.preferredListId ?? data.bringLists[0]?.id ?? '';
	}

	function getListName(item: ShoppingItem): string {
		const id = getListId(item);
		return data.bringLists.find((l) => l.id === id)?.name ?? '';
	}

	function getListSlot(item: ShoppingItem): 0 | 1 {
		const id = getListId(item);
		return data.bringLists.findIndex((l) => l.id === id) === 1 ? 1 : 0;
	}

	function toggleList(item: ShoppingItem) {
		const current = getListId(item);
		const other = data.bringLists.find((l) => l.id !== current);
		if (other) assignments[item.displayText] = other.id;
	}

	let visibleItems = $derived(data.items.filter((item) => !locallyExcluded.has(item.id)));
	// Resolve every item's list explicitly (not just manually-toggled ones), so the
	// server knows exactly what was used — including learned defaults — for both
	// sending to Bring! and updating the learned preference afterwards.
	let assignmentsJson = $derived(
		JSON.stringify(Object.fromEntries(data.items.map((item) => [item.displayText, getListId(item)])))
	);

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
						<li class:list-slot-0={getListSlot(item) === 0} class:list-slot-1={getListSlot(item) === 1}>
							<span class="item-text">{item.displayText}</span>
							<div class="item-actions">
									<button
										type="button"
										class="btn-to-lager"
										title="In die Vorratskammer verschieben"
										onclick={() => openLagerDialog(item)}
									>
										→ Vorrat
									</button>
									{#if data.bringLists.length === 2}
									<button
										type="button"
										class="list-toggle"
										class:list-toggle-1={getListSlot(item) === 1}
										onclick={() => toggleList(item)}
									>
										{getListName(item)}
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

<dialog bind:this={lagerDialog} class="lager-dialog" onclose={() => (lagerDialogItem = null)}>
	{#if lagerDialogItem}
		<form
			method="post"
			action="?/moveToLager"
			use:enhance={() => {
				const id = lagerDialogItem!.id;
				return async ({ result, update }) => {
					if (result.type === 'success') {
						locallyExcluded = new Set([...locallyExcluded, id]);
						lagerDialog?.close();
					}
					await update({ reset: false });
				};
			}}
		>
			<h3>In die Vorratskammer</h3>
			<input type="hidden" name="itemId" value={lagerDialogItem.id} />
			<input type="text" name="displayText" bind:value={lagerDialogText} required />
			<div class="lager-dialog-actions">
				<button type="button" class="btn-discard" onclick={() => lagerDialog?.close()}>Abbrechen</button>
				<button type="submit" class="btn-bring">Hinzufügen</button>
			</div>
		</form>
	{/if}
</dialog>

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
		padding: 0.75rem 1rem 0.75rem 0.8rem;
		border-bottom: 1px solid var(--border);
		border-left: 4px solid transparent;
		font-size: 0.975rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.item-list li:last-child {
		border-bottom: none;
	}

	/* Visually tell the two Bring! lists apart at a glance (e.g. Unverpackt vs. Liebesnest) */
	.item-list li.list-slot-0 {
		border-left-color: var(--green);
		background: color-mix(in srgb, var(--green) 8%, transparent);
	}

	.item-list li.list-slot-1 {
		border-left-color: #5b4fcf;
		background: color-mix(in srgb, #5b4fcf 8%, transparent);
	}

	.item-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.item-text::before {
		content: '';
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 2px;
		flex-shrink: 0;
		background: var(--green);
	}

	.list-slot-1 .item-text::before {
		border-radius: 50%;
		background: #5b4fcf;
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

	.btn-to-lager {
		background: none;
		border: 1px solid var(--border);
		color: var(--text-muted);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.75rem;
		white-space: nowrap;
		padding: 0.2rem 0.5rem;
		border-radius: var(--radius);
		transition: color 0.15s, border-color 0.15s;
	}

	.btn-to-lager:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.list-toggle {
		font-size: 0.75rem;
		font-family: inherit;
		font-weight: 500;
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--green);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--green) 18%, var(--surface));
		color: var(--green-dark, var(--green));
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
		transition: background 0.15s, color 0.15s;
	}

	.list-toggle-1 {
		border-color: #5b4fcf;
		background: color-mix(in srgb, #5b4fcf 18%, var(--surface));
		color: #5b4fcf;
	}

	.list-toggle:hover {
		background: var(--green);
		color: white;
	}

	.list-toggle-1:hover {
		background: #5b4fcf;
		color: white;
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

	.lager-dialog {
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: 0 8px 32px rgba(42, 37, 32, 0.18);
		padding: 1.25rem;
		width: min(360px, 92vw);
		background: var(--surface);
		color: var(--text);
	}

	.lager-dialog::backdrop {
		background: rgba(42, 37, 32, 0.45);
	}

	.lager-dialog h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}

	.lager-dialog input[type='text'] {
		width: 100%;
		box-sizing: border-box;
		font-family: inherit;
		font-size: 0.95rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
	}

	.lager-dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 1rem;
	}
</style>
