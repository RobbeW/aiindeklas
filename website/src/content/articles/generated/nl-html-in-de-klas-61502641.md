---
id: "source-article-6150264159890832"
title: "HTML in de Klas"
slug: "html-in-de-klas"
locale: "nl-BE"
translation_key: null
status: "review"
source_url: "https://www.robbewulgaert.be/onderwijs/html-in-de-klas"
source_html_sha256: "a48c1909e1599925dde743848963edb66fff8c5e101a0081fb3073e19100e662"
migration_status: "transformed"
created_at: "2026-05-16T20:09:32+02:00"
updated_at: "2026-05-16T20:15:20+02:00"
published_at: "2026-05-16T20:09:32+02:00"
author: "robbe-wulgaert"
excerpt: "HTML in de Klas is een kleine oefenomgeving waarin leerlingen leren hoe webpagina’s opgebouwd zijn. Ze schrijven HTML, bekijken het resultaat in een live preview, krijgen gerichte feedback, gebruiken syntaxhulp en exporteren hun werk als HTML-bestand of PDF."
hero: null
seo:
  title: "HTML in de Klas"
  description: null
  canonical_path: "/onderwijs/html-in-de-klas"
  image: "media-4fe6dc9bfbf06cfd"
  noindex: true
tags: []
categories: []
featured: false
previous_source_url: "https://www.robbewulgaert.be/onderwijs/blockly-in-de-klas"
next_source_url: "https://www.robbewulgaert.be/onderwijs/javascript-in-de-klas-versie-20"
gallery: []
downloads: []
citations:
  - label: "Ga naar HTML in de Klas!"
    url: "https://robbew.github.io/htmlindeklas/"
---

![](../../../assets/migrated/d4/d46ab1f213e57b24818bcc7a6e144b3ad26ebeac3113300b8be835290abb285d-w1317.webp)

### Een webpagina lijkt op het eerste gezicht eenvoudig. Je ziet een titel, wat tekst, misschien een afbeelding en een paar links. Voor leerlingen voelt dat vaak minder technisch dan programmeren. Er beweegt niets. Er wordt niets berekend. Er is geen if, geen lus en geen variabele die plots roet in het eten gooit.

### Toch vraagt HTML nauwkeurig denken. Een webpagina is geen losse tekst op een scherm. Het is een gestructureerd document waarin elk onderdeel een plaats en functie heeft. Sommige informatie hoort in head, andere informatie hoort in body. Een title verschijnt niet op dezelfde plaats als een kop. Een afbeelding heeft een bestand nodig, maar ook attributen die betekenis geven.

### Daar wilde ik een kleine oefenomgeving voor bouwen. Leerlingen schrijven HTML, renderen de pagina, vergelijken het resultaat en onderzoeken wat er gebeurt wanneer de structuur niet klopt. Daarom bouwde ik **HTML in de Klas**: een browsertool met een opdracht links, een editor in het midden, een live preview rechts en automatische checks die leerlingen helpen om hun eerste webpagina’s stap voor stap op te bouwen.

### Wat is het?

**HTML in de Klas** helpt leerlingen om hun eerste webpagina’s te maken en vooral te begrijpen hoe die pagina’s opgebouwd zijn. Ik denk daarbij vooral aan leerlingen van ongeveer 12 tot 14 jaar, maar de tool kan ook dienen als korte herhaling of instapopdracht in andere jaren.

De oefeningen vertrekken niet vanuit mooie effecten of afgewerkte websites. Eerst komt de structuur. Leerlingen leren hoe je een webpagina beschrijft met HTML. Ze oefenen met de basisopbouw van een document, met tags, met attributen en met eigen inhoud. Ze ontdekken hoe belangrijk een duidelijke structuur is in jouw document.

In de oefeningen werken leerlingen onder meer aan een geldige basisstructuur met <!DOCTYPE html>, html, head en body. Ze gebruiken een passende title, schrijven koppen en alinea’s, voegen afbeeldingen toe met zinvolle attributen zoals src, alt en width, maken geordende en ongeordende lijsten, sluiten inhoud in via iframe en combineren verschillende bouwstenen in een eigen webpagina.

HTML is daarmee een interessante eerste stap richting webontwikkeling. Leerlingen leren eerst de structuur van een pagina lezen en schrijven. Daarna kan **JavaScript in de Klas** daar gedrag en interactie aan toevoegen.

![](../../../assets/migrated/5f/5fab6cc88a8ac698c0e903fda17d685feb2e8f6fb962bed1c258d6a81705ac29-w1242.webp)

### Hoe werkt de leeromgeving?

