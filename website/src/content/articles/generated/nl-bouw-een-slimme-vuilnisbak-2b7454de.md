---
id: "source-article-2b7454de4732fdae"
title: "Bouw een slimme vuilnisbak!"
slug: "bouw-een-slimme-vuilnisbak"
locale: "nl-BE"
translation_key: null
status: "review"
source_url: "https://www.robbewulgaert.be/onderwijs/bouw-een-slimme-vuilnisbak"
source_html_sha256: "2a1ee6c8c6edf11b60aeb467e75aa2d42c74982d6a80dfc50d2c43bc6ae6a6da"
migration_status: "transformed"
created_at: "2022-03-07T07:00:00+01:00"
updated_at: "2025-08-23T11:06:58+02:00"
published_at: "2022-03-07T07:00:00+01:00"
author: "robbe-wulgaert"
excerpt: "Ontdek hoe je een slimme vuilnisbak bouwt met AI-technologie in de klas. Leer leerlingen over machine learning, AI-modellen en milieubewustzijn met praktische, hands-on activiteiten. Perfect voor elke schoollaptop met een webcam!"
hero: null
seo:
  title: "Bouw een slimme vuilnisbak!"
  description: null
  canonical_path: "/onderwijs/bouw-een-slimme-vuilnisbak"
  image: "media-2e56c2781f0b503b"
  noindex: true
tags: []
categories: []
featured: false
previous_source_url: "https://www.robbewulgaert.be/onderwijs/train-je-eigen-zelfrijdende-auto"
next_source_url: "https://www.robbewulgaert.be/onderwijs/open-een-ai-kunstgalerij"
gallery: []
downloads: []
citations:
  - label: "Teachable Machine van Google"
    url: "http://teachablemachine.withgoogle.com/"
---

**Heb je ooit voor de vuilnisbak gestaan en je afgevraagd: "Is dit nu PMD, restafval of iets anders?" Je bent niet de enige. Goed sorteren is belangrijk, en je wilt het graag goed doen. Zo dragen we zorg voor het milieu en voor de mensen die ons afval verwerken. Een kleine moeite voor een betere wereld. Maar wat als je die twijfel kunt wegnemen? Wat als we een artificiële intelligentie kunnen aanleren om te sorteren en samen een slimme vuilnisbak te bouwen? Dat kan! Je hebt er bovendien geen doctoraat of een uit de kluiten gewassen computer voor nodig. Dit kan perfect met een laptop in de klas!**

![](../../../assets/migrated/83/8346aba4c6c8896e7196b2f9262354b638f2315ea43158c36fc59f996dcbdb76-w1600.webp)

### Benodigdheden 

Om een slimme vuilnisbak te bouwen die ons kan helpen bij het sorteren, hebben we enkele zaken nodig. Dit project kan je uitvoeren op bijna elke schoollaptop met een webcam en een Windows-besturingssysteem.

Wat heb je nodig om deze slimme vuilnisbak te bouwen?

-   Een laptop met webcam

-   Python-software

-   Een Arduino Uno, breadboard en ledjes

-   Of een Micro:bit-bordje

-   Arduino IDE-software om het bord te programmeren

-   Een USB-kabel om de Arduino Uno of Micro:bit met de laptop te verbinden

-   Ongeveer 5.000 foto’s van afval om een AI-model te trainen

5.000 foto’s van afval!? Maak je geen zorgen, ik help je hierbij uit de nood! Maar eerst even een woordje over hoe een AI-model werkt en waarom we die foto’s nodig hebben.

![](../../../assets/migrated/b1/b1b77edb4c5b05c3b0f868bb9f44eb8a28ac3d6b4cc3212b5987f71504b2d82f-w1600.webp)

### Hoe kan een AI afval herkennen? 

Wanneer we een slimme vuilnisbak willen bouwen met artificiële intelligentie, moeten we de AI eerst leren afval te herkennen en te sorteren. Dit klinkt misschien ingewikkeld, maar het is vergelijkbaar met hoe we kinderen nieuwe woorden leren. Als we kinderen willen aanleren wat een katje, hondje of koetje is, tonen we prentjes en vertellen we de naam van het diertje. Zo doen we dat ook met afval. We tonen een foto van een plastic flesje en zeggen de naam. Dit herhalen we duizenden keren met onze AI. Dit proces, aangedreven door machine learning-algoritmen, stelt AI in staat om zelfstandig te leren en menselijk gedrag te imiteren. Net als jij, kan een AI bijleren!

![](../../../assets/migrated/78/781d7ddcd25e5d1f04e576443ecad35fc5e7b202905a9394ac197eb56365aeba-w1600.webp)

Binnenin de computer zal ons AI-model, via algoritmen, op zoek gaan naar patronen in de afbeeldingen. Doorgaans geldt dat hoe meer data en tijd we het AI-model geven, hoe beter het wordt in zijn taak. Dit heet ‘**Machine Learning**’. Net zoals bij menselijk leren, zijn er verschillende strategieën om tot leren te komen. De strategie die wij hier gebruiken, waarbij we het AI-model duizenden prentjes tonen en daarbij de naam van de klasse (restafval, plastic, papier …) vermelden, heet ‘**supervised learning**’. Daarbij leert het model dankzij de door mensen voorgesorteerde afbeeldingen. 

![](../../../assets/migrated/50/50992d9271243a946d2f285a4058d31824678056c25402e1ebb21cb9e2b23853-w618.webp)

_“Staan er duizenden foto’s van afval op mijn computer thuis? … Maybe.”_

