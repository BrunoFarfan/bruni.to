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
	const [trackOffset, setTrackOffset] = useState('0%');
	const [wiggleOffset, setWiggleOffset] = useState('0px');
	const [hasVisualTransition, setHasVisualTransition] = useState(false);
	const stageRef = useRef<HTMLDivElement | null>(null);
	const activeItem = items[activeIndex] ?? items[0];
	const previousItem = items[previousIndex] ?? activeItem;

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
			const scaledPosition = nextProgress * items.length;
			const nextIndex =
				items.length <= 1 ? 0 : Math.min(items.length - 1, Math.floor(scaledPosition));
			const itemSlot = 100 / items.length;
			const scrollWithinItem = Math.min(Math.max(scaledPosition - nextIndex, 0), 1);
			const nextOffset = -(nextIndex * itemSlot);
			const nextWiggle = -Math.min(scrollWithinItem, 0.72) * 42;

			setTrackOffset(`${nextOffset}%`);
			setWiggleOffset(`${nextWiggle}px`);
			setActiveIndex((currentIndex) => {
				if (currentIndex !== nextIndex) {
					setPreviousIndex(currentIndex);
					setHasVisualTransition(true);
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
					ref={stageRef}
					style={
						{
							'--showcase-count': items.length,
							'--showcase-active-index': activeIndex,
							'--showcase-active-offset': `${-activeIndex * (100 / items.length)}%`,
							'--showcase-track-offset': trackOffset,
							'--showcase-wiggle-offset': wiggleOffset,
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
								{items.map((item, index) => (
									<article
										className="showcase-item"
										data-active={index === activeIndex}
										data-showcase-index={index}
										key={item.href}
								>
										<a
											className={`showcase-mobile-visual showcase-visual--${item.visualTone}`}
											href={item.href}
											aria-label={`Open ${item.title}`}
										>
											<span className="showcase-visual__marker">
												{String(index + 1).padStart(2, '0')}
											</span>
											<span className="showcase-visual__label">
												{item.visualLabel ?? item.title}
											</span>
										</a>

										<div className="showcase-item__meta">
											<p className="eyebrow">{item.eyebrow}</p>
											<span>{String(index + 1).padStart(2, '0')}</span>
										</div>
										<h3>
											<a href={item.href}>{item.title}</a>
										</h3>
										<p>{item.summary}</p>
										<ul className="tag-list" aria-label={`${item.title} topics`}>
											{item.tags.map((tag) => (
												<li className="tag-list__item" key={tag}>
													{tag}
												</li>
											))}
										</ul>
										<a className="text-link" href={item.href}>
											Open {item.title}
										</a>
									</article>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