Leerlingen kiezen bovenaan een oefening. Elke oefening bevat een korte opdracht en startcode. Daarna schrijven ze HTML in de editor en klikken ze op **Render website**. Hun pagina verschijnt meteen in de live preview.

Leerlingen zien dus niet alleen code, maar ook wat hun code doet. Een nieuwe kop verschijnt op de pagina. Een afbeelding laadt wel of niet. Een lijst krijgt structuur. Een fout geplaatste tag zorgt voor een resultaat dat niet helemaal klopt. Zo kan je meteen debuggen!

De tool controleert ondertussen een aantal veelvoorkomende zaken. Hij kijkt of de basisstructuur aanwezig is: staat de doctype bovenaan en gebruiken leerlingen html, head en body? Hij controleert ook of de gevraagde elementen voorkomen, zoals koppen, alinea’s, lijsten, afbeeldingen of iframes. Daarnaast kijkt hij naar attributen en inhoud: heeft een afbeelding een src en alt, zijn er genoeg li-items en staat er zichtbare tekst in de body?

De feedback lost de oefening niet op. Als een attribuut ontbreekt, zegt de tool welk attribuut nodig is. Als er nog plaatsaanduidingen zoals <...> in de code staan, krijgt de leerling dat te zien. Als de structuur onvolledig is, wijst de feedback naar het probleem. Debuggen blijft een essentiële stap in het computationeel denken.

![Screenshot 2026-05-15 125718.png](../../../assets/migrated/e3/e3151c420ac0839baa224d401deef40061945b0d1f9155b710a6a4930932adef-w1600.webp) ![Screenshot 2026-05-15 125733.png](../../../assets/migrated/ab/ab1200f61568fd01afe47f280107dfb0d774f5d5148f13fa2bd9682e882487d1-w1106.webp) ![Screenshot 2026-05-15 125936.png](../../../assets/migrated/2b/2b9067ffdcfa2207933beb24a1c459b25d95717857017d3ee8aab7213f11e87f-w1600.webp)

### **Feedback en syntaxhulp**

In de tool zit ook een klein formularium met syntaxhulp. Leerlingen kunnen dit openen wanneer ze de structuur begrijpen, maar nog zoeken naar de juiste schrijfwijze.

Daarin vinden ze snel terug hoe de basisstructuur van een HTML-pagina eruitziet, hoe je tags opent en sluit, wat attributen doen, hoe je koppen, alinea’s en lijsten schrijft, hoe je een afbeelding toevoegt, hoe je een iframe gebruikt en welke fouten vaak voorkomen.

![](../../../assets/migrated/df/df639c1d7586370a60ade9c72a716c0b53d0f7a2ff550d151f51b26b9a1cffca-w802.webp)

Dat helpt vooral leerlingen die het concept begrijpen, maar struikelen over de exacte vorm. Ze weten wat ze willen doen, maar nog niet altijd hoe ze het correct noteren. Dan wil je niet dat de volledige oefening stilvalt op één vergeten sluitingsteken of attribuut.

![](../../../assets/migrated/56/561dc1da96f6025c64037b202de75363448934e27e121846d3907d1de0f23dab-w1159.webp)

Bij een evaluatie kan de leerkracht de syntaxhulp uitschakelen. Zo kan dezelfde omgeving eerst dienen om te oefenen en later om gerichter te controleren wat leerlingen zelfstandig beheersen.

![](../../../assets/migrated/7a/7a578011224acfe7f206873fd85a8b0b97d1962b429951f05cdfbd658d725838-w1106.webp)

### **Exporteren!**

Leerlingen kunnen hun webpagina exporteren als HTML-bestand. Dat bestand kunnen ze lokaal openen, verder bewerken of indienen. Daarmee blijft de oefening niet opgesloten in de tool. Het resultaat is ook echt een webbestand.

Daarnaast bevat de tool een PDF-export. Die bundelt de belangrijkste informatie over het werk van de leerling: naam, klas, gekozen oefening, conceptfocus, geschreven code en tekst uit de preview. Ook pogingen, tijd, verificatiegegevens en ruimte voor feedback van de leerkracht krijgen een plaats.

Die PDF is geen volwaardig leerlingvolgsysteem. Ik zie die export vooral als praktisch bewijs van werk bij opdrachten, korte evaluaties of portfolio’s. Wie meerdere oefeningen laat maken, kan de reeks ook bundelen in één PDF. Dat is handig wanneer leerlingen tijdens een les of studie zelfstandig door verschillende opdrachten werken en achteraf één bestand moeten indienen.

![](../../../assets/migrated/f9/f9ef386244390c7f2084eb36f083a2205d06e35b7020622d6cd69bf333641b45-w1600.webp)

