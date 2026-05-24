import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function readPreferredTheme(): Theme {
	if (typeof window === 'undefined') {
		return 'light';
	}

	const stored = window.localStorage.getItem('theme');
	if (stored === 'light' || stored === 'dark') {
		return stored;
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>('light');

	useEffect(() => {
		const preferredTheme = readPreferredTheme();
		setTheme(preferredTheme);
		document.documentElement.dataset.theme = preferredTheme;
	}, []);

	function toggleTheme() {
		const nextTheme = theme === 'dark' ? 'light' : 'dark';
		setTheme(nextTheme);
		document.documentElement.dataset.theme = nextTheme;
		window.localStorage.setItem('theme', nextTheme);
	}

	return (
		<button
			className="theme-toggle"
			type="button"
			onClick={toggleTheme}
			aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
		>
			{theme === 'dark' ? 'Light' : 'Dark'}
		</button>
	);
}
