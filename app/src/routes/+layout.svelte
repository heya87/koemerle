<script lang="ts">
	import { enhance } from '$app/forms';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data }: { children: any; data: LayoutData } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user}
	<nav>
		<div class="nav-links">
			<a href="/plan">Wochenplan</a>
			<a href="/recipes">Rezepte</a>
			<a href="/basket">Korb</a>
		</div>
		<div class="nav-user">
			<span>{data.user.name}</span>
			<form method="post" action="/logout" use:enhance>
				<button type="submit">Abmelden</button>
			</form>
		</div>
	</nav>
{/if}

<main>
	{@render children()}
</main>

<style>
	nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.5rem;
		border-bottom: 1px solid #ddd;
	}

	.nav-links {
		display: flex;
		gap: 1.5rem;
	}

	.nav-links a {
		text-decoration: none;
		color: inherit;
	}

	.nav-links a:hover {
		text-decoration: underline;
	}

	.nav-user {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.9rem;
	}

	.nav-user button {
		font-size: 0.9rem;
		cursor: pointer;
	}

	main {
		padding: 1.5rem;
		max-width: 960px;
		margin: 0 auto;
	}
</style>
