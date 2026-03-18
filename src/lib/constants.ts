export const LINKS: {
    link: string
    logo: string
    name: string
}[] = [{
    link: "https://github.com/calvindotsg/", logo: "fa6-brands:github", name: "Github"
}, {
    link: "https://www.linkedin.com/in/calvin-loh/", logo: "fa6-brands:linkedin", name: "LinkedIn"
}, {
    link: "https://www.instagram.com/calvindotsg/", logo: "fa6-brands:instagram", name: "Instagram"
}, {
    link: "https://www.strava.com/athletes/37641259/", logo: "fa6-brands:strava", name: "Strava"
}, {
    link: "https://t.me/calvindotsg/", logo: "fa6-brands:telegram", name: "Telegram"
}, {
    link: "/resume.pdf", logo: "ri:file-pdf-2-line", name: "Resume"
},];

export const CAREER: {
    company: string
    company_url: string
    description: string[]
    end_date: string
    job_name: string
    start_date: string
    emoji: string
}[] = [{
    company: "HeyMax",
    company_url: "https://www.heymax.ai",
    description: [
        "Started as a community member, now an engineer turning your pain points into smiles",
        "Built customer support from scratch as we grew to 5 figure weekly active users"
    ],
    end_date: "Present",
    job_name: "Founding Solutions Engineer",
    start_date: "Aug 2023",
    emoji: "🔧"
}, {
    company: "NCS Group",
    company_url: "https://www.ncs.co/en-sg/",
    description: [
        "I'm your solution when you hear users say 'I'm trying to do my job but your app is so buggy'",
        "I'm your Sherlock with data and logs to solve tricky technical problems"
    ],
    end_date: "Aug 2023",
    job_name: "Business Systems Analyst",
    start_date: "Jun 2022",
    emoji: "🔎"
}]

export const ABOUT_ME: {
    description: string[]
} = {
    description: [
        "If you tell me to wake up before sunrise, I'd say you're crazy. But if it's for cycling? Count me in!",
        "Join me in my latest cycling challenge 1000km in 5 weeks, helping vulnerable teens #cyclehome"
    ]
}

export const GOAL: {
    total_goal: number
    current_progress: number
    progress_last_year: number
    website_url: string
    goal_name: string
    goal_logo: string
    cta_logo: string
    measurable_unit: string
} = {
    total_goal: 3000,
    current_progress: 415.1,
    progress_last_year: 1440.8,
    website_url: "https://www.strava.com/athletes/37641259/",
    goal_name: "Cycling",
    goal_logo: "🚴🏻",
    cta_logo: "fa6-brands:strava",
    measurable_unit: "km"
}

export const WELCOME: {
    description: string[]
} = {
    description: ["👋 Hi, I'm Calvin", "Founding Solutions Engineer.", "Road cyclist.", "Enthusiastic learner."]
}

export const NOW: {
    description: string[]
} = {
    description: ["Building things at a startup, probably cycling when you find me"]
}

export const FOOTER: {
    footer: string
} = {
    footer: "Built with ❤️, more love to Astro template by Gianmarco"
}

export const METADATA: {
    title: string
    description: string
    site_url: string
    name: string
    image_url: string
    address_locality: string
    address_country: string
    email_obfuscated: string
} = {
    title: "Calvin - Founding Solutions Engineer | Road Cyclist | Enthusiastic Learner",
    description: "Building things at a startup, probably cycling when you find me. Join my 3000km cycling goal this year.",
    site_url: "https://calvin.sg/",
    name: "Calvin",
    image_url: "https://calvin.sg/preview.jpg",
    address_locality: "Singapore",
    address_country: "SG",
    email_obfuscated: "hello[at]calvin.sg"
}
