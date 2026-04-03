<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
	type Slot = 'lunch' | 'dinner';
	type DraftEntry = {
		day: Day;
		slot: Slot;
		recipeId: number | null;
		recipeName: string | null;
		recipeUrl: string | null;
		notNeeded: boolean;
	};

	const NOT_NEEDED = '__not_needed__';

	const DAYS: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
	const DAY_LABELS: Record<Day, string> = {
		monday: 'Montag', tuesday: 'Dienstag', wednesday: 'Mittwoch',
		thursday: 'Donnerstag', friday: 'Freitag', saturday: 'Samstag', sunday: 'Sonntag'
	};
	const SLOT_LABELS: Record<Slot, string> = { lunch: 'Mittag', dinner: 'Abend' };



	function slotKey(day: Day, slot: Slot) {
		return `${day}-${slot}`;
	}

	function getRecipe(id: number | null) {
		if (!id) return null;
		return data.allRecipes.find((r) => r.id === id) ?? null;
	}

	function formatDate(iso: string): string {
		const [y, m, d] = iso.split('-');
		return `${d}.${m}.${y}`;
	}

	// ── Draft state ──
	let draft: DraftEntry[] | null = $state(null);
	let draftStartDay: Day | null = $state(null);
	let draftStartSlot: Slot | null = $state(null);

	$effect(() => {
		if (form && 'suggestion' in form && Array.isArray((form as any).suggestion)) {
			draft = (form as any).suggestion.map((e: DraftEntry) => ({ ...e }));
			draftStartDay = (form as any).startDay;
			draftStartSlot = (form as any).startSlot;
		}
	});

	function getDraftEntry(day: Day, slot: Slot): DraftEntry | null {
		return draft?.find((e) => e.day === day && e.slot === slot) ?? null;
	}

	function removeDraftEntry(day: Day, slot: Slot) {
		draft = draft?.filter((e) => !(e.day === day && e.slot === slot)) ?? null;
	}

	// Unified display — draft when active, otherwise DB
	type DbEntry = (typeof data.entries)[number];
	function getEntry(day: Day, slot: Slot): DraftEntry | DbEntry | null {
		if (draft !== null) return getDraftEntry(day, slot);
		return data.entries.find((e) => e.day === day && e.slot === slot) ?? null;
	}

	function isNotNeededEntry(entry: DraftEntry | DbEntry | null): boolean {
		if (!entry) return false;
		if ('notNeeded' in entry) return entry.notNeeded;
		return (entry as DbEntry).freeText === NOT_NEEDED;
	}

	function entryLabel(entry: DraftEntry | DbEntry | null): string | null {
		if (!entry || isNotNeededEntry(entry)) return null;
		if ('recipeName' in entry) return entry.recipeName;
		const recipe = getRecipe((entry as DbEntry).recipeId ?? null);
		return recipe?.name ?? (entry as DbEntry).freeText ?? null;
	}

	function entryUrl(entry: DraftEntry | DbEntry | null): string | null {
		if (!entry || isNotNeededEntry(entry)) return null;
		if ('recipeUrl' in entry) return (entry as DraftEntry).recipeUrl;
		return getRecipe((entry as DbEntry).recipeId ?? null)?.recipeUrl ?? null;
	}

	// ── Modal ──
	let dialog: HTMLDialogElement | undefined = $state();
	let modalStartDay: Day = $state('monday');
	let modalStartSlot: Slot = $state('lunch');
	let notNeededChecked: Set<string> = $state(new Set());
	let modalDirect: boolean = $state(false);

	function openModal(direct = false) {
		modalDirect = direct;
		notNeededChecked = new Set();
		dialog?.showModal();
	}

	function closeModal() {
		dialog?.close();
	}

	function toggleNotNeeded(key: string) {
		const next = new Set(notNeededChecked);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		notNeededChecked = next;
	}

	// ── Editing (post-confirmation) ──
	let editing: string | null = $state(null);

	// ── Drag & drop ──
	let dragFrom: { day: Day; slot: Slot } | null = $state(null);
	let dragOverKey: string | null = $state(null);

	function onDragStart(e: DragEvent, day: Day, slot: Slot) {
		dragFrom = { day, slot };
		e.dataTransfer!.effectAllowed = 'move';
	}

	function onDragOver(e: DragEvent, day: Day, slot: Slot) {
		if (!dragFrom) return;
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		dragOverKey = slotKey(day, slot);
	}

	function onDragLeave(e: DragEvent) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
			dragOverKey = null;
		}
	}

	async function onDrop(e: DragEvent, toDay: Day, toSlot: Slot) {
		e.preventDefault();
		dragOverKey = null;
		if (!dragFrom) return;
		const { day: fromDay, slot: fromSlot } = dragFrom;
		dragFrom = null;
		if (fromDay === toDay && fromSlot === toSlot) return;

		if (draft !== null) {
			const fromIdx = draft.findIndex((e) => e.day === fromDay && e.slot === fromSlot);
			const toIdx = draft.findIndex((e) => e.day === toDay && e.slot === toSlot);
			if (fromIdx === -1) return;
			draft = draft.map((e, i) => {
				if (i === fromIdx) return { ...e, day: toDay, slot: toSlot };
				if (i === toIdx) return { ...e, day: fromDay, slot: fromSlot };
				return e;
			});
		} else {
			const fd = new FormData();
			fd.append('fromDay', fromDay);
			fd.append('fromSlot', fromSlot);
			fd.append('toDay', toDay);
			fd.append('toSlot', toSlot);
			await fetch('?/moveSlot', { method: 'POST', body: fd });
			await invalidateAll();
		}
	}

	function onDragEnd() {
		dragFrom = null;
		dragOverKey = null;
	}

	let draftCount = $derived(draft?.filter((e) => !e.notNeeded).length ?? 0);
