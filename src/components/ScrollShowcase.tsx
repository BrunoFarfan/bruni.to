import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type ShowcaseItem = {
	title: string;
	href: string;
	eyebrow: string;
	summary: string;
	tags: string[];
	status: string;
	focus: string;
	visualTone: string;
	visualLabel?: string;
};

type Props = {
	items: ShowcaseItem[];
	kicker?: string;
	title?: string;
	description?: string;
};

export default function ScrollShowcase({ items, kicker, title, description }: Props) {
	const [activeIndex, setActiveIndex] = useState(0);
	const [previousIndex, setPreviousIndex] = useState(0);
	const [hasVisualTransition, setHasVisualTransition] = useState(false);
	const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down');
	const stageRef = useRef<HTMLDivElement | null>(null);
	const activeItem = items[activeIndex] ?? items[0];
	const previousItem = items[previousIndex] ?? activeItem;
	const previewIndex = activeIndex < items.length - 1 ? activeIndex + 1 : null;
	const previewItem = previewIndex === null ? null : items[previewIndex];

	useEffect(() => {
		let animationFrame = 0;

		function updateFromScroll() {
			const stage = stageRef.current;
			if (!stage) {
				return;
			}

			const rect = stage.getBoundingClientRect();
			const scrollableDistance = Math.max(stage.offsetHeight - window.innerHeight, 1);
			const nextProgress = Math.min(Math.max(-rect.top / scrollableDistance, 0), 1);
			const nextIndex =
				items.length <= 1 ? 0 : Math.min(items.length - 1, Math.floor(nextProgress * items.length));

			setActiveIndex((currentIndex) => {
				if (currentIndex !== nextIndex) {
					setPreviousIndex(currentIndex);
					setHasVisualTransition(true);
					setScrollDirection(nextIndex > currentIndex ? 'down' : 'up');
				}

				return nextIndex;
			});
		}

		function scheduleUpdate() {
			window.cancelAnimationFrame(animationFrame);
			animationFrame = window.requestAnimationFrame(updateFromScroll);
		}

		updateFromScroll();
		window.addEventListener('scroll', scheduleUpdate, { passive: true });
		window.addEventListener('resize', scheduleUpdate);

		return () => {
			window.cancelAnimationFrame(animationFrame);
			window.removeEventListener('scroll', scheduleUpdate);
			window.removeEventListener('resize', scheduleUpdate);
		};
	}, [items.length]);

	if (!activeItem) {
		return null;
	}

	return (
		<section className="scroll-showcase" aria-label={title ?? 'Showcase'}>
			<div className="container">
				{(kicker || title || description) && (
					<div className="showcase-heading">
						{kicker && <p className="eyebrow">{kicker}</p>}
						{title && <h2>{title}</h2>}
						{description && <p className="lead">{description}</p>}
					</div>
				)}

				<div
					className="showcase-stage"
					data-direction={scrollDirection}
					ref={stageRef}
					style={
						{
							'--showcase-count': items.length,
							'--showcase-active-index': activeIndex,
							'--showcase-active-offset': `${-activeIndex * (100 / items.length)}%`,
						} as CSSProperties
					}
				>
					<div className="showcase-grid">
						<div className="showcase-visual-wrap" aria-hidden="true">
							<div className="showcase-visual-stack">
								{previousIndex !== activeIndex && (
									<a
										className={`showcase-visual showcase-visual--base showcase-visual--${previousItem.visualTone}`}
										href={previousItem.href}
										tabIndex={-1}
										key={`previous-${previousItem.href}`}
									>
										<span className="showcase-visual__marker">
											{String(previousIndex + 1).padStart(2, '0')}
										</span>
										<span className="showcase-visual__label">
											{previousItem.visualLabel ?? previousItem.title}
										</span>
									</a>
								)}
								<a
									className={`showcase-visual showcase-visual--active ${hasVisualTransition ? 'showcase-visual--reveal' : ''} showcase-visual--${activeItem.visualTone}`}
									href={activeItem.href}
									tabIndex={-1}
									key={`active-${activeItem.href}`}
								>
									<span className="showcase-visual__marker">
										{String(activeIndex + 1).padStart(2, '0')}
									</span>
									<span className="showcase-visual__label">
										{activeItem.visualLabel ?? activeItem.title}
									</span>
								</a>
							</div>
						</div>

						<div className="showcase-track">
							<div className="showcase-track__inner">
								{previousIndex !== activeIndex && (
									<article
										className="showcase-item showcase-item--previous"
										key={`previous-text-${previousItem.href}`}
										aria-hidden="true"
									>
										<div className="showcase-item__meta">
											<p className="eyebrow">{previousItem.eyebrow}</p>
											<span>{String(previousIndex + 1).padStart(2, '0')}</span>
										</div>
										<h3>{previousItem.title}</h3>
										<p>{previousItem.summary}</p>
									</article>
								)}

								<article
									className={`showcase-item showcase-item--active ${hasVisualTransition ? 'showcase-item--entering' : ''}`}
									data-active="true"
									data-showcase-index={activeIndex}
									key={`active-text-${activeItem.href}`}
								>
									<a
										className={`showcase-mobile-visual showcase-visual--${activeItem.visualTone}`}
										href={activeItem.href}
										aria-label={`Open ${activeItem.title}`}
									>
										<span className="showcase-visual__marker">
											{String(activeIndex + 1).padStart(2, '0')}
										</span>
										<span className="showcase-visual__label">
											{activeItem.visualLabel ?? activeItem.title}
										</span>
									</a>

									<div className="showcase-item__meta">
										<p className="eyebrow">{activeItem.eyebrow}</p>
										<span>{String(activeIndex + 1).padStart(2, '0')}</span>
									</div>
									<h3>
										<a href={activeItem.href}>{activeItem.title}</a>
									</h3>
									<p>{activeItem.summary}</p>
									<ul className="tag-list" aria-label={`${activeItem.title} topics`}>
										{activeItem.tags.map((tag) => (
											<li className="tag-list__item" key={tag}>
												{tag}
											</li>
										))}
									</ul>
									<a className="text-link" href={activeItem.href}>
										Open {activeItem.title}
									</a>
								</article>

								{previewItem && previewIndex !== null && (
									<article
										className="showcase-item showcase-item--preview"
										key={`preview-text-${previewItem.href}`}
										aria-hidden="true"
								>
										<div className="showcase-item__meta">
											<p className="eyebrow">{previewItem.eyebrow}</p>
											<span>{String(previewIndex + 1).padStart(2, '0')}</span>
										</div>
										<h3>{previewItem.title}</h3>
										<p>{previewItem.summary}</p>
									</article>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