## **Hoe ziet de leerlijn er uit?**

![](../../../assets/migrated/32/32e61c6af153ec30bf93c15553d52edd88931d2604926b5232d68a16ad247e19-w1204.webp)

Eerst verdiepen leerlingen via de **platformen** in de wereld van het computationeel denken. Ze leren de decompositie toepassen, leren programmeerconcepten herkennen, ontwerpen algoritmes en slaan aan het debuggen. Hiervoor hanteren we volgende **platformen**:

-   **Blockly in de Klas** helpt leerlingen eerst visueel redeneren. Ze oefenen daar met sequentie, selectie, begrensde herhaling en voorwaardelijke herhaling zonder dat syntax meteen met alle aandacht gaat lopen. Dit onderdeel zit in het begin van de leerlijn.

-   **JavaScript in de Klas** zit op een interessante plek in de reeks. Het komt na visueel redeneren met blokken, maar blijft dichter bij de browser dan Python. Daardoor kan het tegelijk programmeerconcepten oefenen en webgedrag zichtbaar maken.

-   **HTML in de Klas** zit in de webtak. Daar leren leerlingen hoe webpagina’s opgebouwd zijn met structuur, tags, attributen en inhoud. HTML beslist niets en herhaalt niets. **JavaScript** verbindt die werelden. De taal voegt gedrag toe aan webpagina’s en laat leerlingen dezelfde denkpatronen uit Blockly verder oefenen: variabelen, voorwaarden, lussen, functies, invoer, uitvoer en debugging.

-   **Project Delphi** neemt daarna Python op als tekstuele programmeertaal met een grotere oefencatalogus en testcases.

-   **Dodona blijft de allersterkste keuze voor volledige trajecten, dashboards, deadlines, evaluaties, klasopvolging, toetsen en zelfs examens!**

Daarna komen de **STEaM-projecten**. Die projecten gebruiken de opgebouwde concepten in grotere opdrachten waarin leerlingen bouwen, meten, testen en besluiten. De platformen trainen de bouwstenen van het computationeel denken. De projecten zetten tonen hoe we met die bouwstenen en digitale systemen een impact kunnen hebben op onze eigen leefwereld en samenleving.

-   Bij **Project Robothand** brengen leerlingen Arduino, sensoren, servo’s, seriële data en mechaniek samen in één werkend systeem. Dit past later in de leerlijn, na een eerste traject rond Arduino en fysieke computing. Leerlingen sturen niet alleen code naar een bordje, maar zien hoe sensorwaarden beweging veroorzaken.

-   Bij **Project Wind** verschuift de focus naar meten en onderzoeken. Leerlingen bouwen een windmolenopstelling, gebruiken de micro:bit om spanning en stroom te meten, berekenen vermogen en energie, vergelijken proeven en schrijven een besluit op basis van data. Hier wordt code een onderzoeksinstrument.

-   Bij **Slimme Vuilnisbak** komt daar artificiële intelligentie bij. Leerlingen verzamelen voorbeelden, kennen labels toe, trainen een model, testen voorspellingen, bekijken confidence-scores en koppelen de voorspelling aan een microcontroller. Zo wordt AI geen magische doos, maar een systeem dat werkt met data, labels, fouten en bijsturing.

-   **Fijnstof** hoort in dezelfde projectlaag. Tijdens dit STEaM-project gaan we aan de slag met Arduino, luchtkwaliteit, data en een postersessie. Leerlingen meten een verschijnsel uit de echte wereld, verwerken data en communiceren hun bevindingen.

Zo ontstaat er een overzichtelijk en duidelijk **curriculum**: eerst leren leerlingen redeneren, structureren en programmeren in kleine oefenomgevingen. Daarna gebruiken ze die kennis in projecten waarin code gekoppeld wordt aan fysieke systemen, meetgegevens, onderzoeksvragen en ontwerpkeuzes.

### **Ik wil dit in mijn klas! Wat moet ik doen?**

Wil je hier zelf mee aan de slag in jouw klaslokaal? Super! Samen met jongeren werken rond computationeel denken en programmeren is fantastisch, maar ik ben wellicht een bevooroordeelde bron. Met de knoppen hieronder kan je de tool zelf uittesten. Vind je een bug in mijn code? Laat het gerust weten via het contactformulier of via de Discord-server! 

<div class="content-button-row content-button-row--center"><a class="content-button content-button--primary content-button--medium" href="https://robbew.github.io/htmlindeklas/" target="_blank" rel="noreferrer">Ga naar HTML in de Klas!</a></div>

<div class="content-button-row content-button-row--center"><a class="content-button content-button--primary content-button--medium" href="/contact">Contacteer Robbe!</a></div>
