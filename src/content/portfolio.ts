export type ProjectImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type PortfolioProject = {
  slug: string;
  title: string;
  year: string;
  cardLabel: string;
  category: string;
  tools: string[];
  summary: string;
  details: string[];
  accent: string;
  heroImage: string;
  heroSize: { width: number; height: number };
  /** Transparent brand illustration shown beside the intro copy */
  mark?: ProjectImage;
  /** Design boards shown on the project page */
  gallery: ProjectImage[];
  externalUrl?: string;
  ctaLabel?: string;
};

export type ExperienceItem = {
  company: string;
  role: string;
  period: string;
};

export const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/mateo-milolo%C5%BEa-uiuxdesigner-cro",
  },
  {
    label: "Upwork",
    href: "https://www.upwork.com/freelancers/~01a1e409833bf1f628",
  },
  {
    label: "Dribbble",
    href: "https://dribbble.com/Oetam13524",
  },
] as const;

export const softwareExperience = [
  "Figma",
  "Photoshop",
  "After Effects",
  "CorelDraw",
  "Blender",
  "Postman",
  "Jira",
  "InDesign",
  "Premiere Pro",
  "Microsoft Office",
  "VSC",
  "Illustrator",
  "Adobe XD",
  "Filmora",
  "Unreal Engine",
  "WordPress",
];

export const languagesAndFrameworks = [
  "HTML",
  "JavaScript",
  "Django",
  "CSS3",
  "PHP",
  "MySQL",
  "Bootstrap",
  "Python",
];

export const experience: ExperienceItem[] = [
  {
    company: "Tahoma d.o.o",
    role: "UI/UX Designer",
    period: "December 2024 - Present",
  },
  {
    company: "Upwork",
    role: "UI/UX Designer",
    period: "September 2022 - November 2024",
  },
  {
    company: "Tiskara Perisa",
    role: "Graphic Designer",
    period: "January 2023 - April 2024",
  },
];

export const about = [
  "I am a graduate of Silvija Strahimira Kranjčevića Technical High School in Livno, where I specialized as a Web Designer. In “SSK” I studied programming, mobile and web design, as well as graphic design, video and audio editing and animations.",
  "After graduating in “SSK”, I later enrolled in the Zero to Master Academy for UI/UX design, where I completed a comprehensive course in web and mobile design.",
  "Design, for me, goes beyond solving problems. It's about improving user experiences, striking the perfect balance between aesthetics and functionality, and even creating products that form emotional connections with users.",
];

