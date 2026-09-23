import type { SiteLocale } from "../lib/routing";

export interface PrototypeCard {
  title: string;
  text: string;
}

export interface PrototypePage {
  path: string;
  canonicalPath?: string;
  lang: SiteLocale;
  alternatePath?: string;
  hasDirectTranslation?: boolean;
  eyebrow: string;
  title: string;
  description: string;
  cards: PrototypeCard[];
}

export const prototypePages: PrototypePage[] = [
  {
    path: "/about",
    lang: "en",
    alternatePath: "/",
    hasDirectTranslation: true,
    eyebrow: "Profile",
    title: "About Robbe Wulgaert",
    description: "The English profile shell is ready for the verified biography and source media.",
    cards: [
      { title: "Education", text: "A structured place for teaching practice, professional learning and classroom technology." },
      { title: "Writing", text: "Long-form articles keep their historical URLs, dates, tags and author voice." },
      { title: "Projects", text: "Educational tools remain independent while the main site provides one clear catalogue." }
    ]
  },
  {
    path: "/boek",
    lang: "nl-BE",
    eyebrow: "Publicatie",
    title: "Boek",
    description: "De boekpagina krijgt een rustig, leesbaar kader voor de geverifieerde beschrijving en bestelgegevens.",
    cards: [
      { title: "Heldere samenvatting", text: "De kern van het boek wordt scanbaar zonder de brontekst te verkorten of te herschrijven." },
      { title: "Praktische gegevens", text: "Uitgever, editie en bestelopties worden als controleerbare informatie gemigreerd." },
      { title: "Toegankelijke media", text: "Omslag en illustraties krijgen correcte alternatieve tekst en bronregistratie." }
    ]
  },
  {
    path: "/contact",
    lang: "nl-BE",
    alternatePath: "/contactinfo",
    hasDirectTranslation: true,
    eyebrow: "Contact",
    title: "Neem contact op",
    description: "Deze pagina wordt een eenvoudige, privacyvriendelijke contactplek zonder formulier of tracking.",
    cards: [
      { title: "Zichtbaar e-mailadres", text: "Het definitieve publieke adres wordt na bron- of eigenaarsbevestiging zichtbaar en kopieerbaar geplaatst." },
      { title: "Geen formulierdata", text: "De statische site verzamelt, bewaart of verstuurt zelf geen persoonsgegevens." },
      { title: "Duidelijke verwachtingen", text: "De uiteindelijke pagina legt kort uit voor welke vragen contact geschikt is." }
    ]
  },
  {
    path: "/contactinfo",
    lang: "en",
    alternatePath: "/contact",
    hasDirectTranslation: true,
    eyebrow: "Contact",
    title: "Contact information",
    description: "A simple, privacy-friendly contact page without a hosted form or visitor tracking.",
    cards: [
      { title: "Visible email address", text: "The confirmed public address will be visible, copyable and available as a mail link." },
      { title: "No form processing", text: "The static site does not collect, store or transmit contact-form data." },
      { title: "Clear purpose", text: "The finished page will set useful expectations for professional enquiries." }
    ]
  },
  {
    path: "/onderwijs",
    lang: "nl-BE",
    alternatePath: "/education",
    hasDirectTranslation: true,
    eyebrow: "Onderwijs",
    title: "Leren in een digitale wereld",
    description: "Een overzichtelijke ingang voor artikelen, nascholingen en onderwijsprojecten.",
    cards: [
      { title: "Artikels", text: "Bestaande publicaties behouden hun datum, tags, interne verbanden en historische URL." },
      { title: "Nascholingen", text: "Workshops worden gestructureerd zodat programma, doelen en praktische informatie snel vindbaar zijn." },
      { title: "Projecten", text: "Lesideeën en tools krijgen duidelijke context, leerdoelen en privacy-informatie." }
    ]
  },
  {
    path: "/education",
    lang: "en",
    alternatePath: "/onderwijs",
    hasDirectTranslation: true,
    eyebrow: "Education",
    title: "Learning in a digital world",
    description: "A clear entry point for the existing English articles and educational project catalogue.",
    cards: [
      { title: "Articles", text: "Existing publications retain their dates, tags, relationships and historical URLs." },
      { title: "Professional learning", text: "Structured information makes programmes, goals and practical details easy to scan." },
      { title: "Projects", text: "Classroom tools receive useful context, learning goals and privacy information." }
    ]
  },
  {
    path: "/projects",
    lang: "en",
    eyebrow: "Project catalogue",
    title: "Educational projects",
    description: "Independent learning tools, connected through one consistent and accessible catalogue.",
    cards: [
      { title: "Clear context", text: "Every project explains what learners make, investigate or practise before opening the tool." },
      { title: "Independent tools", text: "Projects stay deployable in their own repositories and are never hidden inside an iframe by default." },
      { title: "Shared language", text: "A consistent visual grammar links the ecosystem without erasing each project's purpose." }
    ]
  },
  {
    path: "/onderwijs/workshops-en-nascholingen",
    lang: "nl-BE",
    eyebrow: "Nascholingen",
    title: "Workshops en nascholingen",
    description: "Het nieuwe catalogusmodel maakt aanbod, programma, doelgroep, prijs en praktische afspraken apart controleerbaar.",
    cards: [
      { title: "Aanbod", text: "Elke zichtbare workshop uit de bron krijgt één gestructureerde en valideerbare record." },
      { title: "Leerdoelen", text: "Kennis, vaardigheden en attitudes blijven afzonderlijk leesbaar waar de bron dat onderscheid maakt." },
      { title: "Praktische informatie", text: "Onbekende duur, prijs of groepsgrootte blijft leeg en wordt nooit geraden." }
    ]
  },
  {
    path: "/verkoopsvoorwaarden",
    lang: "nl-BE",
    eyebrow: "Voorwaarden",
    title: "Verkoopsvoorwaarden",
    description: "De bestaande voorwaarden krijgen een nuchtere, goed leesbare tekstlay-out met behoud van de broninhoud.",
    cards: [
      { title: "Brongetrouw", text: "Juridische tekst wordt niet stilzwijgend samengevat of inhoudelijk aangepast tijdens migratie." },
      { title: "Leesbaar", text: "Koppen, lijsten en witruimte maken lange tekst beter navigeerbaar zonder betekenis te verliezen." },
      { title: "Versiebeheer", text: "Latere wijzigingen blijven zichtbaar in lokale Git-geschiedenis en reviewbare patches." }
    ]
  }
];

export const sitemapPrototypePaths = [
  "/",
  ...prototypePages.map(({ path }) => path)
];
