# AI in de Klas: K-nabije buren

Auteur: Robbe Wulgaert · aiindeklas.be / robbewulgaert.be  
© 2025 Robbe Wulgaert

**Demo:** [Klik hier!](https://robbew.github.io/knn-oefeningen/)

## Doel

Een lichte webapp om het k-nabije-burenprincipe (KNN) tastbaar te maken voor leerlingen met basiskennis Python.  
Leerlingen rekenen zelf aan met afstanden, zien grafieken en koppelen dit direct aan aanbevelingssystemen (TikTok, Spotify, Netflix, …).

## Deze webapp helpt leerlingen (15–16 jaar) om:

- Afstand in 2D en 3D stap voor stap te berekenen met Python.
- Te begrijpen hoe “dichtste buren” gebruikt worden in aanbevelingssystemen.
- Relaties te zien tussen ruwe gegevens (coördinaten, binaire aankopen, kijkcijfers) en voorspellingen.
- Hun werk (code + antwoorden) netjes te exporteren naar PDF, ook in SEB.

## Belangrijkste functies:

- **Ingebouwde Python-editor (links):**
  - CodeMirror-editor met Python-syntax highlighting.
  - Pyodide runt Python volledig lokaal in de browser.
  - Leerlingen gebruiken `print(...)` om eigen tussenstappen en resultaten te controleren.

- **Drie KNN-oefeningen (rechts, via dots nav):**
  - **Oefening 1 – 2D-afstand (Noah en klanten):**  
    Euclidische afstand tussen punten op een vlak; grafiek met labels en afstanden.
  - **Oefening 2 – Webshop (zonnecrème, boek, ski, zwembroek):**  
    Binaire kenmerken (0/1), k = 3, leerlingen redeneren over aanbevelen/niet aanbevelen.
  - **Oefening 3 – Netflix-series (Stranger Things, Wednesday, One Piece):**  
    3D-afstand, grafiek in 2D met 3D-afstandslijnen en labels.

- **Formularium-kaart:**
  - Euclidische afstand in 2D en 3D.
  - Uitleg over binaire afstand (0/1 per product).
  - Korte tips om formules om te zetten naar Python.

- **Grafieken per oefening:**
  - Knoppen “Toon grafiek” tekenen punten, labels en afstandslijnen.
  - Oefening 3 toont 3D-afstanden in een 2D-plot met duidelijke notatie.

- **Intro-modal over aanbevelingssystemen:**
  - Uitleg wat “dichtste buren” doen in machine learning.
  - Verwijzing naar TikTok, Spotify, Netflix, YouTube en Amazon (“dit kochten anderen ook”).

- **PDF-export:**
  - Lokaal gegenereerde PDF (jsPDF), geen printerdialoog nodig (SEB-proof).
  - Neemt Python-code, Python-uitvoer en antwoorden van oefening 2 en 3 op.
  - Naam en klas optioneel voor automatische bestandsnaam.

## Vereisten:

- Geen installatie nodig; draait volledig in de browser.
- Aanbevolen: recente Chromium-browser (Chrome, Edge).
- Werkt in een SEB-omgeving mits toegang tot:
  - `index.html`
  - meegeleverde JS/CSS-assets
  - externe CDN’s (CodeMirror, Pyodide, jsPDF) of lokaal gehoste kopieën.

## Aan de slag:

- Open `index.html` via:
  - een lokale webserver, of
  - GitHub Pages.
- **Links:** Python-editor.
  - Startboilerplate voor oefening 1 staat klaar.
  - Leerlingen vullen de afstandsberekeningen verder aan.
- **Rechts:** oefeningen.
  - Navigeer via de dots onderaan (1–3).
  - Lees de opgave, gebruik de knoppen:
    - “Controleer …” → feedbackkader.
    - “Toon grafiek” → visualisatie met labels en afstanden.
- **Formularium:**
  - Staat als aparte kaart boven de oefeningen.
  - Verwijs je leerlingen hier expliciet naar bij rekenfouten.

- **PDF-export:**
  - Klik bovenaan op “Exporteren als PDF”.
  - Vul optioneel naam en klas in.
  - PDF bevat:
    - huidige Python-code,
    - console-uitvoer,
    - keuze in oefening 2,
    - antwoord in oefening 3.

## Tips voor gebruik in de klas:

- Koppel expliciet aan wiskunde:
  - afstandsformules, coördinaten, kwadraten en wortels.
- Laat leerlingen eerst de afstand uitrekenen met pen-en-papier, daarna pas in Python.
- Gebruik oefening 2 om te laten zien hoe “gelijkaardige klanten” tot aanbevelingen leiden.
- Gebruik oefening 3 om de stap te maken naar meer kenmerken (3D en hoger).
- Laat leerlingen hun PDF exporteren op vaste momenten (bv. op het einde van de les) en gebruik die als basis voor korte formatieve feedback.

## Licentie & Copyright

© 2025 Robbe Wulgaert, aiindeklas.be / robbewulgaert.be  
Alle rechten voorbehouden.

Niet herdistribueren of gebruiken zonder schriftelijke toestemming van de auteur.
