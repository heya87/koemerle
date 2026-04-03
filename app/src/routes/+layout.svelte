<script lang="ts">
	import '../app.css';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data }: { children: any; data: LayoutData } = $props();

	let settingsDialog: HTMLDialogElement | undefined = $state();
	let activeTab: 'synonyms' = $state('synonyms');
	let newCanonical = $state('');
	let newAlias = $state('');

	function openSettings() {
		newCanonical = '';
		newAlias = '';
		settingsDialog?.showModal();
	}

	function closeSettings() {
		settingsDialog?.close();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user}
	<header class="top-bar">
		<span class="brand">Kömerle</span>
		<nav class="desktop-nav">
			<a href="/plan">Wochenplan</a>
			<a href="/recipes">Rezepte</a>
			<a href="/basket">Gemüsekorb</a>
			<a href="/shopping">Einkaufen</a>
		</nav>
		<div class="user-area">
			<span class="username">{data.user.name}</span>
			<button class="btn-settings" type="button" onclick={openSettings} title="Einstellungen">⚙</button>
			<form method="post" action="/logout" use:enhance>
				<button type="submit" class="btn-logout">Abmelden</button>
			</form>
		</div>
	</header>

	<dialog bind:this={settingsDialog} class="settings-dialog">
		<div class="settings-content">
			<div class="settings-header">
				<h2>Einstellungen</h2>
				<button class="settings-close" onclick={closeSettings} type="button" aria-label="Schliessen">✕</button>
			</div>

			<nav class="settings-tabs">
				<button
					type="button"
					class="settings-tab"
					class:active={activeTab === 'synonyms'}
					onclick={() => (activeTab = 'synonyms')}
				>Synonyme</button>
			</nav>

			{#if activeTab === 'synonyms'}
				<div class="settings-section">
					<div class="settings-info-box">
						Hier werden Synonyme erfasst, die beim Abgleich von Gemüsekorb-Inhalten mit Rezept-Zutaten verwendet werden.
						Eine Variante (z.B. ein Dialektwort oder eine andere Schreibweise) wird einer Grundform zugeordnet —
						z.B. "rüebli" → "rüben".
					</div>

					<table class="synonym-table">
						<thead>
							<tr>
								<th>Grundform</th>
								<th>Variante</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each data.synonyms as s}
								<tr>
									<td>{s.canonical}</td>
									<td>{s.alias}</td>
									<td>
										<form
											method="post"
											action="/settings?/deleteSynonym"
											use:enhance={() => async ({ update }) => {
												await update();
												await invalidateAll();
											}}
										>
											<input type="hidden" name="id" value={s.id} />
											<button type="submit" class="btn-delete-synonym">✕</button>
										</form>
									</td>
								</tr>
							{:else}
								<tr><td colspan="3" class="empty-synonyms">Noch keine Synonyme.</td></tr>
							{/each}
						</tbody>
					</table>

					<form
						method="post"
						action="/settings?/addSynonym"
						class="add-synonym-form"
						use:enhance={() => async ({ update }) => {
							await update();
							await invalidateAll();
							newCanonical = '';
							newAlias = '';
						}}
					>
						<input
							type="text"
							name="canonical"
							placeholder="Grundform (z.B. rüben)"
							bind:value={newCanonical}
							required
						/>
						<input
							type="text"
							name="alias"
							placeholder="Variante (z.B. rüebli)"
							bind:value={newAlias}
							required
						/>
						<button type="submit" class="btn-add-synonym">Hinzufügen</button>
					</form>
				</div>
			{/if}
		</div>
	</dialog>

	<nav class="tab-bar">
		<a href="/plan">Wochenplan</a>
		<a href="/recipes">Rezepte</a>
		<a href="/basket">Gemüsekorb</a>
		<a href="/shopping">Einkaufen</a>
	</nav>
{/if}

<main class:with-tabs={!!data.user}>
	{@render children()}
</main>

