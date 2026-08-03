<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Meal = (typeof data.meals)[number];
	let selected: Meal | null = $state(null);

	const SLOT_LABELS: Record<string, string> = { lunch: 'Mittag', dinner: 'Abend' };

	function formatDayHeader(iso: string): string {
		const d = new Date(iso + 'T12:00:00Z');
		const names = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
		return `${names[d.getUTCDay()]}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
	}

	let groupedByDate = $derived.by(() => {
		const groups: { date: string; meals: Meal[] }[] = [];
		for (const meal of data.meals) {
			const last = groups.at(-1);
			if (last && last.date === meal.date) last.meals.push(meal);
			else groups.push({ date: meal.date, meals: [meal] });
		}
		return groups;
	});
</script>

<h1 class="page-title">Clara-Ansicht</h1>

{#if data.meals.length === 0}
	<p class="empty">Keine geplanten Mahlzeiten.</p>
{:else}
	{#each groupedByDate as group (group.date)}
		<div class="day-group">
			<h2 class="day-heading" class:is-today={group.date === data.today}>
				{formatDayHeader(group.date)}
			</h2>
			<ul class="meal-list">
				{#each group.meals as meal}
					<li>
						<button type="button" class="meal-row" onclick={() => (selected = meal)}>
							<span class="slot-label">{SLOT_LABELS[meal.slot] ?? meal.slot}</span>
							<span class="meal-name">{meal.name}</span>
							<span class="chevron">›</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
{/if}

{#if selected}
	{@const meal = selected}
	<div class="detail-backdrop" onclick={() => (selected = null)}></div>
	<div class="detail-panel">
		<div class="detail-header">
			<h2>{meal.name}</h2>
			<button type="button" class="detail-close" onclick={() => (selected = null)} aria-label="Schliessen">✕</button>
		</div>
		{#if meal.recipe}
			{#if meal.recipe.recipeUrl}
				<a href={meal.recipe.recipeUrl} target="_blank" rel="noopener" class="detail-link">Rezept öffnen ↗</a>
			{/if}
			<h3>Zutaten</h3>
			<pre class="detail-ingredients">{meal.recipe.ingredients}</pre>
			{#if meal.recipe.preparation}
				<h3>Zubereitung</h3>
				<p class="detail-prep">{meal.recipe.preparation}</p>
			{/if}
		{:else}
			<p class="detail-note">Freitext-Eintrag — keine weiteren Details gespeichert.</p>
		{/if}
	</div>
{/if}

<style>
	.page-title {
		margin-bottom: 1.25rem;
	}

	.empty {
		color: var(--text-muted);
	}

	.day-group {
		margin-bottom: 1.25rem;
	}

	.day-heading {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		margin: 0 0 0.5rem;
	}

	.day-heading.is-today {
		color: var(--green-dark);
	}

	.meal-list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		overflow: hidden;
	}

	.meal-list li + li {
		border-top: 1px solid var(--border);
	}

	.meal-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.975rem;
		text-align: left;
		color: var(--text);
		cursor: pointer;
		transition: background 0.15s;
	}

	.meal-row:hover {
		background: var(--bg);
	}

	.slot-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-muted);
		width: 3.5rem;
		flex-shrink: 0;
	}

	.meal-name {
		flex: 1;
	}

	.chevron {
		color: var(--text-light);
		flex-shrink: 0;
	}

	.detail-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(42, 37, 32, 0.45);
		z-index: 99;
	}

	.detail-panel {
		position: fixed;
		z-index: 100;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(480px, 92vw);
		max-height: 82vh;
		overflow-y: auto;
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: 0 8px 32px rgba(42, 37, 32, 0.18);
		padding: 1.25rem 1.5rem;
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.detail-close {
		background: none;
		border: none;
		font-size: 1rem;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.detail-close:hover {
		color: var(--text);
	}

	.detail-link {
		display: inline-block;
		font-size: 0.875rem;
		color: var(--green);
		margin-bottom: 0.75rem;
	}

	.detail-panel h3 {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		margin: 0.875rem 0 0.4rem;
	}

	.detail-ingredients {
		font-family: inherit;
		font-size: 0.9rem;
		white-space: pre-wrap;
		margin: 0;
		color: var(--text);
	}

	.detail-prep {
		font-size: 0.9rem;
		line-height: 1.5;
		margin: 0;
		color: var(--text);
	}

	.detail-note {
		font-size: 0.875rem;
		color: var(--text-muted);
	}
</style>