Dit ‘**machine leren**’ kan je zelf doen via jouw computer. Daarvoor kan je gebruikmaken van de [**Teachable Machine van Google**](http://teachablemachine.withgoogle.com/). Die kan je voorzien van verzamelingen aan foto’s die je een label geeft, en trainen maar! Eenmaal getraind kan ons AI-model een handig trucje: je kan een foto nemen van zijn aangeleerde kennis (= **checkpoint**) en dit downloaden naar de computer. Dat bestand kan je inladen in een andere computer, die het voorgetrainde model onmiddellijk kan gebruiken. Beeld je in dat er een examen wiskunde op de planning staat. De sterkste leerling uit de klas studeert dit vak grondig en uploadt zijn/haar/hun kennis, waarna de rest van de klas dit naar hun hersenen downloadt.

Voila, de “hersenen” van onze slimme vuilnisbak zijn klaar! 

![](../../../assets/migrated/d3/d33070ae19b61ec6335baf3aa3f7d24d337d4cb04c2b016a233e5600fd0fb3f2-w888.webp)

_Voor dit project kan je zelf een AI-model trainen, maar kan je ook gebruikmaken van mijn voorgetraind model via mijn_ **_checkpoint_**_._ 

### HTML – sorteren via de webcam 

Nu we onze artificiële intelligentie hebben getraind, onze slimme vuilnisbak dus van “hersenen” hebben voorzien, is het tijd om te werken aan de “ogen”. Om vuilnis correct te kunnen herkennen, moet onze AI het natuurlijk kunnen zien.  Daarvoor gebruiken we de webcam van onze laptop en de browser. 

Voor dit project kan je gebruikmaken van mijn standaard HTML- en Javascriptbestanden. Als deze computertalen geen geheimen meer voor je kennen, kan je ze zelf ook naar hartenlust aanpassen. 

![](../../../assets/migrated/66/66c716157631ecf653c4698a8ee6b80b8dbef3446545ca659e890c37e6221ec8-w1600.webp)

### Arduino – ons sorteer/verkeerslicht

We hebben onze slimme vuilnisbak voorzien van hersenen en ogen, maar nu moet het ook nog iets ‘doen’ wanneer het een bepaald type afval herkent. Daarvoor maken we gebruik van een microcontroller zoals een Arduino Uno of een Micro:Bit. Dit zijn kleine programmeerbare computerbordjes die we heel eenvoudig kunnen verbinden met een computer. De Micro:Bit is een kant-en-klaar bordje, maar een Arduino breid je uit met een breadboard waar je een viertal ledjes op kan plaatsen. Dit kan je later nog uitbreiden met servo-moteren om een fysieke vuilnisbak te openen/sluiten.

Om onze Arduino te programmeren, hebben we de Arduino IDE-software nodig. Daarmee plaatsen we een stukje code op onze Arduino Uno. Via dit stukje code zal de Arduino luisteren naar inkomende signalen van onze computer. Afhankelijk van het signaal, zal het een specifiek kleur ledje doen branden. De codes voor de microcontrollers zitten standaard in het lesmateriaal. 

![](../../../assets/migrated/cd/cd773304b34bc9f4b028dcc3b122b8b784bdfdb806395539930ee2473f6b3bbf-w1600.webp)

Wanneer onze computer, via de webcam, een stukje vuilnis herkent, zal het een signaal sturen. Om dit signaal te sturen, maken we gebruik van de USB-poort van de computer en een stukje software die de brug vormt tussen de herkenning van ons AI-model en de Arduino. 

![](../../../assets/migrated/64/643e264a4d00f1443ab056b4cfb59b394c8f360ab71ef367a02656aa20d2100d.gif)

Als alle stukjes op hun plaats zitten, kunnen we onze slimme vuilnisbak lanceren. Daarvoor gebruiken we een eenvoudig Python-scriptje. Dit zal de webpagina lanceren, het AI-model zoeken en de nodige elementen inladen. 

Voila, zo bouw je in jouw klaslokaal een vuilnisbak met artificiële intelligentie en draag je bij aan een betere wereld! Wil je dit project helemaal naar jouw hand zetten en samen met de leerlingen een andere detector bouwen? Bijvoorbeeld om bepaalde ingrediënten te herkennen? Ook daarvoor vind je een handig script in het lesmateriaal. 

### Competenties

**Met dit lesmateriaal werken we aan volgende competenties:**

-   een voorbeeld geven van AI in jouw dagelijks leven (en dat van de leerlingen);

-   een voorbeeld geven van machinaal leren;

-   de machine learning-techniek ‘supervised learning’ uitleggen in eigen woorden;

-   een eigen AI-model trainen aan de hand van supervised learning (=toepassen);

-   afbeeldingsclassificatie onderscheiden van afbeeldingsdetectie;

-   deze ML-techniek toepassen in de eigen lespraktijk of vakdomein (=transfer).

### Ik wil dit in mijn klas!
Wat moet ik doen? 

Wil je hier zelf mee aan de slag in jouw klaslokaal? Super! De toekomst zal steeds meer en meer digitaal zijn. Een toekomst waar artificiële intelligentie een heel belangrijke rol in zal spelen. Dat we jongeren hierop moeten voorbereiden en motiveren, spreekt voor zich. Ik wil jou daar gerust bij helpen! Het lesmateriaal en ondersteuning is te vinden via de Discord-community. 

<div class="content-button-row content-button-row--center"><a class="content-button content-button--primary content-button--medium" href="/contact">Contact en link naar Discord</a></div>
