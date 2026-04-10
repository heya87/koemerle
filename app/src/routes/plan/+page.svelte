<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { tick, onMount } from 'svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Slot = 'lunch' | 'dinner';
	type Course = 'main' | 'side';
	type DraftEntry = {
		date: string;
		slot: Slot;
		course: Course;
		recipeId: number | null;
		recipeName: string | null;
		recipeUrl: string | null;
		notNeeded: boolean;
	};

	const NOT_NEEDED = '__not_needed__';
	const SLOT_LABELS: Record<Slot, string> = { lunch: 'Mittag', dinner: 'Abend' };
	const COURSES: Course[] = ['main', 'side'];
	const DESKTOP_DAYS = 7;
	const MOBILE_VISIBLE = 5; // day cards visible at once on mobile

	// ── Date helpers ──
	function addDays(dateStr: string, n: number): string {
		const d = new Date(dateStr + 'T12:00:00Z');
		d.setUTCDate(d.getUTCDate() + n);
		return d.toISOString().split('T')[0];
	}

	function formatDayHeader(iso: string): string {
		const d = new Date(iso + 'T12:00:00Z');
		const names = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
		return `${names[d.getUTCDay()]}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
	}

	function formatShortDate(iso: string): string {
		const [, m, d] = iso.split('-');
		return `${Number(d)}.${Number(m)}.`;
	}

	function formatDate(iso: string): string {
		const [y, m, d] = iso.split('-');
		return `${d}.${m}.${y}`;
	}

	function getDatesBetween(start: string, end: string): string[] {
		if (!start || !end || start > end) return [];
		const dates: string[] = [];
		const e = new Date(end + 'T12:00:00Z');
		const c = new Date(start + 'T12:00:00Z');
		while (c <= e) {
			dates.push(c.toISOString().split('T')[0]);
			c.setUTCDate(c.getUTCDate() + 1);
		}
		return dates;
	}

	// ── View navigation ──
	let viewStartDate: string = $state(data.today);
	let desktopDates = $derived(
		Array.from({ length: DESKTOP_DAYS }, (_, i) => addDays(viewStartDate, i))
	);
	// Mobile: 7-card vertical strip (1 buffer + 5 visible + 1 buffer)
	let mobileStripDates = $derived(
		Array.from({ length: MOBILE_VISIBLE + 2 }, (_, i) => addDays(viewStartDate, i - 1))
	);
	// Desktop: 9-column strip (1 buffer + 7 visible + 1 buffer), slides by 1 column = 1/7 container
	let desktopTrackDates = $derived(
		Array.from({ length: 9 }, (_, i) => addDays(viewStartDate, i - 1))
	);

	// ── Slide tracks ──
	const SLIDE_MS = 550;
	let isAnimating = $state(false);
	let mobileWrapper: HTMLElement | undefined = $state();
	let mobileTrack: HTMLElement | undefined = $state();
	let desktopTrack: HTMLElement | undefined = $state();

	function desktopColWidth(): number {
		return (desktopTrack?.parentElement?.offsetWidth ?? 0) / 7;
	}

	function mobileCardHeight(): number {
		// strip has MOBILE_VISIBLE + 2 equal-height cards
		return (mobileTrack?.offsetHeight ?? 0) / (MOBILE_VISIBLE + 2);
	}

	onMount(() => {
		if (desktopTrack) {
			desktopTrack.style.transform = `translateX(${-desktopColWidth()}px)`;
		}
		if (mobileWrapper && mobileTrack) {
			const cardH = mobileCardHeight();
			mobileWrapper.style.height = `${MOBILE_VISIBLE * cardH}px`;
			mobileTrack.style.transform = `translateY(${-cardH}px)`;
		}
	});

	async function navDay(delta: number) {
		if (isAnimating) return;
		isAnimating = true;

		const easing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

		// Mobile: slide vertically by exactly 1 card height
		if (mobileTrack) {
			const cardH = mobileCardHeight();
			const target = delta > 0 ? -2 * cardH : 0;
			mobileTrack.style.transition = `transform ${SLIDE_MS}ms ${easing}`;
			mobileTrack.style.transform = `translateY(${target}px)`;
		}

		// Desktop: slide exactly 1 column width in pixels
		if (desktopTrack) {
			const colW = desktopColWidth();
			const target = delta > 0 ? -2 * colW : 0;
			desktopTrack.style.transition = `transform ${SLIDE_MS}ms ${easing}`;
			desktopTrack.style.transform = `translateX(${target}px)`;
		}

		await new Promise<void>((r) => setTimeout(r, SLIDE_MS + 20));

		viewStartDate = addDays(viewStartDate, delta);
		await tick();

		if (mobileWrapper && mobileTrack) {
			const cardH = mobileCardHeight();
			mobileWrapper.style.height = `${MOBILE_VISIBLE * cardH}px`;
			mobileTrack.style.transition = 'none';
			mobileTrack.style.transform = `translateY(${-cardH}px)`;
		}
		if (desktopTrack) {
			desktopTrack.style.transition = 'none';
			desktopTrack.style.transform = `translateX(${-desktopColWidth()}px)`;
		}

		isAnimating = false;
	}

	// ── Draft state ──
	let draft: DraftEntry[] | null = $state(null);
	let draftStartDate: string | null = $state(null);
	let draftEndDate: string | null = $state(null);
	let draftStartSlot: Slot | null = $state(null);

	$effect(() => {
		if (form && 'suggestion' in form && Array.isArray((form as any).suggestion)) {
			draft = (form as any).suggestion.map((e: DraftEntry) => ({ ...e }));
			draftStartDate = (form as any).startDate;
			draftEndDate = (form as any).endDate;
			draftStartSlot = (form as any).startSlot;
			if (draftStartDate) viewStartDate = draftStartDate;
		}
	});

	function getDraftEntry(date: string, slot: Slot, course: Course): DraftEntry | null {
		return draft?.find((e) => e.date === date && e.slot === slot && e.course === course) ?? null;
	}

	function removeDraftEntry(date: string, slot: Slot, course: Course) {
		draft = draft?.filter((e) => !(e.date === date && e.slot === slot && e.course === course)) ?? null;
	}

	// Unified display — draft when active, otherwise DB
	type DbEntry = (typeof data.entries)[number];
	function getEntry(date: string, slot: Slot, course: Course): DraftEntry | DbEntry | null {
		if (draft !== null) return getDraftEntry(date, slot, course);
		return data.entries.find((e) => e.date === date && e.slot === slot && e.course === course) ?? null;
	}

	function isSlotNotNeeded(date: string, slot: Slot): boolean {
		const main = getEntry(date, slot, 'main');
		if (!main) return false;
		if ('notNeeded' in main) return main.notNeeded;
		return (main as DbEntry).freeText === NOT_NEEDED;
	}

	function getRecipe(id: number | null) {
		if (!id) return null;
		return data.allRecipes.find((r) => r.id === id) ?? null;
	}

	function entryLabel(entry: DraftEntry | DbEntry | null): string | null {
		if (!entry) return null;
		if ('recipeName' in entry) return entry.recipeName;
		const recipe = getRecipe((entry as DbEntry).recipeId ?? null);
		return recipe?.name ?? (entry as DbEntry).freeText ?? null;
	}

	function entryUrl(entry: DraftEntry | DbEntry | null): string | null {
		if (!entry) return null;
		if ('recipeUrl' in entry) return (entry as DraftEntry).recipeUrl;
		return getRecipe((entry as DbEntry).recipeId ?? null)?.recipeUrl ?? null;
	}

	// ── Modal ──
	let dialog: HTMLDialogElement | undefined = $state();
	let modalStartDate: string = $state(data.today);
	let modalEndDate: string = $state(addDays(data.today, 6));
	let modalStartSlot: Slot = $state('lunch');
	let modalDirect: boolean = $state(false);
	let notNeededChecked: Set<string> = $state(new Set());

	let modalDates = $derived(getDatesBetween(modalStartDate, modalEndDate));

	// Clamp endDate so it never goes before startDate
	$effect(() => {
		if (modalEndDate < modalStartDate) modalEndDate = modalStartDate;
	});

	function toggleNotNeeded(key: string) {
		const next = new Set(notNeededChecked);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		notNeededChecked = next;
	}

	function openModal(direct = false) {
		modalDirect = direct;
		modalStartDate = data.today;
		modalEndDate = addDays(data.today, 6);
		modalStartSlot = 'lunch';
		notNeededChecked = new Set();
		dialog?.showModal();
	}

	function closeModal() {
		dialog?.close();
	}

	// ── Editing (post-confirmation) ──
	let editing: string | null = $state(null);
	let editingPopup: { date: string; slot: Slot; course: Course; top: number; left: number; width: number } | null = $state(null);

	function entryKey(date: string, slot: Slot, course: Course) {
		return `${date}-${slot}-${course}`;
	}

	function openEditing(date: string, slot: Slot, course: Course, triggerEl: HTMLElement) {
		const rect = triggerEl.getBoundingClientRect();
		editing = entryKey(date, slot, course);
		editingPopup = { date, slot, course, top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 260) };
	}

	function closeEditing() {
		editing = null;
		editingPopup = null;
	}

	// ── Drag & drop ──
	let dragFrom: { date: string; slot: Slot; course: Course } | null = $state(null);
	let dragOverKey: string | null = $state(null);

	function onDragStart(e: DragEvent, date: string, slot: Slot, course: Course) {
		dragFrom = { date, slot, course };
		e.dataTransfer!.effectAllowed = 'move';
	}

	function onDragOver(e: DragEvent, date: string, slot: Slot, course: Course) {
		if (!dragFrom) return;
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		dragOverKey = entryKey(date, slot, course);
	}

	function onDragLeave(e: DragEvent) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
			dragOverKey = null;
		}
	}

	async function onDrop(e: DragEvent, toDate: string, toSlot: Slot, toCourse: Course) {
		e.preventDefault();
		dragOverKey = null;
		if (!dragFrom) return;
		const { date: fromDate, slot: fromSlot, course: fromCourse } = dragFrom;
		dragFrom = null;
		if (fromDate === toDate && fromSlot === toSlot && fromCourse === toCourse) return;

		if (draft !== null) {
			const fromIdx = draft.findIndex((e) => e.date === fromDate && e.slot === fromSlot && e.course === fromCourse);
			const toIdx = draft.findIndex((e) => e.date === toDate && e.slot === toSlot && e.course === toCourse);
			if (fromIdx === -1) return;
			draft = draft.map((e, i) => {
				if (i === fromIdx) return { ...e, date: toDate, slot: toSlot, course: toCourse };
				if (i === toIdx) return { ...e, date: fromDate, slot: fromSlot, course: fromCourse };
				return e;
			});
		} else {
			const fd = new FormData();
			fd.append('fromDate', fromDate);
			fd.append('fromSlot', fromSlot);
			fd.append('fromCourse', fromCourse);
			fd.append('toDate', toDate);
			fd.append('toSlot', toSlot);
			fd.append('toCourse', toCourse);
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

{#snippet courseEntry(date: string, slot: Slot, course: Course)}
	{@const entry = getEntry(date, slot, course)}
	{@const key = entryKey(date, slot, course)}
	{@const isDragging = dragFrom?.date === date && dragFrom?.slot === slot && dragFrom?.course === course}
	<div
		class="course-row"
		class:is-side={course === 'side'}
		class:drag-over={dragOverKey === key}
		ondragover={(e) => onDragOver(e, date, slot, course)}
		ondragleave={onDragLeave}
		ondrop={(e) => onDrop(e, date, slot, course)}
	>
		{#if entry}
			<span
				class="meal-chip"
				class:is-dragging={isDragging}
				draggable="true"
				title={entryLabel(entry) ?? undefined}
				ondragstart={(e) => onDragStart(e, date, slot, course)}
				ondragend={onDragEnd}
			>
				{#if entryUrl(entry)}
					<a href={entryUrl(entry)!} target="_blank" rel="noopener">{entryLabel(entry)}</a>
				{:else}
					{entryLabel(entry)}
				{/if}
			</span>
			{#if draft !== null}
				<button class="btn-clear-entry" title="Entfernen" onclick={() => removeDraftEntry(date, slot, course)}>✕</button>
			{:else}
				<form method="post" action="?/clearSlot" use:enhance>
					<input type="hidden" name="date" value={date} />
					<input type="hidden" name="slot" value={slot} />
					<input type="hidden" name="course" value={course} />
					<button type="submit" class="btn-clear-entry" title="Leeren">✕</button>
				</form>
			{/if}
		{:else if draft === null}
			<button
				class="btn-add-entry"
				class:btn-add-side={course === 'side'}
				class:is-editing={editing === key}
				onclick={(e) => openEditing(date, slot, course, (e.currentTarget as HTMLElement).closest('.day-slot-cell, .slot-courses') ?? e.currentTarget as HTMLElement)}
				disabled={!data.meta}
			>
				{#if !data.meta}
					{course === 'main' ? '—' : ''}
				{:else if course === 'side'}
					+ Beilage
				{:else}
					+ Hauptgang
				{/if}
			</button>
		{/if}
	</div>
{/snippet}

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
				<p class="modal-label">Planungszeitraum</p>
				<div class="date-range-fields">
					<label>
						<span>Von</span>
						<input type="date" name="startDate" bind:value={modalStartDate} required />
					</label>
					<label>
						<span>Bis</span>
						<input type="date" name="endDate" bind:value={modalEndDate} min={modalStartDate} required />
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

			{#if modalDates.length > 0}
				<div class="modal-section">
					<p class="modal-label">Nicht benötigt</p>
					<div class="nn-grid">
						{#each modalDates as date}
							<div class="nn-day">
								<span class="nn-day-name">{formatDayHeader(date)}</span>
								<div class="nn-slots">
									<label class="nn-check">
										<input
											type="checkbox"
											name="notNeeded"
											value="{date}-lunch"
											checked={notNeededChecked.has(`${date}-lunch`)}
											onchange={() => toggleNotNeeded(`${date}-lunch`)}
										/>
										Mittag
									</label>
									<label class="nn-check">
										<input
											type="checkbox"
											name="notNeeded"
											value="{date}-dinner"
											checked={notNeededChecked.has(`${date}-dinner`)}
											onchange={() => toggleNotNeeded(`${date}-dinner`)}
										/>
										Abend
									</label>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

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
	<h1>Mahlzeitenplan</h1>
	{#if data.meta}
		<span class="plan-period-label">
			{formatShortDate(data.meta.planStart)} – {formatShortDate(data.meta.planEnd)}
		</span>
	{/if}
</div>

<!-- Status bar -->
{#if draft !== null}
	<div class="draft-banner">
		<div class="draft-info">
			<span class="draft-label">Vorschlag</span>
			<span class="draft-hint">
				{formatShortDate(draftStartDate!)} – {formatShortDate(draftEndDate!)} &middot;
				Mahlzeiten per Drag &amp; Drop verschieben oder mit ✕ entfernen.
			</span>
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
				onclick={() => { draft = null; draftStartDate = null; draftEndDate = null; draftStartSlot = null; }}
			>
				Verwerfen
			</button>
		</div>
	</div>
{:else if data.meta}
	<div class="confirmed-bar">
		<span class="confirmed-label">
			Plan: {formatDate(data.meta.planStart)} – {formatDate(data.meta.planEnd)}
		</span>
		<button class="btn-replan" type="button" onclick={() => openModal(true)}>Neu vorschlagen</button>
	</div>
{:else}
	<div class="no-plan-bar">
		<button class="btn-open-modal" type="button" onclick={openModal}>Vorschlag erstellen</button>
		<span class="no-plan-hint">Noch kein Plan erstellt.</span>
	</div>
{/if}

<!-- Pager navigation -->
<div class="pager-nav">
	<button class="btn-nav" onclick={() => navDay(-1)} aria-label="Vorheriger Tag">&#8249;</button>
	<button class="btn-today" onclick={() => (viewStartDate = data.today)}>Heute</button>
	<button class="btn-nav" onclick={() => navDay(1)} aria-label="Nächster Tag">&#8250;</button>
</div>

{#snippet dayCardsList(dates: string[])}
	<div class="day-cards">
		{#each dates as date}
			<div class="day-card">
				<div class="day-date-col" class:is-today={date === data.today}>
					{formatDayHeader(date)}
				</div>
				<div class="day-slots">
					{#each ['lunch', 'dinner'] as slotStr}
						{@const slot = slotStr as Slot}
						<div class="slot-row">
							<span class="slot-label">{SLOT_LABELS[slot]}</span>
							<div class="slot-courses">
								{#if isSlotNotNeeded(date, slot)}
									<div class="course-row">
										<span class="meal-chip not-needed">Nicht benötigt</span>
										{#if draft !== null}
											<button class="btn-clear-entry" onclick={() => removeDraftEntry(date, slot, 'main')}>✕</button>
										{:else}
											<form method="post" action="?/clearSlot" use:enhance>
												<input type="hidden" name="date" value={date} />
												<input type="hidden" name="slot" value={slot} />
												<input type="hidden" name="course" value="main" />
												<button type="submit" class="btn-clear-entry">✕</button>
											</form>
										{/if}
									</div>
								{:else}
									{#each COURSES as course}
										{@render courseEntry(date, slot, course)}
									{/each}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet dayColsList(dates: string[])}
	{#each dates as date}
		<div class="day-col">
			<div class="day-col-header" class:today-col={date === data.today}>
				{formatDayHeader(date)}
			</div>
			{#each ['lunch', 'dinner'] as slotStr}
				{@const slot = slotStr as Slot}
				<div class="day-slot-cell" class:today-col={date === data.today}>
					{#if isSlotNotNeeded(date, slot)}
						<div class="cell-not-needed">
							<span class="meal-chip not-needed">Nicht benötigt</span>
							{#if draft !== null}
								<button class="btn-clear-entry" onclick={() => removeDraftEntry(date, slot, 'main')}>✕</button>
							{:else}
								<form method="post" action="?/clearSlot" use:enhance>
									<input type="hidden" name="date" value={date} />
									<input type="hidden" name="slot" value={slot} />
									<input type="hidden" name="course" value="main" />
									<button type="submit" class="btn-clear-entry">✕</button>
								</form>
							{/if}
						</div>
					{:else}
						{#each COURSES as course}
							{@render courseEntry(date, slot, course)}
						{/each}
					{/if}
				</div>
			{/each}
		</div>
	{/each}
{/snippet}

<!-- Mobile: vertical strip (1 buffer + 5 visible + 1 buffer) -->
<div class="slide-wrapper" bind:this={mobileWrapper}>
	<div class="mobile-track" bind:this={mobileTrack}>
		{@render dayCardsList(mobileStripDates)}
	</div>
</div>

<!-- Desktop: fixed label column + 3-panel sliding day columns -->
<div class="plan-grid">
	<div class="label-col">
		<div class="label-spacer"></div>
		<div class="label-slot">Mittag</div>
		<div class="label-slot">Abend</div>
	</div>
	<div class="days-area">
		<div class="desktop-track" bind:this={desktopTrack}>
			{@render dayColsList(desktopTrackDates)}
		</div>
	</div>
</div>

<!-- Plant diversity bar -->
{#if draft === null}
	{@const pct = Math.min(data.plantCount / data.plantGoal, 1)}
	{@const full = data.plantCount >= data.plantGoal}
	<div class="plant-bar">
		<div class="plant-bar-header">
			<span class="plant-bar-label">Pflanzliche Vielfalt</span>
			<span class="plant-bar-count" class:plant-full={full}>
				{#if full}🎉{:else}🌱{/if}
				{data.plantCount} / {data.plantGoal}
			</span>
		</div>
		<div class="plant-track">
			<div class="plant-fill" style="width: {pct * 100}%" class:plant-fill-full={full}></div>
		</div>
	</div>

	{#if data.nutrientSummary.totalMealsWithRecipe > 0}
		{@const ns = data.nutrientSummary}
		<div class="nutrient-bar">
			<div class="nutrient-bar-header">
				<span class="nutrient-bar-label">Makronährstoffe</span>
				<span class="nutrient-bar-detail">{ns.mealsWithData} / {ns.totalMealsWithRecipe} Mahlzeiten mit Daten</span>
			</div>
			{#if ns.hasData && ns.actualCarbsPct !== null}
				{@const carbs = Math.round(ns.actualCarbsPct * 100)}
				{@const fat   = Math.round((ns.actualFatPct ?? 0) * 100)}
				{@const prot  = Math.round((ns.actualProteinPct ?? 0) * 100)}
				<div class="macro-rows">
					<div class="macro-row">
						<span class="macro-name">Kohlenhydrate</span>
						<div class="macro-bars">
							<div class="macro-track">
								<div class="macro-seg macro-carbs" style="width: {carbs}%"></div>
							</div>
							<div class="macro-track macro-track-ideal">
								<div class="macro-seg macro-carbs" style="width: 50%"></div>
							</div>
						</div>
						<span class="macro-pct">{carbs}% <span class="macro-ideal">/ 50%</span></span>
					</div>
					<div class="macro-row">
						<span class="macro-name">Fett</span>
						<div class="macro-bars">
							<div class="macro-track">
								<div class="macro-seg macro-fat" style="width: {fat}%"></div>
							</div>
							<div class="macro-track macro-track-ideal">
								<div class="macro-seg macro-fat" style="width: 30%"></div>
							</div>
						</div>
						<span class="macro-pct">{fat}% <span class="macro-ideal">/ 30%</span></span>
					</div>
					<div class="macro-row">
						<span class="macro-name">Protein</span>
						<div class="macro-bars">
							<div class="macro-track">
								<div class="macro-seg macro-protein" style="width: {prot}%"></div>
							</div>
							<div class="macro-track macro-track-ideal">
								<div class="macro-seg macro-protein" style="width: 20%"></div>
							</div>
						</div>
						<span class="macro-pct">{prot}% <span class="macro-ideal">/ 20%</span></span>
					</div>
				</div>
				<p class="nutrient-kcal">{ns.totalKcal} kcal total (Plan)</p>
			{:else}
				<p class="nutrient-insufficient">Zu wenige Rezepte mit Nährwertdaten — bitte Rezepte ergänzen.</p>
			{/if}
		</div>
	{/if}
{/if}

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
					draftStartDate = null;
					draftEndDate = null;
					draftStartSlot = null;
					update();
				};
			}}
		>
			<input type="hidden" name="startDate" value={draftStartDate} />
			<input type="hidden" name="endDate" value={draftEndDate} />
			<input type="hidden" name="startSlot" value={draftStartSlot} />
			<input type="hidden" name="entries" value={JSON.stringify(draft)} />
			<button type="submit" class="btn-confirm">Plan bestätigen</button>
		</form>
	</div>
{/if}

<!-- Entry popup (fixed, outside all overflow containers) -->
{#if editingPopup}
	<div class="entry-popup-backdrop" onclick={closeEditing}></div>
	<form
		method="post"
		action="?/setSlot"
		use:enhance={() => async ({ update }) => { closeEditing(); await update(); }}
		class="entry-popup"
		style="top: {editingPopup.top}px; left: {editingPopup.left}px; width: {editingPopup.width}px;"
	>
		<input type="hidden" name="date" value={editingPopup.date} />
		<input type="hidden" name="slot" value={editingPopup.slot} />
		<input type="hidden" name="course" value={editingPopup.course} />
		<select name="recipeId" class="entry-select">
			<option value="">— Freitext —</option>
			{#each data.allRecipes as r}
				<option value={r.id}>{r.name}</option>
			{/each}
		</select>
		<input type="text" name="freeText" placeholder="Freitext..." class="entry-input" />
		<div class="entry-form-actions">
			<button type="submit" class="btn-ok">OK</button>
			<button type="button" class="btn-cancel-entry" onclick={closeEditing}>✕</button>
		</div>
	</form>
{/if}

<style>
	/* ── Modal ── */
	.modal-dialog {
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: 0 8px 32px rgba(42, 37, 32, 0.18);
		padding: 0;
		width: min(480px, 92vw);
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

	.date-range-fields {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.date-range-fields label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
		flex: 1;
		min-width: 140px;
	}

	.date-range-fields input[type='date'] {
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

	.date-range-fields input[type='date']:focus {
		border-color: var(--green);
	}

	/* Nicht benötigt grid */
	.nn-grid {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 220px;
		overflow-y: auto;
	}

	.nn-day {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.nn-day-name {
		font-size: 0.8rem;
		color: var(--text-muted);
		width: 100px;
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

	.start-slot-field select {
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

	.plan-period-label {
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

	/* ── Pager navigation ── */
	.pager-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.btn-nav {
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		padding: 0.3rem 0.7rem;
		font-size: 1.1rem;
		font-family: inherit;
		color: var(--text);
		cursor: pointer;
		line-height: 1;
		transition: background 0.15s;
	}

	.btn-nav:hover {
		background: var(--surface);
	}

	.btn-today {
		font-size: 0.8rem;
		font-family: inherit;
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		padding: 0.3rem 0.65rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.btn-today:hover {
		background: var(--surface);
		color: var(--text);
	}

	/* ── Shared course-row styles (mobile + desktop) ── */
	.course-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 1.8rem;
		border-radius: var(--radius);
		transition: background 0.1s;
		padding: 0.1rem 0.25rem;
	}

	.course-row.drag-over {
		background: var(--green-light);
		outline: 1.5px dashed var(--green);
	}

	.meal-chip {
		flex: 1;
		font-size: 0.9rem;
		cursor: grab;
		border-radius: 4px;
		padding: 0.1rem 0.15rem;
		transition: opacity 0.15s;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meal-chip:active {
		cursor: grabbing;
	}

	.meal-chip.is-dragging {
		opacity: 0.4;
	}

	.meal-chip.not-needed {
		color: var(--text-light);
		font-style: italic;
	}

	.meal-chip a {
		color: var(--text);
		text-decoration: none;
	}

	.meal-chip a:hover {
		color: var(--green);
		text-decoration: underline;
	}

	.is-side .meal-chip {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.is-side .meal-chip a {
		color: var(--text-muted);
	}

	.btn-clear-entry {
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

	.btn-clear-entry:hover {
		color: var(--red);
		background: #fdf0f0;
	}

	.btn-add-entry {
		background: none;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius);
		color: var(--text-light);
		font-size: 0.8rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
		font-family: inherit;
		transition: border-color 0.15s, color 0.15s;
		min-height: 2rem;
	}

	.btn-add-entry:hover:not(:disabled) {
		border-color: var(--green);
		color: var(--green);
	}

	.btn-add-entry:disabled {
		cursor: default;
		border-color: transparent;
	}

	.btn-add-side {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		opacity: 0.6;
	}

	.btn-add-side:hover:not(:disabled) {
		opacity: 1;
	}

	.entry-popup-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	.entry-popup {
		position: fixed;
		z-index: 100;
		background: var(--surface);
		border: 1.5px solid var(--green);
		border-radius: var(--radius);
		box-shadow: 0 4px 20px rgba(42, 37, 32, 0.18);
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 200px;
	}

	.entry-select,
	.entry-input {
		width: 100%;
		padding: 0.35rem 0.5rem;
		font-size: 0.875rem;
		font-family: inherit;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		outline: none;
	}

	.entry-select:focus,
	.entry-input:focus {
		border-color: var(--green);
	}

	.entry-form-actions {
		display: flex;
		gap: 0.4rem;
	}

	.btn-ok {
		padding: 0.25rem 0.6rem;
		font-size: 0.8rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.btn-cancel-entry {
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
		font-family: inherit;
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		color: var(--text-muted);
		cursor: pointer;
	}

	/* ── Slide wrapper ── */
	.slide-wrapper {
		overflow: hidden;
		width: 100%;
	}

	.mobile-track {
		/* height set by JS; cards stack naturally */
	}

	/* ── Mobile day cards ── */
	.day-cards {
		display: flex;
		flex-direction: column;
		gap: 3px;
		border: 1.5px solid var(--border-strong);
		border-radius: 18px;
		overflow: hidden;
		box-shadow: var(--shadow-md);
		background: var(--border-strong);
	}

	.plan-grid {
		display: none;
	}

	.day-card {
		display: flex;
		flex-direction: row;
		background: var(--surface);
	}

	.day-card:first-child {
		border-radius: 16px 16px 0 0;
		overflow: hidden;
	}

	.day-card:last-child {
		border-radius: 0 0 16px 16px;
		overflow: hidden;
	}

	/* Rotated date sidebar — reads bottom to top */
	.day-date-col {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		text-orientation: mixed;
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		background: var(--bg);
		border-right: 1px solid var(--border);
		padding: 0.5rem 0.3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		min-width: 1.75rem;
	}

	.day-date-col.is-today {
		background: var(--green);
		color: white;
		border-right-color: var(--green-dark);
	}

	.day-slots {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.slot-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.35rem 0.65rem;
		border-bottom: 1px solid var(--border);
	}

	.slot-row:last-child {
		border-bottom: none;
	}

	.slot-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 500;
		width: 44px;
		flex-shrink: 0;
		padding-top: 0.15rem;
	}

	.slot-courses {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.cell-not-needed {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.1rem 0.25rem;
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

	/* ── Plant diversity bar ── */
	.plant-bar {
		margin-top: 1.25rem;
		background: var(--surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 0.875rem 1rem;
	}

	.plant-bar-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.plant-bar-label {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	.plant-bar-count {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-muted);
		transition: color 0.3s;
	}

	.plant-bar-count.plant-full {
		color: var(--green-dark);
	}

	.plant-track {
		height: 8px;
		background: var(--bg);
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.plant-fill {
		height: 100%;
		background: var(--green);
		border-radius: 999px;
		transition: width 0.4s ease;
	}

	.plant-fill.plant-fill-full {
		background: var(--green-dark);
	}

	/* ── Nutrient / macro bar ── */
	.nutrient-bar {
		margin-top: 0.75rem;
		background: var(--surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 0.875rem 1rem;
	}

	.nutrient-bar-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.75rem;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.nutrient-bar-label {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	.nutrient-bar-detail {
		font-size: 0.75rem;
		color: var(--text-light);
	}

	.macro-rows {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.macro-row {
		display: grid;
		grid-template-columns: 6rem 1fr 4rem;
		align-items: center;
		gap: 0.5rem;
	}

	.macro-name {
		font-size: 0.8rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.macro-bars {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.macro-track {
		height: 8px;
		border-radius: 4px;
		background: var(--bg);
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.macro-track-ideal {
		opacity: 0.35;
	}

	.macro-seg {
		height: 100%;
		border-radius: 4px;
		transition: width 0.4s ease;
	}

	.macro-carbs   { background: #6ea8d6; }
	.macro-fat     { background: #e8a87c; }
	.macro-protein { background: var(--green); }

	.macro-pct {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text);
		text-align: right;
		white-space: nowrap;
	}

	.macro-ideal {
		font-weight: 400;
		color: var(--text-light);
	}

	.nutrient-kcal {
		font-size: 0.78rem;
		color: var(--text-light);
		margin: 0.6rem 0 0;
	}

	.nutrient-insufficient {
		font-size: 0.825rem;
		color: var(--text-light);
		font-style: italic;
		margin: 0;
	}

	/* ── Desktop grid ── */
	@media (min-width: 768px) {
		.slide-wrapper {
			display: none;
		}

		.plan-grid {
			display: flex;
			border: 1.5px solid var(--border-strong);
			border-radius: var(--radius-lg);
			box-shadow: var(--shadow);
			background: var(--surface);
			overflow: hidden;
		}

		/* Fixed slot-label column */
		.label-col {
			width: 68px;
			flex-shrink: 0;
			display: flex;
			flex-direction: column;
			background: var(--bg);
			border-right: 1px solid var(--border-strong);
			z-index: 1;
		}

		.label-spacer {
			height: 2.4rem;
			border-bottom: 1px solid var(--border);
		}

		.label-slot {
			flex: 1;
			display: flex;
			align-items: center;
			padding: 0 0.75rem;
			font-size: 0.8rem;
			font-weight: 500;
			color: var(--text-muted);
			border-bottom: 1px solid var(--border);
		}

		.label-slot:last-child {
			border-bottom: none;
		}

		/* Animated days area */
		.days-area {
			flex: 1;
			min-width: 0;
			overflow: clip;
		}

		.desktop-track {
			display: flex;
			/* 9 columns, each 1/7 of .days-area — track is 9/7 × container wide */
			width: calc(9 * 100% / 7);
			height: 100%;
		}

		.day-col {
			flex: 1;
			display: flex;
			flex-direction: column;
			border-right: 1px solid var(--border);
			min-width: 0;
		}

		.day-col:last-child {
			border-right: none;
		}

		.day-col-header {
			height: 2.4rem;
			display: flex;
			align-items: center;
			padding: 0 0.75rem;
			font-size: 0.75rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--text-muted);
			background: var(--bg);
			border-bottom: 1px solid var(--border);
			white-space: nowrap;
			overflow: hidden;
		}

		.day-col-header.today-col {
			color: var(--green-dark);
			background: var(--green-light);
		}

		.day-slot-cell {
			flex: 1;
			padding: 0.35rem 0.4rem;
			border-bottom: 1px solid var(--border);
			overflow: hidden;
			position: relative;
		}

		.day-slot-cell:last-child {
			border-bottom: none;
		}

		.day-slot-cell.today-col {
			background: color-mix(in srgb, var(--green-light) 40%, var(--surface));
		}

		.day-slot-cell .course-row {
			padding: 0.2rem 0.3rem;
		}

		.day-slot-cell .meal-chip {
			font-size: 0.825rem;
			background: var(--bg);
			border: 1px solid var(--border-strong);
			border-radius: var(--radius);
			padding: 0.25rem 0.5rem;
			transition: opacity 0.15s, box-shadow 0.15s;
			display: block;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.day-slot-cell .meal-chip:hover {
			box-shadow: 0 1px 4px rgba(42, 37, 32, 0.1);
		}

		.day-slot-cell .meal-chip.is-dragging {
			opacity: 0.35;
		}

		.day-slot-cell .meal-chip.not-needed {
			border-style: dashed;
		}

		.day-slot-cell .meal-chip a {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			display: block;
		}

		.day-slot-cell .is-side .meal-chip {
			font-size: 0.75rem;
			background: transparent;
			border-color: var(--border);
		}

		.day-slot-cell .btn-clear-entry {
			font-size: 0.7rem;
			padding: 0.15rem 0.3rem;
			opacity: 0;
		}

		.day-slot-cell .course-row:hover .btn-clear-entry {
			opacity: 1;
		}

		.day-slot-cell .btn-add-entry {
			display: block;
			width: 100%;
			font-size: 0.75rem;
			padding: 0.2rem 0.4rem;
			text-align: left;
		}

		.day-slot-cell .btn-add-side {
			font-size: 0.7rem;
			opacity: 0.5;
		}

		.day-slot-cell:hover .btn-add-side {
			opacity: 1;
		}

		.day-slot-cell .btn-add-entry.is-editing {
			border-color: var(--green);
			color: var(--green);
		}

		.day-slot-cell .entry-select,
		.day-slot-cell .entry-input {
			font-size: 0.8rem;
			padding: 0.3rem 0.45rem;
		}

		.cell-not-needed {
			padding: 0.35rem 0.4rem;
		}

		.confirm-bar {
			bottom: 0;
			border-radius: 0 0 var(--radius-lg) var(--radius-lg);
		}
	}
</style>
