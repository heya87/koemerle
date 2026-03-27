<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<h1>Korb</h1>
<p class="week">Woche ab {data.weekStart}</p>

{#if data.items.length === 0}
	<p class="empty">Noch keine Zutaten im Korb.</p>
{:else}
	<ul class="item-list">
		{#each data.items as item}
			<li>
				<span class="display">{item.displayText}</span>
				<span class="key">({item.matchKey})</span>
				<form method="post" action="?/remove" use:enhance>
					<input type="hidden" name="id" value={item.id} />
					<button type="submit" class="remove">✕</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<form method="post" action="?/add" use:enhance class="add-form">
	<input
		type="text"
		name="displayText"
		placeholder="z.B. 3 Karotten"
		required
		autofocus
	/>
	<button type="submit">Hinzufügen</button>
</form>

{#if form?.message}
	<p class="error">{form.message}</p>
{/if}

<style>
	.week {
		color: #666;
		margin-top: -0.5rem;
		margin-bottom: 1.5rem;
	}

	.empty {
		color: #888;
	}

	.item-list {
		list-style: none;
		padding: 0;
		margin: 0 0 1.5rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.display {
		font-size: 1rem;
	}

	.key {
		font-size: 0.8rem;
		color: #999;
	}

	.remove {
		margin-left: auto;
		background: none;
		border: none;
		color: #aaa;
		cursor: pointer;
		font-size: 0.9rem;
		padding: 0.25rem 0.5rem;
	}

	.remove:hover {
		color: #e00;
	}

	.add-form {
		display: flex;
		gap: 0.5rem;
	}

	.add-form input {
		padding: 0.5rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		flex: 1;
	}

	.add-form button {
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
	}

	.error {
		color: red;
		margin-top: 0.5rem;
	}
</style>
