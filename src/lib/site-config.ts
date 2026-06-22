/**
 * Albert Ray's Repairs & Restoration — Site Configuration
 * -------------------------------------------------------------
 * EDIT THIS FILE to update business info shown across the site.
 * Business details sourced from Albert's Yelp listing.
 */

export const site = {
  name: "Albert Ray's Repairs & Restoration",
  shortName: "Albert Ray's",
  tagline: "Done right the first time.",
  // One or two sentences for the hero / meta description.
  description:
    "Plumbing, carpentry, drywall, and full-home repairs and restoration for Apple Valley and the High Desert. Honest pricing, expert work, and a craftsman who shows up — available 24/7.",

  // --- Contact ---
  phoneDisplay: "(909) 471-0834",
  phoneHref: "tel:+19094710834",
  email: "hello@albertrayhandyman.com",

  // Where Albert works. Used in hero, footer, and SEO copy.
  serviceArea: {
    primaryCity: "Apple Valley",
    region: "Apple Valley and the High Desert",
    nearby: ["Apple Valley", "Victorville", "Hesperia", "Adelanto", "Oak Hills"],
  },

  // Business hours shown in the footer / contact card.
  hours: [
    { day: "Mon – Fri", time: "Open 24 Hours" },
    { day: "Saturday", time: "Open 24 Hours" },
    { day: "Sunday", time: "Open 24 Hours" },
  ],

  // Trust signals shown in the hero ribbon.
  badges: ["5.0★ on Yelp", "Available 24/7", "Free Estimates", "Locally Owned"],

  social: {
    facebook: "",
    instagram: "",
    google: "",
  },
} as const;

export type ServiceIcon =
  | "wrench"
  | "drywall"
  | "paint"
  | "carpentry"
  | "door"
  | "mount"
  | "faucet"
  | "electric"
  | "tile"
  | "list";

export const services: {
  icon: ServiceIcon;
  title: string;
  blurb: string;
}[] = [
  {
    icon: "wrench",
    title: "General Repairs",
    blurb: "The squeaks, leaks, and won't-quite-close things on your list — fixed in one visit.",
  },
  {
    icon: "drywall",
    title: "Drywall & Patching",
    blurb: "Holes, cracks, and water damage patched, sanded, and painted to disappear.",
  },
  {
    icon: "paint",
    title: "Interior & Exterior Painting",
    blurb: "Clean lines, full coverage, and tidy cleanup — rooms, trim, doors, and fences.",
  },
  {
    icon: "carpentry",
    title: "Carpentry & Remodels",
    blurb: "A specialty — custom builds, cabinets, trim, and repairs done square, tight, and built to last.",
  },
  {
    icon: "door",
    title: "Doors & Windows",
    blurb: "Sticking doors, broken locks, drafty windows, and screens made right again.",
  },
  {
    icon: "mount",
    title: "Mounting & Installs",
    blurb: "TVs, shelves, blinds, fixtures, and furniture mounted level and secure.",
  },
  {
    icon: "faucet",
    title: "Plumbing Repairs",
    blurb: "A specialty — leaks tracked down, faucets, toilets, disposals, and shut-off valves swapped and sealed.",
  },
  {
    icon: "electric",
    title: "Minor Electrical",
    blurb: "Outlets, switches, light fixtures, and ceiling fans replaced safely.",
  },
  {
    icon: "tile",
    title: "Tile & Flooring",
    blurb: "Cracked tile, loose boards, fresh caulk, and grout repairs that last.",
  },
];

export const processSteps: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "Tell us the job",
    body: "Send a few details through the form or book a visit. Describe the project — big list or single fix.",
  },
  {
    step: "02",
    title: "Pick a time",
    body: "Choose a day and time slot that works for you. You'll get a confirmation and a reminder.",
  },
  {
    step: "03",
    title: "We show up & fix it",
    body: "Albert arrives on time, gives an honest estimate, and gets to work. Clean job, fair price.",
  },
];

export const testimonials: { quote: string; name: string; detail: string }[] = [
  {
    quote:
      "Can't thank Albert and his crew enough for doing my remodel. They completely gutted my house and built my dream home. His work is amazing, his communication is great, and he finished ahead of schedule. His prices were really reasonable, even when I had change orders come up. Finding a good contractor is such a struggle — I went through a few companies before I found him. Highly recommend!",
    name: "Travis L.",
    detail: "Homeowner · Covina, CA",
  },
  {
    quote:
      "Albert is an absolute master of his craft. After seeing the attention to detail he put into a few things at my shop, I had him do work on my ranch home too — and the price he charged for that quality was phenomenal. I'll be reaching out again for more projects. Thank you for all the help, Albert!",
    name: "Cali H.",
    detail: "Business & ranch owner · Apple Valley, CA",
  },
  {
    quote:
      "Albert came out to help with my washing machine. He was fast, efficient, and did everything he could to find the leak — turned out it wasn't the machine, it was the house. I'd recommend him and I'll be using him again. The price is very reasonable!",
    name: "Jennifer M.",
    detail: "Homeowner · West Covina, CA",
  },
  {
    quote:
      "Highly recommend! He installed our front door and did an excellent job. The quality of the work was great, everything was done professionally and with attention to detail, and the price was reasonable. Very satisfied with the results and would definitely hire again for future projects.",
    name: "Hugo H.",
    detail: "Homeowner · Fontana, CA",
  },
  {
    quote:
      "I had Albert out to make extra shelves in my garage. I've had trouble with handymen in the past, but Albert didn't have any of those issues. He was honest and reliable, and didn't try to get money upfront to rip me off like others have. His work was high-quality and the shelves came out fantastic.",
    name: "Eve C.",
    detail: "Homeowner · Los Angeles, CA",
  },
  {
    quote:
      "Check out this guy's work — best in the High Desert. On top of his skill on the job, he's very reasonably priced. If you're looking to get something done, call Albert. You will be so grateful you did.",
    name: "Michael G.",
    detail: "Homeowner · Hesperia, CA",
  },
];

export const stats: { value: string; label: string }[] = [
  { value: "5.0★", label: "Rating on Yelp" },
  { value: "100%", label: "Response rate" },
  { value: "24/7", label: "Always available" },
  { value: "40 min", label: "Avg. response time" },
];
