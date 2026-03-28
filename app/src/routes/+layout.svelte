<script lang="ts">
	import '../app.css';
	import { enhance } from '$app/forms';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data }: { children: any; data: LayoutData } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user}
	<header class="top-bar">
		<span class="brand">Körmerle</span>
		<nav class="desktop-nav">
			<a href="/plan">Wochenplan</a>
			<a href="/recipes">Rezepte</a>
			<a href="/basket">Korb</a>
		</nav>
		<div class="user-area">
			<span class="username">{data.user.name}</span>
			<form method="post" action="/logout" use:enhance>
				<button type="submit" class="btn-logout">Abmelden</button>
			</form>
		</div>
	</header>

	<nav class="tab-bar">
		<a href="/plan">Wochenplan</a>
		<a href="/recipes">Rezepte</a>
		<a href="/basket">Korb</a>
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
