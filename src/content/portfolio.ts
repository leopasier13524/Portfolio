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
  pageUrl?: string;
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
    heroImage: "/projects/mealli-2-0.png",
    pageUrl: "https://mateomiloloza.framer.website/work/mealli-2-0",
    externalUrl: "https://mealli-dev-preview.figma.site/",
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
    heroImage: "/projects/mealli.png",
    pageUrl: "https://mateomiloloza.framer.website/work/mealli",
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
    heroImage: "/projects/hbmp.png",
    pageUrl: "https://mateomiloloza.framer.website/work/hbmp",
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
    heroImage: "/projects/travelli.png",
    pageUrl: "https://mateomiloloza.framer.website/work/travelli",
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
    heroImage: "/projects/stremio.png",
    pageUrl: "https://mateomiloloza.framer.website/work/stremio",
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
  email: "hello@mateomiloloza.com",
  location: "Split, Croatia",
};
