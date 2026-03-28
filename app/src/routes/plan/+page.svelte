<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
	type Slot = 'lunch' | 'dinner';

	const DAYS: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
	const DAY_LABELS: Record<Day, string> = {
		monday: 'Montag',
		tuesday: 'Dienstag',
		wednesday: 'Mittwoch',
		thursday: 'Donnerstag',
		friday: 'Freitag',
		saturday: 'Samstag',
		sunday: 'Sonntag'
	};
	const SLOT_LABELS: Record<Slot, string> = { lunch: 'Mittag', dinner: 'Abend' };

	// Thursday has no lunch
	function hasSlot(day: Day, slot: Slot) {
		return !(day === 'thursday' && slot === 'lunch');
	}

	function getEntry(day: Day, slot: Slot) {
		return data.entries.find((e) => e.day === day && e.slot === slot) ?? null;
	}

	function getRecipe(id: number | null) {
		if (!id) return null;
		return data.allRecipes.find((r) => r.id === id) ?? null;
	}

	// Editing state: track which slot is being edited
	let editing: string | null = $state(null);
	function slotKey(day: Day, slot: Slot) {
		return `${day}-${slot}`;
	}

	// For "start planning" form
	let startDay: Day = $state('monday');
	let startSlot: Slot = $state('dinner');

	// When startDay changes, ensure slot is valid
	$effect(() => {
		if (startDay === 'thursday' && startSlot === 'lunch') {
			startSlot = 'dinner';
		}
	});
</script>

<div class="page-header">
	<h1>Wochenplan</h1>
	<span class="week-label">Woche ab {data.weekStart}</span>
</div>