<style>
	/* ── Top bar ── */
	.top-bar {
		position: sticky;
		top: 0;
		z-index: 20;
		height: var(--nav-h);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		padding: 0 1rem;
		gap: 1rem;
	}

	.brand {
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--green);
		letter-spacing: -0.01em;
		flex-shrink: 0;
	}

	.desktop-nav {
		display: none;
	}

	.user-area {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.username {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.btn-settings {
		background: none;
		border: none;
		font-size: 1.1rem;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.2rem;
		line-height: 1;
		transition: color 0.15s;
	}

	.btn-settings:hover {
		color: var(--text);
	}

	.btn-logout {
		font-size: 0.875rem;
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		padding: 0.3rem 0.75rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.btn-logout:hover {
		background: var(--bg);
		color: var(--text);
	}

	/* ── Settings dialog ── */
	.settings-dialog {
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: 0 8px 32px rgba(42, 37, 32, 0.18);
		padding: 0;
		width: min(640px, 94vw);
		max-height: 88vh;
		overflow-y: auto;
	}

	.settings-dialog::backdrop {
		background: rgba(42, 37, 32, 0.45);
	}

	.settings-content {
		display: flex;
		flex-direction: column;
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem 0;
	}

	.settings-header h2 {
		font-size: 1.1rem;
	}

	.settings-close {
		background: none;
		border: none;
		font-size: 1rem;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		line-height: 1;
	}

	.settings-close:hover {
		color: var(--text);
	}

	.settings-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border);
		padding: 0 1.5rem;
		margin-top: 1rem;
	}

	.settings-tab {
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		color: var(--text-muted);
		cursor: pointer;
		margin-bottom: -1px;
		transition: color 0.15s, border-color 0.15s;
	}

	.settings-tab:hover {
		color: var(--text);
	}

	.settings-tab.active {
		color: var(--text);
		border-bottom-color: var(--green);
	}

	.settings-section {
		padding: 1.25rem 1.5rem;
	}

	.settings-info-box {
		font-size: 0.82rem;
		color: var(--text-muted);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin-bottom: 1.25rem;
		line-height: 1.55;
	}

	.synonym-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.synonym-table th {
		text-align: left;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--border);
	}

	.synonym-table td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--border);
		color: var(--text);
	}

	.synonym-table tbody tr:last-child td {
		border-bottom: none;
	}

	.empty-synonyms {
		color: var(--text-muted);
		font-style: italic;
	}

	.btn-delete-synonym {
		background: none;
		border: none;
		color: var(--text-light);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}

	.btn-delete-synonym:hover {
		color: var(--red);
		background: #fdf0f0;
	}

	.add-synonym-form {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	.add-synonym-form input {
		flex: 1;
		min-width: 120px;
		padding: 0.45rem 0.6rem;
		font-size: 0.875rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
	}

	.add-synonym-form input:focus {
		border-color: var(--green);
	}

	.btn-add-synonym {
		padding: 0.45rem 1rem;
		font-size: 0.875rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
	}

	.btn-add-synonym:hover {
		background: var(--green-dark);
	}

	/* ── Bottom tab bar (mobile) ── */
	.tab-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 20;
		height: var(--tab-h);
		background: var(--surface);
		border-top: 1px solid var(--border);
		display: flex;
	}

	.tab-bar a {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
		transition: color 0.15s;
	}

	.tab-bar a:hover {
		color: var(--green);
	}

	/* ── Main content ── */
	main {
		padding: 1.25rem 1rem;
		max-width: var(--max-w);
		margin: 0 auto;
	}

	main.with-tabs {
		padding-bottom: calc(var(--tab-h) + 1.25rem);
	}

	/* ── Desktop ── */
	@media (min-width: 768px) {
		.top-bar {
			padding: 0 2rem;
			gap: 2rem;
		}

		.desktop-nav {
			display: flex;
			gap: 1.75rem;
		}

		.desktop-nav a {
			text-decoration: none;
			font-size: 0.95rem;
			color: var(--text-muted);
			font-weight: 500;
			transition: color 0.15s;
		}

		.desktop-nav a:hover {
			color: var(--text);
		}

		.tab-bar {
			display: none;
		}

		main {
			padding: 2rem 1.5rem;
		}

		main.with-tabs {
			padding-bottom: 2rem;
		}
	}
</style>
