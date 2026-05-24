export type Project = {
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

export const workProjects: Project[] = [
	{
		title: 'AI reimbursement automation',
		href: '/work/ai-reimbursement-automation',
		eyebrow: 'Selected work',
		summary:
			'A placeholder case study for insurer portal automation, WhatsApp intake, reimbursement structuring, and operational tooling.',
		tags: ['AI automation', 'LangGraph', 'Operations'],
		status: 'Professional system',
		focus: 'Automation across insurance workflows and internal tools',
		visualTone: 'blue',
		visualLabel: 'AI reimbursement',
	},
	{
		title: 'Document intelligence pipelines',
		href: '/work/document-intelligence-pipelines',
		eyebrow: 'Selected work',
		summary:
			'A placeholder case study for extracting structure from large document collections with NLP, embeddings, and custom scraping.',
		tags: ['NLP', 'Embeddings', 'Scraping'],
		status: 'Professional system',
		focus: 'Large-scale document processing and entity extraction',
		visualTone: 'violet',
		visualLabel: 'Document intelligence',
	},
];

export const labProjects: Project[] = [
	{
		title: 'OGAI',
		href: '/lab/ogai',
		eyebrow: 'Lab',
		summary:
			'An experimental football prediction project using scraped Premier League data and lightweight modeling workflows.',
		tags: ['Data scraping', 'Prediction', 'Sports data'],
		status: 'Experiment',
		focus: 'Data collection and prediction workflows',
		visualTone: 'green',
		visualLabel: 'OGAI',
	},
	{
		title: 'MIKE',
		href: '/lab/mike',
		eyebrow: 'Lab',
		summary:
			'A robotics experiment for intelligently launching table-tennis balls using Python, vision, aiming, and device communication.',
		tags: ['Python', 'Computer vision', 'Robotics'],
		status: 'Prototype',
		focus: 'Computer vision and physical interaction',
		visualTone: 'amber',
		visualLabel: 'MIKE',
	},
	{
		title: 'Future experiments',
		href: '/lab/future-experiments',
		eyebrow: 'Lab notes',
		summary:
			'A placeholder space for future AI tooling notes, prototypes, and small technical explorations.',
		tags: ['Notes', 'Tooling', 'Prototypes'],
		status: 'Open-ended',
		focus: 'Early ideas and technical sketches',
		visualTone: 'slate',
		visualLabel: 'Future experiments',
	},
];

export const homeShowcaseItems: Project[] = [
	{
		title: 'Selected Work',
		href: '/work',
		eyebrow: 'Professional systems',
		summary:
			'Polished case-study placeholders for AI automation, reimbursement workflows, document intelligence, and internal software systems.',
		tags: ['AI automation', 'Document intelligence', 'Software systems'],
		status: 'Portfolio category',
		focus: 'Production-oriented work and applied AI systems',
		visualTone: 'blue',
		visualLabel: 'Selected Work',
	},
	{
		title: 'Lab',
		href: '/lab',
		eyebrow: 'Experimental work',
		summary:
			'Exploratory prototypes, notes, and technical sketches across prediction, robotics, AI tooling, and model-driven interfaces.',
		tags: ['Experiments', 'Prototypes', 'Technical notes'],
		status: 'Portfolio category',
		focus: 'Early-stage ideas and experimental tools',
		visualTone: 'green',
		visualLabel: 'Lab',
	},
];
