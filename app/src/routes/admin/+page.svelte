<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let addMemberFamilyId: number | null = $state(null);
	let deleteConfirmText: Record<number, string> = $state({});
</script>

<svelte:head><title>Admin — Kömerle</title></svelte:head>

<div class="admin-page">
	<h1>Admin</h1>
	<p class="hint">
		Familien und Zugänge verwalten. Ein neuer Zugang bekommt keinen Login, bis der einmalige
		Link unten geöffnet und ein eigenes Passwort gesetzt wurde — den Link musst du manuell
		(WhatsApp, Signal, …) verschicken.
	</p>

	{#if form?.link}
		<div class="link-box">
			<strong>Link für {form.forName}:</strong>
			<code>{form.link}</code>
			<p class="link-hint">Diesen Link jetzt kopieren und manuell verschicken — er wird hier nicht noch einmal angezeigt.</p>
		</div>
	{/if}
	{#if form?.deletedFamily}
		<div class="link-box">Familie "{form.deletedFamily}" und alle ihre Daten wurden gelöscht.</div>
	{/if}
	{#if form?.message}
		<p class="error">{form.message}</p>
	{/if}

	<section class="new-family">
		<h2>Neue Familie</h2>
		<form
			method="post"
			action="?/createFamily"
			use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}
		>
			<input type="text" name="familyName" placeholder="Familienname" required />
			<input type="text" name="memberName" placeholder="Name der ersten Person" required />
			<input type="email" name="email" placeholder="E-Mail" required />
			<button type="submit">Familie anlegen</button>
		</form>
	</section>

	{#each data.families as family}
		<section class="family-card">
			<div class="family-header">
				<h2>{family.name}</h2>
				<form
					method="post"
					action="?/toggleClaude"
					use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}
				>
					<input type="hidden" name="familyId" value={family.id} />
					<input type="hidden" name="enabled" value={(!family.claudeEnabled).toString()} />
					<button type="submit" class="claude-toggle" class:on={family.claudeEnabled}>
						Claude {family.claudeEnabled ? 'aktiv' : 'aus'}
					</button>
				</form>
			</div>

			<table>
				<thead>
					<tr><th>Name</th><th>E-Mail</th><th>Admin</th><th></th></tr>
				</thead>
				<tbody>
					{#each family.members as member}
						<tr>
							<td>{member.name}</td>
							<td>{member.email}</td>
							<td>{member.isAdmin ? '✓' : ''}</td>
							<td>
								<form
									method="post"
									action="?/resetLink"
									use:enhance={() => async ({ update }) => { await update(); }}
								>
									<input type="hidden" name="userId" value={member.id} />
									<button type="submit" class="btn-link">Link erzeugen</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if addMemberFamilyId === family.id}
				<form
					method="post"
					action="?/addMember"
					class="add-member-form"
					use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); addMemberFamilyId = null; }}
				>
					<input type="hidden" name="familyId" value={family.id} />
					<input type="text" name="memberName" placeholder="Name" required />
					<input type="email" name="email" placeholder="E-Mail" required />
					<button type="submit">Hinzufügen</button>
					<button type="button" onclick={() => (addMemberFamilyId = null)}>Abbrechen</button>
				</form>
			{:else}
				<button type="button" class="btn-link" onclick={() => (addMemberFamilyId = family.id)}>+ Person hinzufügen</button>
			{/if}

			{#if family.id === data.currentFamilyId}
				<p class="hint delete-hint">(Eigene Familie kann hier nicht gelöscht werden.)</p>
			{:else}
				<details class="delete-family">
					<summary>Familie löschen</summary>
					<form
						method="post"
						action="?/deleteFamily"
						use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); deleteConfirmText[family.id] = ''; }}
					>
						<input type="hidden" name="familyId" value={family.id} />
						<p class="delete-warning">
							Löscht unwiderruflich alle Zugänge, Rezepte, Pläne, den Gemüsekorb und die
							Einkaufsliste dieser Familie. Zum Bestätigen Familiennamen eingeben:
						</p>
						<input
							type="text"
							name="confirmName"
							placeholder={family.name}
							bind:value={deleteConfirmText[family.id]}
						/>
						<button type="submit" class="btn-delete" disabled={deleteConfirmText[family.id] !== family.name}>
							Endgültig löschen
						</button>
					</form>
				</details>
			{/if}
		</section>
	{/each}

	<section class="cron-section">
		<h2>Cron — Gemüsekorb-Sync</h2>
		<p class="hint">Automatische Biogmüsabo-Synchronisierungen über alle Familien. Läuft gemäss <code>BASKET_SYNC_CRON</code> (Standard: stündlich montags).</p>

		{#if data.cronRuns.length === 0}
			<p class="hint">Noch keine Läufe aufgezeichnet.</p>
		{:else}
			<table>
				<thead>
					<tr><th>Zeit</th><th>Familie</th><th>Ergebnis</th><th>Detail</th></tr>
				</thead>
				<tbody>
					{#each data.cronRuns as run}
						<tr>
							<td class="col-time">{new Date(run.ranAt).toLocaleString('de-CH')}</td>
							<td>{run.familyName}</td>
							<td><span class="outcome-badge outcome-{run.outcome}">{run.outcome}</span></td>
							<td class="col-detail">{run.detail ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>

<style>
	.admin-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	h1 { font-size: 1.5rem; }
	h2 { font-size: 1.1rem; }

	.hint {
		color: var(--text-muted);
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.link-box {
		background: var(--green-light, #eaf4ec);
		border: 1px solid var(--green);
		border-radius: var(--radius);
		padding: 1rem;
	}

	.link-box code {
		display: block;
		word-break: break-all;
		margin-top: 0.35rem;
		font-size: 0.85rem;
	}

	.link-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.error {
		color: var(--red, #c0392b);
		font-size: 0.875rem;
	}

	.new-family form,
	.add-member-form {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	input {
		flex: 1;
		min-width: 140px;
		padding: 0.5rem 0.7rem;
		font-size: 0.9rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
	}

	button {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		white-space: nowrap;
	}

	.family-card {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
	}

	.family-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.claude-toggle {
		background: none;
		border: 1.5px solid var(--border-strong);
		color: var(--text-muted);
	}

	.claude-toggle.on {
		background: var(--green);
		color: white;
		border-color: var(--green);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
	}

	th {
		text-align: left;
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--text-muted);
		padding: 0.3rem 0.4rem;
		border-bottom: 1px solid var(--border);
	}

	td {
		padding: 0.3rem 0.4rem;
		border-bottom: 1px solid var(--border);
	}

	.btn-link {
		background: none;
		color: var(--green-dark, var(--green));
		font-weight: 500;
		padding: 0.3rem 0.5rem;
	}

	.delete-family {
		margin-top: 0.75rem;
	}

	.delete-family summary {
		cursor: pointer;
		font-size: 0.8rem;
		color: var(--red, #c0392b);
		font-weight: 500;
	}

	.delete-family form {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		margin-top: 0.6rem;
		padding: 0.75rem;
		border: 1px solid var(--red, #c0392b);
		border-radius: var(--radius);
	}

	.delete-warning {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}

	.btn-delete {
		background: var(--red, #c0392b);
	}

	.btn-delete:disabled {
		background: var(--border-strong);
		color: var(--text-muted);
		cursor: not-allowed;
	}

	.delete-hint {
		margin-top: 0.75rem;
		font-size: 0.8rem;
	}

	.cron-section {
		border-top: 1px solid var(--border);
		padding-top: 1.5rem;
	}

	.col-time {
		white-space: nowrap;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.col-detail {
		font-size: 0.8rem;
		color: var(--text-muted);
		word-break: break-word;
		max-width: 16rem;
	}

	.outcome-badge {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.outcome-imported { background: #e6f4ea; color: #2e7d32; }
	.outcome-already_done { background: #f0f4ff; color: #3949ab; }
	.outcome-no_delivery { background: #fff8e1; color: #f57f17; }
	.outcome-error { background: #fdf0f0; color: var(--red, #c0392b); }
</style>