export const projects: PortfolioProject[] = [
  {
    slug: "edcube",
    title: "Edcube",
    year: "2026",
    cardLabel: "Payroll integration",
    category: "UI/UX Design, Web App",
    tools: ["Figma", "B2B UX", "Data Flows"],
    summary:
      "Edcube connects an accounting firm's pre-systems, such as Personio, to edlohn, so payroll-relevant data flows in automatically. Designed across KanzleiCockpit and MandantenCockpit for eurodata.",
    details: [
      "KanzleiCockpit gives the firm one workspace for what needs attention, product contracts, employee access and the connected product ecosystem.",
      "Firms invite clients to MandantenCockpit, where clients authorize their Personio connection with credential guidance built into the flow.",
      "Data can be sent on a monthly schedule or manually, with a full transfer history and a guided flow for matching employees between systems.",
    ],
    heroImage: "/projects/edcube.webp",
    heroSize: { width: 1600, height: 1034 },
    gallery: [
      {
        src: "/projects/Edcube/KanzleiCockpit overview and ecosystem.png",
        width: 2400,
        height: 1800,
        alt: "KanzleiCockpit overview with open tasks and the connected product ecosystem",
      },
      {
        src: "/projects/Edcube/Contracts and employee access.png",
        width: 2400,
        height: 2160,
        alt: "KanzleiCockpit product contracts and employee access management",
      },
      {
        src: "/projects/Edcube/Invitation and Personio authorization.png",
        width: 2400,
        height: 2160,
        alt: "MandantenCockpit invitation and Personio authorization flow",
      },
      {
        src: "/projects/Edcube/Integration transmission and history.png",
        width: 2400,
        height: 2160,
        alt: "Edcube pre-system overview, transmission schedule and history",
      },
      {
        src: "/projects/Edcube/Employee matching and task resolution.png",
        width: 2400,
        height: 2320,
        alt: "Employee matching review and task resolution in KanzleiCockpit",
      },
    ],
    accent: "#2fb3c4",
  },
  {
    slug: "tms",
    title: "TMS",
    year: "2025",
    cardLabel: "SaaS platform",
    category: "UI/UX Design, Web App",
    tools: ["Figma", "SaaS UX", "Workflow Design"],
    summary:
      "TMS is a SaaS product with two modules for everyday work that cannot wait: Backup Buddy for handing payroll clients to a colleague during absences, and HACCP for food-safety forms and documentation.",
    details: [
      "Backup Buddy pairs a searchable client overview with a five-step handover: coverage type, dates, clients, colleague and a final review.",
      "HACCP lets teams build reusable forms and add conditional rules that create corrective subtasks when a value crosses a threshold.",
      "Documentation views surface completion states such as incomplete or requirements not met, so issues are visible at a glance.",
    ],
    heroImage: "/projects/tms.webp",
    heroSize: { width: 1600, height: 1034 },
    gallery: [
      {
        src: "/projects/tms/TMS product overview.png",
        width: 2400,
        height: 1800,
        alt: "TMS product overview with Backup Buddy and HACCP modules",
      },
      {
        src: "/projects/tms/Backup Buddy overview.png",
        width: 2400,
        height: 1800,
        alt: "Backup Buddy client overview and coverage arrangement",
      },
      {
        src: "/projects/tms/Backup Buddy assignment workflow.png",
        width: 2400,
        height: 2160,
        alt: "Backup Buddy five-step client handover workflow",
      },
      {
        src: "/projects/tms/HACCP form building and rules.png",
        width: 2400,
        height: 1800,
        alt: "HACCP form builder with conditional rules and subtasks",
      },
      {
        src: "/projects/tms/HACCP forms and documentation.png",
        width: 2400,
        height: 1800,
        alt: "HACCP forms list and daily documentation records",
      },
    ],
    accent: "#e2467f",
  },
  {
    slug: "mealli-2-0",
    title: "MealLi 2.0",
    year: "2025",
    cardLabel: "Food ordering app",
    category: "UI/UX Design, Mobile",
    tools: ["Figma", "Prototype", "UX Audit"],
    summary:
      "Complete redesign of the MealLi app with added features, UX and UI improvements, and a fresh visual direction across light and dark themes.",
    details: [
      "Built as a full visual and flow refresh to make the product feel more modern, clearer, and more scalable.",
      "Focused on interaction clarity and stronger hierarchy so core tasks are easier to complete.",
      "Live app preview is optimized for mobile viewing, matching the intended product experience.",
    ],
    heroImage: "/projects/mealli-2-0.webp",
    heroSize: { width: 1600, height: 1033 },
    gallery: [
      {
        src: "/projects/mealli-2-0/board-1.webp",
        width: 1800,
        height: 1163,
        alt: "MealLi 2.0 onboarding, sign in and home screens in dark theme",
      },
    ],
    externalUrl: "https://mealli.app",
    ctaLabel: "Open live preview",
    accent: "#df5f38",
  },
  {
    slug: "mealli",
    title: "MealLi",
    year: "2024",
    cardLabel: "Food ordering app",
    category: "UI/UX Design, Mobile",
    tools: ["Mobile UX", "Wireframes", "Design System"],
    summary:
      "MealLi is a food ordering app designed for a seamless online ordering experience with simple navigation, discovery, and order customization.",
    details: [
      "Users can browse cuisines, search dishes/restaurants, and place orders in only a few steps.",
      "The interface emphasizes clean navigation, clear pricing, and preference-based customization.",
      "Notification states are integrated for pickup readiness and delivery progress updates.",
    ],
    heroImage: "/projects/mealli.webp",
    heroSize: { width: 1600, height: 1034 },
    mark: {
      src: "/projects/mealli/mark.webp",
      width: 1000,
      height: 901,
      alt: "MealLi shopping cart brand illustration",
    },
    gallery: [
      {
        src: "/projects/mealli/board-1.webp",
        width: 1800,
        height: 1163,
        alt: "MealLi log in, home and dish detail screens",
      },
      {
        src: "/projects/mealli/board-2.webp",
        width: 1800,
        height: 1163,
        alt: "MealLi cart, payment and transaction history screens",
      },
    ],
    externalUrl:
      "https://www.figma.com/design/E9sFTEAovjTRmWiDNtGVv7/Mealli?node-id=0-1&t=QDwfXXtIuRg01azq-1",
    ctaLabel: "Open Figma project",
    accent: "#8a79ff",
  },
  {
    slug: "hbmp",
    title: "HBMP",
    year: "2024",
    cardLabel: "Ecommerce app",
    category: "UI/UX Design, Web & Mobile",
    tools: ["Responsive UX", "Figma", "Research"],
    summary:
      "Happy Baby Mobile Phones is an ecommerce app and web concept built for fast product browsing and easy online shopping.",
    details: [
      "Designed to make electronic products easy to discover, compare, and purchase in a few steps.",
      "Includes promotional and event-oriented states such as weekly offers and seasonal campaigns.",
      "Interaction and structure were aligned to stay clear across both mobile and web form factors.",
    ],
    heroImage: "/projects/hbmp.webp",
    heroSize: { width: 1600, height: 1034 },
    mark: {
      src: "/projects/hbmp/mark.webp",
      width: 1000,
      height: 760,
      alt: "HBMP delivery boxes and laptop brand illustration",
    },
    gallery: [
      {
        src: "/projects/hbmp/board-1.webp",
        width: 1800,
        height: 1163,
        alt: "HBMP web checkout and account screens",
      },
      {
        src: "/projects/hbmp/board-2.webp",
        width: 1800,
        height: 1163,
        alt: "HBMP mobile log in, home and product listing screens",
      },
    ],
    externalUrl:
      "https://www.figma.com/design/yIdJ5u7S4hlguohd4UzTNU/EcommerceShop---M?node-id=0-1&t=AvFSHk1zTDmP8R99-1",
    ctaLabel: "Open Figma project",
    accent: "#39d0c1",
  },
  {
    slug: "travelli",
    title: "Travelli",
    year: "2023",
    cardLabel: "Travel booking app",
    category: "UI/UX Design, Mobile",
    tools: ["Journey Mapping", "App UX", "Branding"],
    summary:
      "Travelli is a travel booking app concept for finding destinations, discovering hotels, and planning trips through an intuitive guided flow.",
    details: [
      "The product includes a continent-based destination filter for quickly narrowing results.",
      "Hotel cards and detail views surface ratings, facilities, and booking-relevant information clearly.",
      "Trip history and departure-date tracking help users stay organized after booking.",
    ],
    heroImage: "/projects/travelli.webp",
    heroSize: { width: 1600, height: 1073 },
    mark: {
      src: "/projects/travelli/mark.webp",
      width: 1000,
      height: 979,
      alt: "Travelli low-poly globe with airplane brand illustration",
    },
    gallery: [
      {
        src: "/projects/travelli/board-1.webp",
        width: 1800,
        height: 1208,
        alt: "Travelli destination, hotel detail and settings screens",
      },
    ],
    externalUrl:
      "https://www.figma.com/design/yLC0ie6l6KTu7KMz9tZ2dz/Travelli?node-id=0-1&t=4KfhkF28J2nQnuI5-1",
    ctaLabel: "Open Figma project",
    accent: "#5f7cff",
  },
  {
    slug: "stremio",
    title: "Stremio",
    year: "2022",
    cardLabel: "Streaming app",
    category: "UI/UX Design, Desktop App",
    tools: ["Desktop UX", "Interaction Design", "Layout"],
    summary:
      "Stremio is a streaming app concept focused on easy discovery of movies and TV series with a clean and approachable interface.",
    details: [
      "Users can browse by category, save favorites, and jump back in with Continue Watching.",
      "The concept is structured to reduce friction between browsing, choosing, and resuming content.",
      "It explores integration-ready patterns compatible with services like Netflix, Prime, Hulu, and HBO.",
    ],
    heroImage: "/projects/stremio.webp",
    heroSize: { width: 1600, height: 1073 },
    mark: {
      src: "/projects/stremio/mark.webp",
      width: 1000,
      height: 871,
      alt: "Stremio cat and mouse mascot illustration",
    },
    gallery: [
      {
        src: "/projects/stremio/board-1.webp",
        width: 1800,
        height: 1208,
        alt: "Stremio desktop browse, library and detail screens",
      },
    ],
    externalUrl:
      "https://www.figma.com/design/zGLuiAdConsTJ6ymcLpPQn/Stremio?node-id=0-1&t=sH5NRzC2HxEMPxyV-1",
    ctaLabel: "Open Figma project",
    accent: "#ffad4a",
  },
];

export const portfolioOwner = {
  firstName: "Mateo",
  lastName: "Miloloza",
  headline: "UI/UX Designer",
  kicker: "Portfolio",
  heroStatement:
    "Design that balances aesthetics with function — shaping products people feel connected to.",
  portraitImage: "/mateo-portrait.png",
  email: "milolozamateo@gmail.com",
  location: "Split, Croatia",
};