{#if !data.meta?.planningStartDay}
	<!-- Planning not started yet -->
	<div class="start-card">
		<h2>Planung starten</h2>
		<p class="start-hint">
			Wähle den ersten Tag und die erste Mahlzeit, die automatisch befüllt werden soll.
		</p>
		<form method="post" action="?/startPlanning" use:enhance class="start-form">
			<div class="start-fields">
				<label>
					<span>Erster Tag</span>
					<select name="startDay" bind:value={startDay}>
						{#each DAYS as day}
							<option value={day}>{DAY_LABELS[day]}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Erste Mahlzeit</span>
					<select name="startSlot" bind:value={startSlot}>
						{#if startDay !== 'thursday'}
							<option value="lunch">Mittag</option>
						{/if}
						<option value="dinner">Abend</option>
					</select>
				</label>
			</div>
			<button type="submit" class="btn-start">Planung starten</button>
		</form>
	</div>
{/if}

<!-- Mobile: day cards -->
<div class="day-cards">
	{#each DAYS as day}
		<div class="day-card">
			<div class="day-name">{DAY_LABELS[day]}</div>
			{#each ['lunch', 'dinner'] as slotStr}
				{@const slot = slotStr as Slot}
				{#if hasSlot(day, slot)}
					{@const entry = getEntry(day, slot)}
					{@const recipe = getRecipe(entry?.recipeId ?? null)}
					{@const key = slotKey(day, slot)}
					<div class="slot-row">
						<span class="slot-label">{SLOT_LABELS[slot]}</span>
						<div class="slot-content">
							{#if entry}
								<span class="meal-name">
									{#if recipe?.recipeUrl}
										<a href={recipe.recipeUrl} target="_blank" rel="noopener"
											>{recipe?.name ?? entry.freeText}</a
										>
									{:else}
										{recipe?.name ?? entry.freeText}
									{/if}
								</span>
								<form method="post" action="?/clearSlot" use:enhance>
									<input type="hidden" name="day" value={day} />
									<input type="hidden" name="slot" value={slot} />
									<button type="submit" class="btn-clear" title="Leeren">✕</button>
								</form>
							{:else if editing === key}
								<form
									method="post"
									action="?/setSlot"
									use:enhance={() => {
										return ({ update }) => {
											editing = null;
											update();
										};
									}}
									class="inline-form"
								>
									<input type="hidden" name="day" value={day} />
									<input type="hidden" name="slot" value={slot} />
									<select name="recipeId" class="recipe-select">
										<option value="">— Freitext —</option>
										{#each data.allRecipes as recipe}
											<option value={recipe.id}>{recipe.name}</option>
										{/each}
									</select>
									<input type="text" name="freeText" placeholder="Freitext..." class="free-input" />
									<div class="inline-actions">
										<button type="submit" class="btn-save-slot">OK</button>
										<button type="button" class="btn-cancel-slot" onclick={() => (editing = null)}
											>✕</button
										>
									</div>
								</form>
							{:else}
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
				{/if}
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
						<td class="td-cell">
							{#if hasSlot(day, slot)}
								{@const entry = getEntry(day, slot)}
								{@const recipe = getRecipe(entry?.recipeId ?? null)}
								{@const key = slotKey(day, slot)}
								{#if entry}
									<div class="cell-filled">
										<span class="cell-name">
											{#if recipe?.recipeUrl}
												<a href={recipe.recipeUrl} target="_blank" rel="noopener"
													>{recipe?.name ?? entry.freeText}</a
												>
											{:else}
												{recipe?.name ?? entry.freeText}
											{/if}
										</span>
										<form method="post" action="?/clearSlot" use:enhance>
											<input type="hidden" name="day" value={day} />
											<input type="hidden" name="slot" value={slot} />
											<button type="submit" class="btn-clear-cell" title="Leeren">✕</button>
										</form>
									</div>
								{:else if editing === key}
									<form
										method="post"
										action="?/setSlot"
										use:enhance={() => {
											return ({ update }) => {
												editing = null;
												update();
											};
										}}
										class="cell-form"
									>
										<input type="hidden" name="day" value={day} />
										<input type="hidden" name="slot" value={slot} />
										<select name="recipeId" class="cell-select">
											<option value="">— Freitext —</option>
											{#each data.allRecipes as recipe}
												<option value={recipe.id}>{recipe.name}</option>
											{/each}
										</select>
										<input type="text" name="freeText" placeholder="Freitext..." class="cell-input" />
										<div class="cell-form-actions">
											<button type="submit" class="btn-ok">OK</button>
											<button
												type="button"
												class="btn-cancel-cell"
												onclick={() => (editing = null)}>✕</button
											>
										</div>
									</form>
								{:else}
									<button
										class="btn-add-cell"
										onclick={() => (editing = key)}
										disabled={!data.meta?.planningStartDay}
									>
										{data.meta?.planningStartDay ? '+' : '—'}
									</button>
								{/if}
							{:else}
								<span class="no-slot">—</span>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.page-header {
		display: flex;
		align-items: baseline;
		gap: 0.875rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.week-label {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	/* ── Start planning card ── */
	.start-card {
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		padding: 1.5rem 1.25rem;
		margin-bottom: 1.5rem;
		max-width: 480px;
	}

	.start-card h2 {
		margin-bottom: 0.5rem;
	}

	.start-hint {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin: 0 0 1.25rem;
	}

	.start-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

	.btn-start {
		align-self: flex-start;
		padding: 0.65rem 1.5rem;
		font-size: 0.95rem;
		font-family: inherit;
		font-weight: 600;
		background: var(--green);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-start:hover {
		background: var(--green-dark);
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
		font-size: 0.875rem;
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
	}

	.slot-row:last-child {
		border-bottom: none;
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

	/* Inline edit form (mobile) */
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

	/* ── Desktop grid ── */
	@media (min-width: 768px) {
		.day-cards {
			display: none;
		}

		.plan-grid {
			display: block;
			overflow-x: auto;
		}

		table {
			width: 100%;
			border-collapse: collapse;
			background: var(--surface);
			border-radius: var(--radius-lg);
			box-shadow: var(--shadow);
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

		thead tr:last-child th,
		tbody tr:last-child td {
			/* handled below */
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
		}

		.cell-filled {
			display: flex;
			align-items: flex-start;
			gap: 0.25rem;
			padding: 0.6rem 0.75rem;
			height: 100%;
		}

		.cell-name {
			flex: 1;
			font-size: 0.875rem;
			line-height: 1.35;
		}

		.cell-name a {
			color: var(--text);
			text-decoration: none;
		}

		.cell-name a:hover {
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

		.no-slot {
			display: block;
			padding: 0.6rem 0.75rem;
			color: var(--border);
			font-size: 0.875rem;
		}

		/* Cell form (desktop) */
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
	}
</style>
