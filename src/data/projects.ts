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
      "Joined as a software engineer focused primarily on backend development, including scrapers, AI agent workflows, and document management systems. Subsequently assumed the role of de facto CTO, overseeing all aspects from infrastructure to product management.",
    detailHeading: "Overview",
    details: [
      "This page is a scaffold for a future case study about AI-assisted reimbursement automation. The current copy should be treated as placeholder content that frames the type of work, not as a final public write-up.",
      "The story can focus on turning conversations and uploaded files into structured reimbursement data, coordinating insurer portal interactions, and giving internal teams tools to monitor and recover operational flows.",
      "The future version should describe the system boundaries, the role of LangGraph-style conversation flows, review surfaces, queue monitoring, failure handling, and gradual rollout practices.",
    ],
    tags: ["AI automation", "LangGraph", "Operations"],
    status: "Professional system",
  },
  {
    title: "Unholster",
    externalUrl: "https://unholster.com",
    externalLabel: "Open Unholster in a new tab",
    summary:
      "A placeholder case study for extracting structure from large document collections with NLP, embeddings, and custom scraping.",
    detailHeading: "Overview",
    details: [
      "This page is a scaffold for a future case study about document intelligence pipelines. It is intended to hold a polished narrative around extraction quality, scale, data preparation, and downstream usability.",
      "The content direction is informed by work with entity extraction, embeddings, KNN retrieval, custom scrapers, model fine-tuning, and summarization workflows for large environmental document sets.",
      "The future version should explain the pipeline architecture, evaluation approach, data quality controls, and how raw documents become structured outputs useful to analysts or product surfaces.",
    ],
    tags: ["NLP", "Embeddings", "Scraping"],
    status: "Professional system",
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