</script>

<!-- Modal -->
<dialog bind:this={dialog} class="modal-dialog">
	<div class="modal-content">
		<div class="modal-header">
			<h2>Vorschlag erstellen</h2>
			<button class="modal-close" onclick={closeModal} type="button" aria-label="Schliessen">✕</button>
		</div>

		<form
			method="post"
			action="?/getSuggestion"
			use:enhance={() => {
				return async ({ update }) => {
					closeModal();
					await update();
				};
			}}
		>
			<div class="modal-section">
				<p class="modal-label">Ab wann soll der Plan befüllt werden?</p>
				<div class="start-fields">
					<label>
						<span>Erster Tag</span>
						<select name="startDay" bind:value={modalStartDay}>
							{#each DAYS as day}
								<option value={day}>{DAY_LABELS[day]}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Erste Mahlzeit</span>
						<select name="startSlot" bind:value={modalStartSlot}>
							<option value="lunch">Mittag</option>
							<option value="dinner">Abend</option>
						</select>
					</label>
				</div>
			</div>

			<div class="modal-section">
				<p class="modal-label">Welche Mahlzeiten werden diese Woche nicht benötigt?</p>
				<div class="nn-grid">
					{#each DAYS as day}
						<div class="nn-day">
							<span class="nn-day-name">{DAY_LABELS[day]}</span>
							<div class="nn-slots">
								<label class="nn-check">
									<input
										type="checkbox"
										name="notNeeded"
										value="{day}-lunch"
										checked={notNeededChecked.has(`${day}-lunch`)}
										onchange={() => toggleNotNeeded(`${day}-lunch`)}
									/>
									Mittag
								</label>
								<label class="nn-check">
									<input
										type="checkbox"
										name="notNeeded"
										value="{day}-dinner"
										checked={notNeededChecked.has(`${day}-dinner`)}
										onchange={() => toggleNotNeeded(`${day}-dinner`)}
									/>
									Abend
								</label>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-modal-cancel" onclick={closeModal}>Abbrechen</button>
				<button
					type="submit"
					formaction={modalDirect ? '?/quickPlan' : '?/getSuggestion'}
					class="btn-modal-submit"
				>Vorschlag erstellen</button>
			</div>
		</form>
	</div>
</dialog>

<!-- Page header -->
<div class="page-header">
	<h1>Wochenplan</h1>
	<span class="week-label">Woche ab {formatDate(data.weekStart)}</span>
</div>

<!-- Status bar -->
{#if draft !== null}
	<div class="draft-banner">
		<div class="draft-info">
			<span class="draft-label">Vorschlag</span>
			<span class="draft-hint">Mahlzeiten per Drag & Drop verschieben oder mit ✕ entfernen.</span>
		</div>
		<div class="draft-meta-actions">
			<button
				class="btn-regenerate"
				type="button"
				onclick={() => { draft = null; openModal(); }}
			>
				Neu erstellen
			</button>
			<button
				class="btn-discard"
				type="button"
				onclick={() => { draft = null; draftStartDay = null; draftStartSlot = null; }}
			>
				Verwerfen
			</button>
		</div>
	</div>
{:else if data.meta?.planningStartDay}
	<div class="confirmed-bar">
		<span class="confirmed-label">Plan bestätigt</span>
		<button class="btn-replan" type="button" onclick={() => openModal(true)}>Neu vorschlagen</button>
	</div>
{:else}
	<div class="no-plan-bar">
		<button class="btn-open-modal" type="button" onclick={openModal}>Vorschlag erstellen</button>
		<span class="no-plan-hint">Noch kein Plan für diese Woche.</span>
	</div>
{/if}

<!-- Mobile: day cards -->
<div class="day-cards">
	{#each DAYS as day}
		<div class="day-card">
			<div class="day-name">{DAY_LABELS[day]}</div>
			{#each ['lunch', 'dinner'] as slotStr}
				{@const slot = slotStr as Slot}
				{@const entry = getEntry(day, slot)}
				{@const key = slotKey(day, slot)}
				{@const notNeeded = isNotNeededEntry(entry)}
					<div
						class="slot-row"
						class:drag-over={dragOverKey === key}
						ondragover={(e) => onDragOver(e, day, slot)}
						ondragleave={onDragLeave}
						ondrop={(e) => onDrop(e, day, slot)}
					>
						<span class="slot-label">{SLOT_LABELS[slot]}</span>
						<div class="slot-content">
							{#if entry}
								<span
									class="meal-name"
									class:is-dragging={dragFrom?.day === day && dragFrom?.slot === slot}
									class:not-needed={notNeeded}
									draggable="true"
									ondragstart={(e) => onDragStart(e, day, slot)}
									ondragend={onDragEnd}
								>
									{#if notNeeded}
										Nicht benötigt
									{:else if entryUrl(entry)}
										<a href={entryUrl(entry)!} target="_blank" rel="noopener">{entryLabel(entry)}</a>
									{:else}
										{entryLabel(entry)}
									{/if}
								</span>
								{#if draft !== null}
									<button class="btn-clear" title="Entfernen" onclick={() => removeDraftEntry(day, slot)}>✕</button>
								{:else}
									<form method="post" action="?/clearSlot" use:enhance>
										<input type="hidden" name="day" value={day} />
										<input type="hidden" name="slot" value={slot} />
										<button type="submit" class="btn-clear" title="Leeren">✕</button>
									</form>
								{/if}
							{:else if draft === null && editing === key}
								<form
									method="post"
									action="?/setSlot"
									use:enhance={() => ({ update }) => { editing = null; update(); }}
									class="inline-form"
								>
									<input type="hidden" name="day" value={day} />
									<input type="hidden" name="slot" value={slot} />
									<select name="recipeId" class="recipe-select">
										<option value="">— Freitext —</option>
										{#each data.allRecipes as r}
											<option value={r.id}>{r.name}</option>
										{/each}
									</select>
									<input type="text" name="freeText" placeholder="Freitext..." class="free-input" />
									<div class="inline-actions">
										<button type="submit" class="btn-save-slot">OK</button>
										<button type="button" class="btn-cancel-slot" onclick={() => (editing = null)}>✕</button>
									</div>
								</form>
							{:else if draft === null}
								<button
									class="btn-add-slot"
									onclick={() => (editing = key)}
									disabled={!data.meta?.planningStartDay}
								>
									{data.meta?.planningStartDay ? '+ eintragen' : '—'}
								</button>
							{/if}
						</div>
					</div>
			{/each}
		</div>
	{/each}
</div>

<!-- Desktop: grid table -->
<div class="plan-grid">
	<table>
		<thead>
			<tr>
				<th class="th-slot"></th>
				{#each DAYS as day}
					<th>{DAY_LABELS[day]}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each ['lunch', 'dinner'] as slotStr}
				{@const slot = slotStr as Slot}
				<tr>
					<td class="td-label">{SLOT_LABELS[slot]}</td>
					{#each DAYS as day}
						{@const entry = getEntry(day, slot)}
						{@const key = slotKey(day, slot)}
						{@const notNeeded = isNotNeededEntry(entry)}
						<td
							class="td-cell"
							class:drag-over={dragOverKey === key}
							ondragover={(e) => onDragOver(e, day, slot)}
							ondragleave={onDragLeave}
							ondrop={(e) => onDrop(e, day, slot)}
						>
								{#if entry}
									<div class="cell-filled">
										<div
											class="cell-name-chip"
											class:is-dragging={dragFrom?.day === day && dragFrom?.slot === slot}
											class:not-needed={notNeeded}
											draggable="true"
											ondragstart={(e) => onDragStart(e, day, slot)}
											ondragend={onDragEnd}
										>
											{#if notNeeded}
												Nicht benötigt
											{:else if entryUrl(entry)}
												<a href={entryUrl(entry)!} target="_blank" rel="noopener">{entryLabel(entry)}</a>
											{:else}
												{entryLabel(entry)}
											{/if}
										</div>
										{#if draft !== null}
											<button class="btn-clear-cell" title="Entfernen" onclick={() => removeDraftEntry(day, slot)}>✕</button>
										{:else}
											<form method="post" action="?/clearSlot" use:enhance>
												<input type="hidden" name="day" value={day} />
												<input type="hidden" name="slot" value={slot} />
												<button type="submit" class="btn-clear-cell" title="Leeren">✕</button>
											</form>
										{/if}
									</div>
								{:else if draft === null && editing === key}
									<form
										method="post"
										action="?/setSlot"
										use:enhance={() => ({ update }) => { editing = null; update(); }}
										class="cell-form"
									>
										<input type="hidden" name="day" value={day} />
										<input type="hidden" name="slot" value={slot} />
										<select name="recipeId" class="cell-select">
											<option value="">— Freitext —</option>
											{#each data.allRecipes as r}
												<option value={r.id}>{r.name}</option>
											{/each}
										</select>
										<input type="text" name="freeText" placeholder="Freitext..." class="cell-input" />
										<div class="cell-form-actions">
											<button type="submit" class="btn-ok">OK</button>
											<button type="button" class="btn-cancel-cell" onclick={() => (editing = null)}>✕</button>
										</div>
									</form>
								{:else if draft === null}
									<button
										class="btn-add-cell"
										onclick={() => (editing = key)}
										disabled={!data.meta?.planningStartDay}
									>
										{data.meta?.planningStartDay ? '+' : '—'}
									</button>
								{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Confirm bar (sticky bottom, only in draft mode) -->
{#if draft !== null}
	<div class="confirm-bar">
		<span class="confirm-info">
			{draftCount} Mahlzeit{draftCount !== 1 ? 'en' : ''} vorgeschlagen
		</span>
		<form
			method="post"
			action="?/confirmPlan"
			use:enhance={() => {
				return ({ update }) => {
					draft = null;
					draftStartDay = null;
					draftStartSlot = null;
					update();
				};
			}}
		>
			<input type="hidden" name="startDay" value={draftStartDay} />
			<input type="hidden" name="startSlot" value={draftStartSlot} />
			<input type="hidden" name="entries" value={JSON.stringify(draft)} />
			<button type="submit" class="btn-confirm">Plan bestätigen</button>
		</form>
	</div>
{/if}

<style>
	/* ── Modal ── */
	.modal-dialog {
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: 0 8px 32px rgba(42, 37, 32, 0.18);
		padding: 0;
		width: min(520px, 92vw);
		max-height: 88vh;
		overflow-y: auto;
	}

	.modal-dialog::backdrop {
		background: rgba(42, 37, 32, 0.45);
	}

	.modal-content {
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem 0;
	}

	.modal-header h2 {
		font-size: 1.1rem;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1rem;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		line-height: 1;
	}

	.modal-close:hover {
		color: var(--text);
	}

	.modal-section {
		padding: 1.25rem 1.5rem 0;
	}

	.modal-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
		margin: 0 0 0.875rem;
	}

	.start-fields {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.start-fields label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
		flex: 1;
		min-width: 140px;
	}

	.start-fields select {
		padding: 0.55rem 0.75rem;
		font-size: 0.95rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
		cursor: pointer;
	}

	/* Nicht benötigt grid */
	.nn-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.nn-day {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.nn-day-name {
		font-size: 0.8rem;
		color: var(--text-muted);
		width: 88px;
		flex-shrink: 0;
	}

	.nn-slots {
		display: flex;
		gap: 1.25rem;
	}

	.nn-check {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
		cursor: pointer;
		color: var(--text);
	}

	.nn-check input {
		width: auto;
		accent-color: var(--green);
		cursor: pointer;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		margin-top: 0.5rem;
		border-top: 1px solid var(--border);
	}

	.btn-modal-cancel {
		font-size: 0.875rem;
		font-family: inherit;
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		padding: 0.55rem 1rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-modal-cancel:hover {
		background: var(--bg);
	}

	.btn-modal-submit {
		font-size: 0.9rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		padding: 0.55rem 1.25rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-modal-submit:hover {
		background: var(--green-dark);
	}

	/* ── Page header ── */
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

	/* ── Status bars ── */
	.draft-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		background: var(--green-light);
		border: 1.5px solid var(--green);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.draft-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.draft-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--green-dark);
	}

	.draft-hint {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.draft-meta-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.btn-regenerate,
	.btn-discard {
		font-size: 0.8rem;
		font-family: inherit;
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		padding: 0.35rem 0.75rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.btn-regenerate:hover,
	.btn-discard:hover {
		background: var(--surface);
		color: var(--text);
	}

	.confirmed-bar,
	.no-plan-bar {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		margin-bottom: 1.25rem;
	}

	.confirmed-label {
		font-size: 0.825rem;
		color: var(--text-muted);
	}

	.btn-replan {
		font-size: 0.825rem;
		font-family: inherit;
		background: none;
		border: none;
		padding: 0;
		color: var(--green);
		cursor: pointer;
		text-decoration: underline;
	}

	.btn-open-modal {
		padding: 0.55rem 1.25rem;
		font-size: 0.9rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-open-modal:hover {
		background: var(--green-dark);
	}

	.no-plan-hint {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	/* ── Mobile day cards ── */
	.day-cards {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.plan-grid {
		display: none;
	}

	.day-card {
		background: var(--surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		overflow: hidden;
	}

	.day-name {
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg);
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 0.75rem;
	}

	.slot-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.65rem 1rem;
		border-bottom: 1px solid var(--border);
		transition: background 0.1s;
	}

	.slot-row:last-child {
		border-bottom: none;
	}

	.slot-row.drag-over {
		background: var(--green-light);
	}

	.slot-label {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-weight: 500;
		width: 52px;
		flex-shrink: 0;
		padding-top: 0.15rem;
	}

	.slot-content {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		min-width: 0;
	}

	.meal-name {
		flex: 1;
		font-size: 0.9rem;
		cursor: grab;
		border-radius: 4px;
		padding: 0.1rem 0.25rem;
		transition: opacity 0.15s;
	}

	.meal-name:active {
		cursor: grabbing;
	}

	.meal-name.is-dragging {
		opacity: 0.4;
	}

	.meal-name.not-needed {
		color: var(--text-light);
		font-style: italic;
	}

	.meal-name a {
		color: var(--text);
		text-decoration: none;
	}

	.meal-name a:hover {
		color: var(--green);
		text-decoration: underline;
	}

	.btn-clear {
		background: none;
		border: none;
		color: var(--text-light);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
		flex-shrink: 0;
	}

	.btn-clear:hover {
		color: var(--red);
		background: #fdf0f0;
	}

	.btn-add-slot {
		background: none;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius);
		color: var(--text-light);
		font-size: 0.8rem;
		padding: 0.25rem 0.75rem;
		cursor: pointer;
		font-family: inherit;
		transition: border-color 0.15s, color 0.15s;
	}

	.btn-add-slot:hover:not(:disabled) {
		border-color: var(--green);
		color: var(--green);
	}

	.btn-add-slot:disabled {
		cursor: default;
	}

	.inline-form {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.recipe-select,
	.free-input {
		width: 100%;
		padding: 0.45rem 0.6rem;
		font-size: 0.875rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
	}

	.recipe-select:focus,
	.free-input:focus {
		border-color: var(--green);
	}

	.inline-actions {
		display: flex;
		gap: 0.4rem;
	}

	.btn-save-slot {
		padding: 0.3rem 0.75rem;
		font-size: 0.8rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.btn-cancel-slot {
		padding: 0.3rem 0.6rem;
		font-size: 0.8rem;
		font-family: inherit;
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		color: var(--text-muted);
		cursor: pointer;
	}

	/* ── Confirm bar (sticky bottom) ── */
	.confirm-bar {
		position: sticky;
		bottom: var(--tab-h);
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		background: var(--surface);
		border-top: 1px solid var(--border);
		padding: 0.875rem 1rem;
		margin-top: 1.5rem;
		box-shadow: 0 -2px 8px rgba(42, 37, 32, 0.08);
	}

	.confirm-info {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.btn-confirm {
		padding: 0.6rem 1.5rem;
		font-size: 0.95rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background 0.15s;
		white-space: nowrap;
	}

	.btn-confirm:hover {
		background: var(--green-dark);
	}

	/* ── Desktop grid ── */
	@media (min-width: 768px) {
		.day-cards {
			display: none;
		}

		.plan-grid {
			display: block;
			overflow-x: auto;
			border: 1.5px solid var(--border-strong);
			border-radius: var(--radius-lg);
			box-shadow: var(--shadow);
		}

		table {
			width: 100%;
			border-collapse: collapse;
			background: var(--surface);
			border-radius: var(--radius-lg);
			min-width: 700px;
		}

		th,
		td {
			border-bottom: 1px solid var(--border);
			border-right: 1px solid var(--border);
			padding: 0;
		}

		th:last-child,
		td:last-child {
			border-right: none;
		}

		tbody tr:last-child td {
			border-bottom: none;
		}

		.th-slot {
			width: 68px;
		}

		th {
			font-size: 0.75rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--text-muted);
			background: var(--bg);
			padding: 0.6rem 0.75rem;
			text-align: left;
		}

		.td-label {
			font-size: 0.8rem;
			font-weight: 500;
			color: var(--text-muted);
			padding: 0 0.75rem;
			background: var(--bg);
			white-space: nowrap;
		}

		.td-cell {
			vertical-align: top;
			height: 72px;
			transition: background 0.1s;
		}

		.td-cell.drag-over {
			background: var(--green-light);
		}

		.cell-filled {
			display: flex;
			align-items: flex-start;
			gap: 0.25rem;
			padding: 0.5rem 0.6rem;
			height: 100%;
		}

		.cell-name-chip {
			flex: 1;
			display: flex;
			align-items: center;
			gap: 0.25rem;
			background: var(--bg);
			border: 1px solid var(--border-strong);
			border-radius: var(--radius);
			padding: 0.3rem 0.6rem;
			font-size: 0.875rem;
			line-height: 1.3;
			cursor: grab;
			transition: opacity 0.15s, box-shadow 0.15s;
			min-width: 0;
		}

		.cell-name-chip:hover {
			box-shadow: 0 1px 4px rgba(42,37,32,0.1);
		}

		.cell-name-chip:active {
			cursor: grabbing;
		}

		.cell-name-chip.is-dragging {
			opacity: 0.35;
		}

		.cell-name-chip.not-needed {
			color: var(--text-light);
			font-style: italic;
			border-style: dashed;
		}

		.cell-name-chip a {
			color: var(--text);
			text-decoration: none;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.cell-name-chip a:hover {
			color: var(--green);
			text-decoration: underline;
		}

		.btn-clear-cell {
			background: none;
			border: none;
			color: var(--text-light);
			cursor: pointer;
			font-size: 0.7rem;
			padding: 0.15rem 0.3rem;
			border-radius: 3px;
			opacity: 0;
			transition: opacity 0.15s, color 0.15s, background 0.15s;
			flex-shrink: 0;
		}

		.td-cell:hover .btn-clear-cell {
			opacity: 1;
		}

		.btn-clear-cell:hover {
			color: var(--red);
			background: #fdf0f0;
		}

		.btn-add-cell {
			display: block;
			width: 100%;
			height: 100%;
			background: none;
			border: none;
			color: var(--text-light);
			font-size: 1.1rem;
			cursor: pointer;
			opacity: 0;
			transition: opacity 0.15s, color 0.15s;
		}

		.td-cell:hover .btn-add-cell {
			opacity: 1;
		}

		.btn-add-cell:hover:not(:disabled) {
			color: var(--green);
		}

		.btn-add-cell:disabled {
			cursor: default;
		}

		.cell-form {
			padding: 0.5rem 0.6rem;
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
		}

		.cell-select,
		.cell-input {
			width: 100%;
			padding: 0.35rem 0.5rem;
			font-size: 0.8rem;
			font-family: inherit;
			border: 1.5px solid var(--border-strong);
			border-radius: 4px;
			background: var(--bg);
			color: var(--text);
			outline: none;
		}

		.cell-select:focus,
		.cell-input:focus {
			border-color: var(--green);
		}

		.cell-form-actions {
			display: flex;
			gap: 0.3rem;
		}

		.btn-ok {
			padding: 0.25rem 0.6rem;
			font-size: 0.75rem;
			font-family: inherit;
			font-weight: 600;
			background: var(--green);
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		}

		.btn-cancel-cell {
			padding: 0.25rem 0.5rem;
			font-size: 0.75rem;
			font-family: inherit;
			background: none;
			border: 1px solid var(--border-strong);
			border-radius: 4px;
			color: var(--text-muted);
			cursor: pointer;
		}

		.confirm-bar {
			bottom: 0;
			border-radius: 0 0 var(--radius-lg) var(--radius-lg);
		}
	}
</style>
