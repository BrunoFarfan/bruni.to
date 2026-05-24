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
    title: "Skip",
    href: "/work/skip",
    eyebrow: "Selected work",
    summary:
      "Joined as a software engineer focused primarily on backend development, including scrapers, AI agent workflows, and document management systems. Subsequently assumed the role of de facto CTO, overseeing all aspects from infrastructure to product management.",
    tags: ["AI automation", "LangGraph", "Operations"],
    status: "Professional system",
    focus: "Automation across insurance workflows and internal tools",
    visualTone: "blue",
    visualLabel: "Skip",
  },
  {
    title: "Unholster",
    href: "/work/unholster-ds",
    eyebrow: "Selected work",
    summary:
      "A placeholder case study for extracting structure from large document collections with NLP, embeddings, and custom scraping.",
    tags: ["NLP", "Embeddings", "Scraping"],
    status: "Professional system",
    focus: "Large-scale document processing and entity extraction",
    visualTone: "violet",
    visualLabel: "Unholster",
  },
];

export const labProjects: Project[] = [
  {
    title: "MIKE",
    href: "/lab/mike",
    eyebrow: "Lab",
    summary:
      "A university robotics project for autonomously and intelligently launching table-tennis balls using Python, vision, aiming, and device communication.",
    tags: ["Python", "Computer vision", "Robotics"],
    status: "Prototype",
    focus: "Computer vision and physical interaction",
    visualTone: "amber",
    visualLabel: "MIKE",
  },
  {
    title: "OGAI",
    href: "/lab/ogai",
    eyebrow: "Lab",
    summary:
      "An experimental football prediction project using scraped Premier League data and lightweight neural network models.",
    tags: ["Data scraping", "Prediction", "Sports data", "Neural networks"],
    status: "Experiment",
    focus: "Data collection and prediction workflows",
    visualTone: "green",
    visualLabel: "OGAI",
  },
];

export const homeShowcaseItems: Project[] = [
  {
    title: "Selected Work",
    href: "/work",
    eyebrow: "Professional experience",
    summary:
      "A curated overview of my professional experience as a Software Engineer and Data Scientist.",
    tags: ["Agentic AI", "Scraping", "System design"],
    status: "Portfolio category",
    focus: "Production-oriented work and applied AI systems",
    visualTone: "blue",
    visualLabel: "Selected Work",
  },
  {
    title: "Lab",
    href: "/lab",
    eyebrow: "Experimental work",
    summary:
      "Exploratory prototypes and in-progress ideas across AI, robotics, and simulation games.",
    tags: ["Experiments", "Prototypes"],
    status: "Portfolio category",
    focus: "Early-stage ideas and experimental tools",
    visualTone: "green",
    visualLabel: "Lab",
  },
];
