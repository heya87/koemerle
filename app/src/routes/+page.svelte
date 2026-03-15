<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<h1>Koemerle</h1>

<h2>Tasks from DB</h2>

{#if data.tasks.length === 0}
	<p>No tasks yet.</p>
{:else}
	<ul>
		{#each data.tasks as task}
			<li>{task.title} (priority: {task.priority})</li>
		{/each}
	</ul>
{/if}
