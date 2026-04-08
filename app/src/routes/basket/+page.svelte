<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		if (form && 'synced' in form) {
			clearTimeout(toastTimer);
			toast = `${form.synced} Artikel synchronisiert`;
			toastTimer = setTimeout(() => (toast = ''), 3000);
		}
	});
</script>

<div class="page-header">
	<h1>Gemüsekorb</h1>
	<span class="week-label">Woche ab {data.weekStart}</span>
	{#if data.bioaboConfigured}
		<form method="post" action="?/sync" use:enhance class="sync-form">
			<button type="submit" class="btn-sync">↻ Von Biogmüsabo</button>
		</form>
	{/if}
</div>

<div class="basket-card">
	{#if data.items.length === 0}
		<p class="empty">Noch keine Zutaten im Gemüsekorb.</p>
	{:else}
		<ul class="item-list">
			{#each data.items as item}
				<li>
					<span class="display">{item.displayText}</span>
					<form method="post" action="?/updateKey" use:enhance={() => async ({ update }) => update({ reset: false })} class="key-form">
						<input type="hidden" name="id" value={item.id} />
						<input
							type="text"
							name="matchKey"
							value={item.matchKey}
							class="key-input"
							onblur={(e) => e.currentTarget.form?.requestSubmit()}
							onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
						/>
					</form>
					<form method="post" action="?/remove" use:enhance>
						<input type="hidden" name="id" value={item.id} />
						<button type="submit" class="remove" title="Entfernen">✕</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="post" action="?/add" use:enhance class="add-form">
		<input type="text" name="displayText" placeholder="z.B. 3 Karotten" required autofocus />
		<button type="submit" class="btn-add">Hinzufügen</button>
	</form>

	{#if form?.message}
		<p class="error">{form.message}</p>
	{/if}
</div>

{#if toast}
	<div class="toast">{toast}</div>
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

	.sync-form {
		margin-left: auto;
	}

	.btn-sync {
		padding: 0.4rem 0.875rem;
		font-size: 0.85rem;
		font-family: inherit;
		font-weight: 500;
		background: var(--surface);
		color: var(--text-muted);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s;
	}

	.btn-sync:hover {
		color: var(--text);
	}

	.basket-card {
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

	li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.display {
		font-size: 0.975rem;
	}

	.key-form {
		display: contents;
	}

	.key-input {
		font-size: 0.775rem;
		color: var(--text-light);
		background: var(--bg);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		border: 1px solid transparent;
		font-family: inherit;
		width: 8rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.key-input:hover {
		border-color: var(--border-strong);
	}

	.key-input:focus {
		border-color: var(--green);
		color: var(--text);
	}

	.remove {
		margin-left: auto;
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--text-light);
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0.3rem 0.5rem;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
		line-height: 1;
	}

	.remove:hover {
		color: var(--red);
		background: #fdf0f0;
	}

	.add-form {
		display: flex;
		gap: 0.5rem;
		padding: 0.875rem 1rem;
	}

	.add-form input {
		flex: 1;
		padding: 0.6rem 0.875rem;
		font-size: 0.975rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.add-form input:focus {
		border-color: var(--green);
		box-shadow: 0 0 0 3px rgba(77, 122, 88, 0.15);
		background: var(--surface);
	}

	.btn-add {
		padding: 0.6rem 1.1rem;
		font-size: 0.9rem;
		font-family: inherit;
		font-weight: 500;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
	}

	.btn-add:hover {
		background: var(--green-dark);
	}

	.error {
		padding: 0 1rem 1rem;
	}

	.toast {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--text);
		color: var(--bg);
		padding: 0.6rem 1.25rem;
		border-radius: var(--radius);
		font-size: 0.9rem;
		box-shadow: var(--shadow);
		pointer-events: none;
	}

	/* Desktop */
	@media (min-width: 768px) {
		.basket-card {
			max-width: 560px;
		}
	}
</style>
