<script lang="ts">
	import '../app.css';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data }: { children: any; data: LayoutData } = $props();

	let settingsDialog: HTMLDialogElement | undefined = $state();
	let activeTab: 'account' | 'family' | 'groups' | 'plants' | 'stores' | 'recipes' | 'claude' = $state('account');
	let newListPrefKey = $state('');
	let newListPrefIndex = $state(0);
	let claudePromptValue = $state('');
	let newGroupLabel = $state('');
	let newGroupKeys = $state('');
	let importResult: { imported: number; skipped: number } | null = $state(null);
	let selectedFileName = $state('');
	let mobileMenuOpen = $state(false);
	let passwordMessage: { type: 'success' | 'error'; text: string } | null = $state(null);
	let bringListsFound: { id: string; name: string }[] | null = $state(null);
	let bringLookupMessage: { type: 'success' | 'error'; text: string } | null = $state(null);
	let familyMessage: { type: 'success' | 'error'; text: string } | null = $state(null);

	$effect(() => {
		page.url.pathname;
		mobileMenuOpen = false;
	});

	function openSettings() {
		newGroupLabel = '';
		newGroupKeys = '';
		claudePromptValue = data.claudePrompt ?? '';
		passwordMessage = null;
		bringListsFound = null;
		bringLookupMessage = null;
		familyMessage = null;
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
	<div class="top-bar-inner">
		<span class="brand">Kömerle</span>
		<nav class="mobile-quick-nav">
			<a href="/plan" class:active={page.url.pathname.startsWith('/plan')} title="Wochenplan" aria-label="Wochenplan">📅</a>
			<a href="/recipes" class:active={page.url.pathname.startsWith('/recipes')} title="Rezepte" aria-label="Rezepte">📖</a>
			<a href="/basket" class:active={page.url.pathname.startsWith('/basket')} title="Gemüsekorb" aria-label="Gemüsekorb">🧺</a>
		</nav>
		<nav class="desktop-nav">
			<a href="/plan" class:active={page.url.pathname.startsWith('/plan')}>Wochenplan</a>
			<a href="/recipes" class:active={page.url.pathname.startsWith('/recipes')}>Rezepte</a>
			<a href="/basket" class:active={page.url.pathname.startsWith('/basket')}>Gemüsekorb</a>
			<a href="/lager" class:active={page.url.pathname.startsWith('/lager')}>Vorratskammer</a>
			<a href="/shopping" class:active={page.url.pathname.startsWith('/shopping')}>Einkaufen</a>
			<a href="/clara" class:active={page.url.pathname.startsWith('/clara')}>Clara</a>
			{#if data.user.isAdmin}
				<a href="/admin" class:active={page.url.pathname.startsWith('/admin')}>Admin</a>
			{/if}
		</nav>
		<div class="user-area">
			<span class="username">{data.user.name}</span>
			<button class="btn-settings" type="button" onclick={openSettings} title="Einstellungen">⚙</button>
			<form method="post" action="/logout" use:enhance>
				<button type="submit" class="btn-logout">Abmelden</button>
			</form>
		</div>
		<div class="mobile-header-right">
			<span class="username">{data.user.name}</span>
			<button class="btn-hamburger" type="button" onclick={() => (mobileMenuOpen = !mobileMenuOpen)} aria-label="Menü">
				<span class="ham-lines"><span></span><span></span><span></span></span>
			</button>
		</div>
	</div>
	</header>

	{#if mobileMenuOpen}
		<div class="mobile-menu-backdrop" onclick={() => (mobileMenuOpen = false)}></div>
		<nav class="mobile-menu">
			<a href="/plan" class:active={page.url.pathname.startsWith('/plan')}>Wochenplan</a>
			<a href="/recipes" class:active={page.url.pathname.startsWith('/recipes')}>Rezepte</a>
			<a href="/basket" class:active={page.url.pathname.startsWith('/basket')}>Gemüsekorb</a>
			<a href="/lager" class:active={page.url.pathname.startsWith('/lager')}>Vorratskammer</a>
			<a href="/shopping" class:active={page.url.pathname.startsWith('/shopping')}>Einkaufen</a>
			<a href="/clara" class:active={page.url.pathname.startsWith('/clara')}>Clara</a>
			{#if data.user.isAdmin}
				<a href="/admin" class:active={page.url.pathname.startsWith('/admin')}>Admin</a>
			{/if}
			<div class="mobile-menu-sep"></div>
			<button type="button" onclick={() => { mobileMenuOpen = false; openSettings(); }}>Einstellungen</button>
			<form method="post" action="/logout" use:enhance>
				<button type="submit" class="menu-logout">Abmelden</button>
			</form>
		</nav>
	{/if}

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
					class:active={activeTab === 'account'}
					onclick={() => (activeTab = 'account')}
				>Konto</button>
				<button
					type="button"
					class="settings-tab"
					class:active={activeTab === 'family'}
					onclick={() => (activeTab = 'family')}
				>Familie</button>
				<button
					type="button"
					class="settings-tab"
					class:active={activeTab === 'groups'}
					onclick={() => (activeTab = 'groups')}
				>Zutaten-Gruppen</button>
				<button
					type="button"
					class="settings-tab"
					class:active={activeTab === 'plants'}
					onclick={() => (activeTab = 'plants')}
				>Pflanzliche Zutaten</button>
				<button
					type="button"
					class="settings-tab"
					class:active={activeTab === 'stores'}
					onclick={() => (activeTab = 'stores')}
				>Läden</button>
				<button
					type="button"
					class="settings-tab"
					class:active={activeTab === 'recipes'}
					onclick={() => { activeTab = 'recipes'; importResult = null; }}
				>Rezepte</button>
				<button
					type="button"
					class="settings-tab"
					class:active={activeTab === 'claude'}
					onclick={() => { activeTab = 'claude'; claudePromptValue = data.claudePrompt ?? ''; }}
				>Claude</button>
			</nav>

			{#if activeTab === 'account'}
				<div class="settings-section">
					<div class="settings-info-box">Eigenes Passwort ändern.</div>

					<form
						method="post"
						action="/settings?/changePassword"
						class="family-form"
						use:enhance={({ formElement }) => async ({ result }) => {
							if (result.type === 'success') {
								passwordMessage = { type: 'success', text: '✓ Passwort geändert.' };
								formElement.reset();
							} else if (result.type === 'failure') {
								passwordMessage = { type: 'error', text: (result.data?.message as string) ?? 'Fehler beim Ändern.' };
							} else {
								passwordMessage = { type: 'error', text: 'Unerwarteter Fehler — bitte nochmal versuchen.' };
							}
						}}
					>
						<label>
							Aktuelles Passwort
							<input type="password" name="currentPassword" required autocomplete="current-password" />
						</label>
						<label>
							Neues Passwort
							<input type="password" name="newPassword" required minlength="8" autocomplete="new-password" />
						</label>
						<label>
							Neues Passwort bestätigen
							<input type="password" name="confirm" required minlength="8" autocomplete="new-password" />
						</label>
						<button type="submit" class="btn-save-prompt">Passwort ändern</button>
						{#if passwordMessage}
							<div class="feedback-box" class:feedback-success={passwordMessage.type === 'success'} class:feedback-error={passwordMessage.type === 'error'}>
								{passwordMessage.text}
							</div>
						{/if}
					</form>
				</div>
			{/if}

			{#if activeTab === 'family'}
				<div class="settings-section">
					<div class="settings-info-box">
						Diese Einstellungen gelten nur für eure Familie — Rezepte, Plan und Einkaufsliste
						sind zwischen Familien getrennt.
					</div>

					{#if familyMessage}
						<div class="feedback-box" class:feedback-success={familyMessage.type === 'success'} class:feedback-error={familyMessage.type === 'error'}>
							{familyMessage.text}
						</div>
					{/if}

					<form
						method="post"
						action="/settings?/renameFamily"
						class="family-form"
						use:enhance={() => async ({ result }) => {
							if (result.type === 'success') {
								familyMessage = { type: 'success', text: '✓ Gespeichert.' };
								await invalidateAll();
							} else if (result.type === 'failure') {
								familyMessage = { type: 'error', text: (result.data?.message as string) ?? 'Fehler beim Speichern.' };
							}
						}}
					>
						<label>
							Familienname
							<input type="text" name="name" value={data.family?.name ?? ''} required />
						</label>
						<button type="submit" class="btn-save-prompt">Speichern</button>
					</form>

					<h3 class="family-subheading">Bring!</h3>
					<div class="settings-info-box">
						Die Listen-ID findest du, indem du unten "Listen abrufen" klickst, nachdem
						E-Mail und Passwort ausgefüllt sind — Kömerle meldet sich kurz bei Bring! an
						und zeigt dir deine Listen mit ihrer ID zum Kopieren.
					</div>
					<form
						method="post"
						action="/settings?/saveBring"
						class="family-form"
						use:enhance={({ submitter }) => {
							const isLookup = submitter?.getAttribute('formaction')?.includes('lookupBringLists') ?? false;
							return async ({ result }) => {
								if (isLookup) {
									if (result.type === 'success') {
										bringListsFound = (result.data?.bringListsFound as { id: string; name: string }[]) ?? [];
										bringLookupMessage = bringListsFound.length > 0 ? null : { type: 'error', text: 'Keine Listen gefunden.' };
									} else if (result.type === 'failure') {
										bringListsFound = null;
										bringLookupMessage = { type: 'error', text: (result.data?.message as string) ?? 'Fehler.' };
									}
								} else if (result.type === 'success') {
									familyMessage = { type: 'success', text: '✓ Gespeichert.' };
									await invalidateAll();
								} else if (result.type === 'failure') {
									familyMessage = { type: 'error', text: (result.data?.message as string) ?? 'Fehler beim Speichern.' };
								}
							};
						}}
					>
						<label>
							E-Mail
							<input type="email" name="email" value={data.family?.bringEmail ?? ''} />
						</label>
						<label>
							Passwort {#if data.family?.hasBringPassword}<span class="configured">(gespeichert — leer lassen zum Behalten)</span>{/if}
							<input type="password" name="password" autocomplete="new-password" />
						</label>
						<button type="submit" formaction="/settings?/lookupBringLists" class="btn-reset-prompt">Listen abrufen</button>

						{#if bringLookupMessage}
							<div class="feedback-box feedback-error">{bringLookupMessage.text}</div>
						{/if}
						{#if bringListsFound && bringListsFound.length > 0}
							<div class="bring-lists-found">
								{#each bringListsFound as list}
									<div class="bring-list-row">
										<span>{list.name}</span>
										<code>{list.id}</code>
									</div>
								{/each}
							</div>
						{/if}

						<label>
							Liste 1 — ID
							<input type="text" name="listId" value={data.family?.bringListId ?? ''} />
						</label>
						<label>
							Liste 1 — Name
							<input type="text" name="listName" value={data.family?.bringListName ?? ''} />
						</label>
						<label>
							Liste 2 — ID (optional)
							<input type="text" name="listId2" value={data.family?.bringListId2 ?? ''} />
						</label>
						<label>
							Liste 2 — Name (optional)
							<input type="text" name="listName2" value={data.family?.bringListName2 ?? ''} />
						</label>
						<button type="submit" formaction="/settings?/saveBring" class="btn-save-prompt">Bring! speichern</button>
					</form>

					<h3 class="family-subheading">Biogmüsabo</h3>
					<form
						method="post"
						action="/settings?/saveBioabo"
						class="family-form"
						use:enhance={() => async ({ result }) => {
							if (result.type === 'success') {
								familyMessage = { type: 'success', text: '✓ Gespeichert.' };
								await invalidateAll();
							} else if (result.type === 'failure') {
								familyMessage = { type: 'error', text: (result.data?.message as string) ?? 'Fehler beim Speichern.' };
							}
						}}
					>
						<label>
							E-Mail
							<input type="email" name="email" value={data.family?.bioaboEmail ?? ''} />
						</label>
						<label>
							Passwort {#if data.family?.hasBioaboPassword}<span class="configured">(gespeichert — leer lassen zum Behalten)</span>{/if}
							<input type="password" name="password" autocomplete="new-password" />
						</label>
						<button type="submit" class="btn-save-prompt">Biogmüsabo speichern</button>
					</form>
				</div>
			{/if}

			{#if activeTab === 'groups'}
				<div class="settings-section">
					<div class="settings-info-box">
						Zutatennamen die dasselbe meinen werden in einer Gruppe zusammengefasst.
						Beim Abgleich von Gemüsekorb mit Rezepten werden alle Namen der Gruppe als gleichwertig behandelt.
						Der erste Eintrag ist die Hauptform — alle anderen werden darauf normalisiert.
					</div>

					<table class="synonym-table">
						<thead>
							<tr>
								<th>Bezeichnung</th>
								<th>Schlüssel (kommagetrennt)</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each data.ingredientGroups as g}
								<tr>
									<td>
										<form method="post" action="/settings?/editGroup" use:enhance={() => async ({ update }) => update({ reset: false })} style="display:contents">
											<input type="hidden" name="id" value={g.id} />
											<input type="hidden" name="field" value="label" />
											<input
												type="text"
												name="value"
												value={g.label}
												class="inline-edit"
												onblur={(e) => e.currentTarget.form?.requestSubmit()}
												onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
											/>
										</form>
									</td>
									<td class="col-key">
										<form method="post" action="/settings?/editGroup" use:enhance={() => async ({ update }) => update({ reset: false })} style="display:contents">
											<input type="hidden" name="id" value={g.id} />
											<input type="hidden" name="field" value="matchKeys" />
											<input
												type="text"
												name="value"
												value={g.matchKeys.join(', ')}
												class="inline-edit inline-edit-mono"
												onblur={(e) => e.currentTarget.form?.requestSubmit()}
												onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
											/>
										</form>
									</td>
									<td>
										<form
											method="post"
											action="/settings?/deleteGroup"
											use:enhance={() => async ({ update }) => {
												await update();
												await invalidateAll();
											}}
										>
											<input type="hidden" name="id" value={g.id} />
											<button type="submit" class="btn-delete-synonym">✕</button>
										</form>
									</td>
								</tr>
							{:else}
								<tr><td colspan="3" class="empty-synonyms">Noch keine Gruppen.</td></tr>
							{/each}
						</tbody>
					</table>

					<form
						method="post"
						action="/settings?/addGroup"
						class="add-synonym-form"
						use:enhance={() => async ({ update }) => {
							await update();
							await invalidateAll();
							newGroupLabel = '';
							newGroupKeys = '';
						}}
					>
						<input
							type="text"
							name="label"
							placeholder="Bezeichnung (z.B. Karotte)"
							bind:value={newGroupLabel}
							required
						/>
						<input
							type="text"
							name="matchKeys"
							placeholder="Schlüssel (z.B. rüebli, rüben, karotte)"
							bind:value={newGroupKeys}
							required
						/>
						<button type="submit" class="btn-add-synonym">Hinzufügen</button>
					</form>
				</div>
			{/if}

			{#if activeTab === 'plants'}
				<div class="settings-section">
					<div class="settings-info-box">
						Zutaten, die beim Wochenplan auf die 30-Pflanzen-Zählung angerechnet werden.
						Der Match-Schlüssel muss mit dem normalisierten Zutaten-Schlüssel der Rezepte übereinstimmen.
					</div>

					<table class="synonym-table">
						<thead>
							<tr>
								<th>Bezeichnung</th>
								<th>Match-Schlüssel</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each data.plantFoods as p}
								<tr>
									<td>{p.label}</td>
									<td class="col-key">{p.matchKey}</td>
									<td>
										<form
											method="post"
											action="/settings?/deletePlantFood"
											use:enhance={() => async ({ update }) => {
												await update();
												await invalidateAll();
											}}
										>
											<input type="hidden" name="id" value={p.id} />
											<button type="submit" class="btn-delete-synonym">✕</button>
										</form>
									</td>
								</tr>
							{:else}
								<tr><td colspan="3" class="empty-synonyms">Noch keine Einträge.</td></tr>
							{/each}
						</tbody>
					</table>

					<form
						method="post"
						action="/settings?/addPlantFood"
						class="add-synonym-form"
						use:enhance={() => async ({ update }) => {
							await update();
							await invalidateAll();
						}}
					>
						<input type="text" name="label" placeholder="Bezeichnung (z.B. Karotte)" required />
						<input type="text" name="matchKey" placeholder="Schlüssel (z.B. karotte)" required />
						<button type="submit" class="btn-add-synonym">Hinzufügen</button>
					</form>
				</div>
			{/if}

			{#if activeTab === 'stores'}
				<div class="settings-section">
					{#if data.bringLists.length < 2}
						<div class="settings-info-box">
							Zwei Bring!-Listen sind nicht konfiguriert (siehe Tab "Familie").
							Diese Zuordnung greift erst, sobald beide Listen eingerichtet sind.
						</div>
					{:else}
						<div class="settings-info-box">
							Kömerle merkt sich pro Zutat, in welche Liste sie beim letzten Senden an Bring! einsortiert wurde,
							und schlägt das beim nächsten Mal automatisch wieder vor. Hier siehst und korrigierst du die gelernten Zuordnungen.
						</div>

						<table class="synonym-table">
							<thead>
								<tr>
									<th>Zutat</th>
									<th>Liste</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{#each data.listPrefs as pref}
									<tr>
										<td class="col-key">{pref.matchKey}</td>
										<td>
											<form
												method="post"
												action="/settings?/setListPref"
												use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}
											>
												<input type="hidden" name="matchKey" value={pref.matchKey} />
												<input type="hidden" name="listIndex" value={pref.listIndex === 0 ? 1 : 0} />
												<button type="submit" class="list-pref-toggle" class:list-pref-1={pref.listIndex === 1}>
													{data.bringLists[pref.listIndex]?.name ?? '—'}
												</button>
											</form>
										</td>
										<td>
											<form
												method="post"
												action="/settings?/deleteListPref"
												use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}
											>
												<input type="hidden" name="id" value={pref.id} />
												<button type="submit" class="btn-delete-synonym">✕</button>
											</form>
										</td>
									</tr>
								{:else}
									<tr><td colspan="3" class="empty-synonyms">Noch keine gelernten Zuordnungen.</td></tr>
								{/each}
							</tbody>
						</table>

						<form
							method="post"
							action="/settings?/setListPref"
							class="add-synonym-form"
							use:enhance={() => async ({ update }) => {
								await update();
								await invalidateAll();
								newListPrefKey = '';
								newListPrefIndex = 0;
							}}
						>
							<input type="text" name="matchKey" placeholder="Zutat (z.B. mehl)" bind:value={newListPrefKey} required />
							<select name="listIndex" bind:value={newListPrefIndex}>
								{#each data.bringLists as list, i}
									<option value={i}>{list.name}</option>
								{/each}
							</select>
							<button type="submit" class="btn-add-synonym">Hinzufügen</button>
						</form>
					{/if}
				</div>
			{/if}

			{#if activeTab === 'recipes'}
				<div class="settings-section">
					<div class="settings-info-box">
						Rezepte als JSON exportieren oder aus einer zuvor exportierten Datei importieren.
						Beim Import werden Rezepte mit gleichem Namen übersprungen.
					</div>

					<div class="backup-actions">
						<div class="backup-row">
							<span class="backup-label">Export</span>
							<span class="backup-spacer"></span>
							<a href="/recipes/export" download class="btn-backup btn-backup-primary">JSON exportieren</a>
						</div>

						<div class="backup-row">
							<span class="backup-label">Import</span>
							<form
								method="post"
								action="/settings?/importRecipes"
								enctype="multipart/form-data"
								class="import-form"
								use:enhance={({ formElement }) => async ({ result }) => {
									if (result.type === 'success' && result.data) {
										importResult = result.data as { imported: number; skipped: number };
										formElement.reset();
										selectedFileName = '';
									}
								}}
							>
								<label class="file-input-label">
									<input
										type="file"
										name="file"
										accept=".json"
										required
										onchange={(e) => {
											const f = (e.target as HTMLInputElement).files?.[0];
											selectedFileName = f ? f.name : '';
										}}
									/>
									<span class="file-btn">Durchsuchen</span>
									{#if selectedFileName}
										<span class="file-name">{selectedFileName}</span>
									{:else}
										<span class="file-name file-name-empty">Keine Datei gewählt</span>
									{/if}
								</label>
								<button type="submit" class="btn-backup btn-backup-primary">Importieren</button>
							</form>
						</div>

						{#if importResult}
							<p class="import-result">
								{importResult.imported} importiert, {importResult.skipped} übersprungen.
							</p>
						{/if}
					</div>
				</div>
			{/if}
			{#if activeTab === 'claude'}
				<div class="settings-section">
					<div class="settings-info-box">
						Prompt-Vorlage für den Claude-Mahlzeitenvorschlag. Verfügbare Platzhalter:
						<code>{'{basketList}'}</code> Gemüsekorb,
						<code>{'{filledSlots}'}</code> bereits geplante Mahlzeiten,
						<code>{'{availableRecipes}'}</code> verfügbare Rezepte (JSON),
						<code>{'{emptySlots}'}</code> leere Slots.
					</div>
					<form method="post" action="/settings?/saveClaudePrompt" use:enhance={() => async ({ result, update }) => { await update({ reset: false }); }}>
						<textarea
							name="template"
							class="prompt-textarea"
							rows="18"
							bind:value={claudePromptValue}
						></textarea>
						<div class="prompt-actions">
							<button type="submit" class="btn-save-prompt">Speichern</button>
							<button
								type="submit"
								formaction="/settings?/resetClaudePrompt"
								class="btn-reset-prompt"
								onclick={() => { claudePromptValue = data.claudePrompt ?? ''; }}
							>Auf Standard zurücksetzen</button>
						</div>
					</form>
				</div>
			{/if}

		</div>
	</dialog>

	<nav class="tab-bar">
		<a href="/plan" class:active={page.url.pathname.startsWith('/plan')}>Wochenplan</a>
		<a href="/recipes" class:active={page.url.pathname.startsWith('/recipes')}>Rezepte</a>
		<a href="/basket" class:active={page.url.pathname.startsWith('/basket')}>Gemüsekorb</a>
		<a href="/lager" class:active={page.url.pathname.startsWith('/lager')}>Vorratskammer</a>
		<a href="/shopping" class:active={page.url.pathname.startsWith('/shopping')}>Einkaufen</a>
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
		padding-top: env(safe-area-inset-top, 0px);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	.top-bar-inner {
		height: var(--nav-h);
		display: flex;
		align-items: center;
		padding-left: 1rem;
		padding-right: 1rem;
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

	.mobile-quick-nav {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.mobile-quick-nav a {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.1rem;
		height: 2.1rem;
		font-size: 1.2rem;
		border-radius: var(--radius);
		text-decoration: none;
		line-height: 1;
		transition: background 0.15s;
	}

	.mobile-quick-nav a.active {
		background: var(--green-light);
	}

	.user-area {
		display: none;
	}

	.mobile-header-right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: var(--nav-h);
	}

	.btn-hamburger {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 0.35rem;
		display: flex;
		align-items: center;
		height: 100%;
		-webkit-tap-highlight-color: transparent;
	}

	.ham-lines {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 5px;
		width: 22px;
		height: 16px;
	}

	.ham-lines span {
		display: block;
		width: 22px;
		height: 2px;
		background: var(--text);
		border-radius: 1px;
	}

	.mobile-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 18;
	}

	.mobile-menu {
		position: fixed;
		top: calc(var(--nav-h) + env(safe-area-inset-top, 0px));
		left: 0;
		right: 0;
		z-index: 19;
		background: var(--surface);
		border-bottom: 1px solid var(--border-strong);
		box-shadow: 0 4px 20px rgba(42, 37, 32, 0.14);
	}

	.mobile-menu a,
	.mobile-menu button[type='button'],
	.menu-logout {
		display: block;
		width: 100%;
		padding: 1rem 1.25rem;
		font-size: 0.975rem;
		font-family: inherit;
		text-decoration: none;
		color: var(--text);
		border: none;
		border-bottom: 1px solid var(--border);
		background: none;
		text-align: left;
		cursor: pointer;
		box-sizing: border-box;
		transition: background 0.12s;
	}

	.mobile-menu a:hover,
	.mobile-menu button[type='button']:hover,
	.menu-logout:hover {
		background: var(--bg);
	}

	.mobile-menu a.active {
		color: white;
		font-weight: 600;
		background: var(--green);
	}

	.mobile-menu-sep {
		height: 1px;
		background: var(--border-strong);
	}

	.mobile-menu form {
		display: block;
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

	.family-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.family-form label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.family-form input {
		padding: 0.45rem 0.6rem;
		font-size: 0.875rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
	}

	.family-form button {
		align-self: flex-start;
	}

	.family-subheading {
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}

	.configured {
		font-weight: 400;
		color: var(--text-light, var(--text-muted));
		font-size: 0.75rem;
	}

	.feedback-box {
		font-size: 0.875rem;
		font-weight: 500;
		padding: 0.6rem 0.9rem;
		border-radius: var(--radius);
		border: 1.5px solid transparent;
	}

	.feedback-success {
		background: var(--green-light, #eaf4ec);
		border-color: var(--green);
		color: var(--green-dark, var(--green));
	}

	.feedback-error {
		background: #fdf0f0;
		border-color: var(--red, #c0392b);
		color: var(--red, #c0392b);
	}

	.bring-lists-found {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.6rem 0.75rem;
	}

	.bring-list-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.85rem;
	}

	.bring-list-row code {
		font-size: 0.78rem;
		color: var(--text-muted);
		user-select: all;
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

	.col-key {
		font-family: monospace;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.inline-edit {
		width: 100%;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 3px;
		padding: 0.15rem 0.3rem;
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--text);
		outline: none;
		transition: border-color 0.15s;
	}

	.inline-edit:hover {
		border-color: var(--border-strong);
	}

	.inline-edit:focus {
		border-color: var(--green);
		background: var(--bg);
	}

	.inline-edit-mono {
		font-family: monospace;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.prompt-textarea {
		width: 100%;
		font-family: monospace;
		font-size: 0.8rem;
		padding: 0.6rem 0.75rem;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		resize: vertical;
		outline: none;
		line-height: 1.5;
		box-sizing: border-box;
	}

	.prompt-textarea:focus {
		border-color: var(--green);
	}

	.prompt-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.btn-save-prompt {
		font-size: 0.875rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		padding: 0.45rem 1rem;
		cursor: pointer;
	}

	.btn-save-prompt:hover { background: var(--green-dark); }

	.btn-reset-prompt {
		font-size: 0.875rem;
		font-family: inherit;
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		padding: 0.45rem 1rem;
		color: var(--text-muted);
		cursor: pointer;
	}

	.btn-reset-prompt:hover { background: var(--surface); color: var(--text); }

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

	.list-pref-toggle {
		font-size: 0.8rem;
		font-family: inherit;
		padding: 0.25rem 0.7rem;
		border: 1.5px solid var(--green);
		border-radius: var(--radius);
		background: var(--green-light);
		color: var(--green-dark);
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
	}

	.list-pref-toggle.list-pref-1 {
		border-color: #5b4fcf;
		background: #ece9fb;
		color: #4a3fb5;
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

	.backup-actions {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.backup-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.backup-row:last-of-type {
		border-bottom: none;
	}

	.backup-label {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		width: 4.5rem;
		flex-shrink: 0;
	}

	.backup-spacer {
		flex: 1;
	}

	.btn-backup {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 9rem;
		height: 2rem;
		padding: 0 1rem;
		box-sizing: border-box;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		text-decoration: none;
		background: var(--surface);
		color: var(--text);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		cursor: pointer;
		transition: background 0.15s;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.btn-backup:hover {
		background: var(--bg);
	}

	.btn-backup-primary {
		background: var(--green);
		color: white;
		border-color: var(--green);
	}

	.btn-backup-primary:hover {
		background: var(--green-dark);
		border-color: var(--green-dark);
	}

	.import-form {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.file-input-label {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		flex: 1;
	}

	.file-input-label input[type='file'] {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.file-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.45rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		background: var(--surface);
		color: var(--text-muted);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		white-space: nowrap;
		transition: color 0.15s, background 0.15s;
	}

	.file-input-label:hover .file-btn {
		color: var(--text);
		background: var(--bg);
	}

	.file-name {
		font-size: 0.875rem;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 12rem;
	}

	.file-name-empty {
		color: var(--text-muted);
	}

	.import-result {
		margin-top: 0.75rem;
		font-size: 0.875rem;
		color: var(--green);
	}

	/* ── Bottom tab bar: hidden on mobile (replaced by hamburger) ── */
	.tab-bar {
		display: none;
	}

	/* ── Main content ── */
	main {
		padding: 1.25rem 1rem;
		max-width: var(--max-w);
		margin: 0 auto;
		overflow-x: clip;
	}

	main.with-tabs {
		padding-bottom: 1.25rem;
	}

	/* ── Desktop ── */
	@media (min-width: 768px) {
		.top-bar-inner {
			padding: 0 2rem;
			gap: 2rem;
		}

		.user-area {
			margin-left: auto;
			display: flex;
			align-items: center;
			gap: 0.75rem;
		}

		.mobile-header-right {
			display: none;
		}

		.mobile-quick-nav {
			display: none;
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

		.desktop-nav a.active {
			color: var(--text);
			font-weight: 600;
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
