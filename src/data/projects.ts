export type Project = {
  title: string;
  externalUrl: string;
  externalLabel: string;
  summary: string;
  detailHeading: string;
  details: string[];
  tags: string[];
  status: string;
};

export const workProjects: Project[] = [
  {
    title: "Skip",
    externalUrl: "https://getskip.ai",
    externalLabel: "Open Skip in a new tab",
    summary:
      "Software engineering work on medical reimbursement automation, connecting WhatsApp intake, insurer portals, payments, backoffice tooling, and internal operations into one workflow.",
    detailHeading: "Software Engineer",
    details: [
      "Built scrapers that connect Skip to insurer portals, working through login barriers, MFA, and CAPTCHA to gather insurer context and submit reimbursement requests directly in external systems.",
      "Designed LangGraph-based WhatsApp workflows that turn conversations and attachments into structured reimbursement cases, let clients review submissions, and make chat a primary entry point to the product.",
      "Connected onboarding, multifactor authentication, payments, reimbursement automation, messaging, backoffice, and frontend surfaces into a single operating system for customers and internal teams.",
      "Built internal tools for queue monitoring, failure triage, reimbursement recovery, observability, gradual releases, and operational support.",
    ],
    tags: ["AI automation", "LangGraph", "Scraping", "Operations"],
    status: "Software Engineer",
  },
  {
    title: "Unholster",
    externalUrl: "https://unholster.com",
    externalLabel: "Open Unholster in a new tab",
    summary:
      "Data science work on large-scale document intelligence, environmental data extraction, custom scraping, NLP model improvement, summarization pipelines, and computer vision systems.",
    detailHeading: "Data Scientist",
    details: [
      "Implemented an entity extraction system using GLiNER, embeddings, and KNN to structure millions of pages of environmental documents.",
      "Fine-tuned NLP models on EC2, improving precision and recall for problematic entity detection in noisy document collections.",
      "Designed and executed custom scrapers to catalog and structure large volumes of SEIA files, then used LangGraph pipelines to summarize environmental text at scale.",
      "Worked on brand and license plate detection pipelines with vision models for highway fraud detection, and prepared progress and status presentations for clients.",
    ],
    tags: ["NLP", "Embeddings", "Scraping", "Computer vision"],
    status: "Data Scientist",
  },
];

export const labProjects: Project[] = [
  {
    title: "MIKE",
    externalUrl: "https://github.com/brunofarfan/tabletennis",
    externalLabel: "Open MIKE on GitHub in a new tab",
    summary:
      "A university robotics project for autonomously and intelligently launching table-tennis balls using Python, vision, aiming, and device communication.",
    detailHeading: "Prototype",
    details: [
      "MIKE (Maquina Inteligente de Kinetizacion de Esfericos) was a university robotics capstone project for the Robotics Major at Pontificia Universidad Catolica de Chile.",
      "The goal was to create a machine that could autonomously launch table-tennis balls with high accuracy and precision, allowing players to practice and improve their skills independently.",
      "The robot used an Arduino to control the motors, a camera to detect the opponent's racket position, and a wired connection to a computer for processing. The body was constructed from wood and 3D-printed parts.",
      "MIKE could aim and launch balls at different points on the table based on the opponent's racket position. By controlling the relative speed of three motors, it could apply vertical and horizontal spin, making the ball curve and dip.",
    ],
    tags: ["Python", "Computer vision", "Robotics"],
    status: "Prototype",
  },
  {
    title: "OGAI",
    externalUrl: "https://github.com/brunofarfan/ogai",
    externalLabel: "Open OGAI on GitHub in a new tab",
    summary:
      "An experimental football prediction project using scraped Premier League data and lightweight neural network models.",
    detailHeading: "Experiment",
    details: [
      "OGAI (Online Gambler AI) is an unfinished personal experiment exploring whether a transformer model trained on match statistics can meaningfully predict Premier League outcomes.",
      "The pipeline starts with a JavaScript scraper that pulls per-match stats from the web and serializes the raw data to JSON. An early version of the scraper was rewritten into a cleaner implementation, reflecting how the data collection requirements became clearer once the downstream processing was better understood.",
      "The processing layer is written in Python. One script handles match-level data, flattening the scraped JSON into a CSV where each row represents a single match: date, teams, goals, and every recorded stat split into home and away columns. A second script handles season-level aggregation, building a broader view of team performance over time. Together they produce the training data that feeds the model.",
      "The model itself is a transformer, trained in a Jupyter notebook. The choice of architecture reflects an interest in whether attention mechanisms can pick up on patterns in tabular football data the way they do in sequences, treating a match's stats as a set of features the model attends over rather than a flat input to a dense network.",
    ],
    tags: ["Data scraping", "Prediction", "Sports data", "Neural networks"],
    status: "Experiment",
  },
];
