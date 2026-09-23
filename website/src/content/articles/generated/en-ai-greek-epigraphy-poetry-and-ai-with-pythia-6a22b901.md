---
id: "source-article-6a22b90112d4d882"
title: "AI & ANCIENT GREEK - Epigraphy, Poetry and AI with Pythia"
slug: "ai-greek-epigraphy-poetry-and-ai-with-pythia"
locale: "en"
translation_key: null
status: "review"
source_url: "https://www.robbewulgaert.be/education/ai-greek-epigraphy-poetry-and-ai-with-pythia"
source_html_sha256: "52f3be730941b197010a8ecc862cc5f9db8cf385d9b99cba46a5c67a45d61cbd"
migration_status: "transformed"
created_at: "2021-11-22T14:34:27+01:00"
updated_at: "2022-01-22T20:58:24+01:00"
published_at: "2021-11-22T14:34:27+01:00"
author: "robbe-wulgaert"
excerpt: null
hero: null
seo:
  title: "AI & ANCIENT GREEK - Epigraphy, Poetry and AI with Pythia"
  description: null
  canonical_path: "/education/ai-greek-epigraphy-poetry-and-ai-with-pythia"
  image: "media-e1ca9c9eb9e92984"
  noindex: true
tags:
  - "AI"
  - "artificial intelligence"
  - "artificiële intelligentie"
  - "Dag van de klassieke talen"
  - "Dag van Klassieke Talen"
  - "Greek"
  - "grieks"
  - "Pythia"
categories: []
featured: false
previous_source_url: "https://www.robbewulgaert.be/education/digital-storytelling-in-virtual-reality-g4mbc"
next_source_url: "https://www.robbewulgaert.be/education/ai-in-the-classroom"
gallery: []
downloads: []
citations:
  - label: "Yannis Assael and Thea Sommerschield at the University of Oxford"
    url: "https://arxiv.org/abs/1910.06262"
  - label: "work of Tim Whitmarsh of Cambridge University."
    url: "https://www.cambridge.org/core/journals/cambridge-classical-journal/article/abs/less-care-more-stress-a-rhythmic-poem-from-the-roman-empire/B5A03C3981F21E885228D3C3184109E9"
---

[Video on YouTube](https://www.youtube.com/watch?v=MhNinruUhUw)

**When studying Classical Antiquity, we rely on all kinds of sources. Stories of great poets, beautiful temples, drawings on all kinds of objects… In this AI project you will be introduced to epigraphy, the branch of archeology that studies inscriptions on hard objects. Texts on stones, graves or walls. Due to the ravages of time or human actions, they are no longer always legible. But what if you could restore it with an AI tool? What if you could use this approach to discover the meaning of an ancient poem? A poem, please note, that bridges the gap between the poetry of the 2nd century AD. and today's.**

**In this AI project, developed in collaboration with Bram Fauconnier of Ghent University, we combine research from the University of Oxford and the University of Cambridge into one teaching package!**

### Epigraphy Introduction

![](../../../assets/migrated/29/29cc4a8a3be14fd15f30b2250e2f5ca6de26cf48ed91969eafe7628e8df8ba59-w810.webp)

Epigraphy is the branch of archeology that focuses on examining history through inscriptions. These can be found on, for example, stones, walls and graves, but also on bronze or lead. Hundreds of thousands of Greek inscriptions dating back to 800 B.C. have been found. to 700 AD over a huge area. From Newcastle to Kandahar, from Denmark to Yemen. Louis Robert would describe Greek and Roman society as _“Une civilisation d’épigraphie”._

Epigraphy can teach us more about the political, social, economic and cultural history of that fascinating time. Well-known finds include Res Gestae Divi Augusti and the Rosetta Stone.

### Epigraphy: challenges

Finds from the past are not always in good condition. Parts of the text have been lost through the ravages of time or human intervention. This can be about certain characters that fade or are missing. Often complete words, sentences or entire sections of the text are missing. This makes deciphering the meaning of the text not easy!

The epigrapher can rely on his knowledge and the existing corpus of texts to restore the find. That is not an easy job! For example, one must first be able to find out how many characters and words are missing. Given the gigantic amount of texts and possible inscriptions, this can be a long-term task.

A task where artificial intelligence can be of assistance!

### **Meet Pythia**

![](../../../assets/migrated/ad/ad95f25bc12e7187ade54078579a2f844d9c8ff414cbfc16e8b38fdaeaae90e1-w947.webp)

**Pythia** is a AI-model that was designed by [Yannis Assael and Thea Sommerschield at the University of Oxford](https://arxiv.org/abs/1910.06262). It's a model they trained on a massive collection of inscriptions dating back to 700 B.C. to 500 AD These were collected by the Packard Humanities Institute. This base of texts were adapted, diacritics were removed… so that the AI model could process them. This model worked on the basis of unsupervised learning.

![](../../../assets/migrated/68/684f1a3c337f6f60e45cd7d2ba9da1f42f6e8e19acee82adefac70ab0dc298cd-w657.webp)

The strength of Pythia and the AI techniques used is that they can handle very large amounts of data, analyze them and discover patterns. It is thus possible to hold more information in memory than an epigrapher himself could.

![](../../../assets/migrated/31/310f87d83dbe3d80447152caf156506473c2e81a6b52848c58f35298eb3c10fc-w451.webp)

Pythia can then be used to quickly search for the appropriate characters, given a text with missing characters. Attention, Pythia will not take over the epigrapher's job! Pythia is not flawless, but can be used as a tool for the epigraph. This is reflected in the success rates of the model. In the survey, the correct character, in 73.5% of cases, was among the top 20 hypotheses proposed by the AI model. But if you just trusted the null hypothesis for all missing characters, that percentage dropped significantly.

### Getting started with Pythia

![](../../../assets/migrated/f7/f761a814d1830a3af4b62901395708df314e9ed28200ac69ca937f5b5dd90a89-w1200.webp)

So if we want to get started with Pythia, we need a find. I based this on the [work of Tim Whitmarsh of Cambridge University.](https://www.cambridge.org/core/journals/cambridge-classical-journal/article/abs/less-care-more-stress-a-rhythmic-poem-from-the-roman-empire/B5A03C3981F21E885228D3C3184109E9) In it he describes a poem that had been spread from Spain to Hungary, found on walls, engraved on precious stones... Not a form of high literature, not a hero epic or magnum opus by a well-known writer. A small poem with a peculiar shape and an interesting meter!

By means of simple image editing, this poem was modified so that it appears damaged. Characters are missing and make translation very difficult. When we enter the text into Pythia, it gives an almost error-free result. A result that we can translate to find out the meaning of the poem!

**Input:**

λ--ουσιν ἃ θέλου--ν λεγ--ωσαν -ὐ μέλει --ι σὺ φί--ι με συμφέ-ει σοι

**Output Pythia:**
λέγουσιν ἃ θέλουσιν λεγέτωσαν οὐ μέλει _τ_οι σὺ φίλει με συμφέρει σοι

### **οὐ μέλει μοι - in search of the roots of modern poetry**

![](../../../assets/migrated/1b/1bf23d6937bd41cea292313c4770458261922ea8ed3488e475401f23c9d01d5c-w474.webp)

This poem, after research, turned out to work like stressed poetry. A form of poetry more similar to contemporary poetry than other works of its time. The poem is written in such a way that it visually fits neatly into a column, with 8 or 9 characters on each line. Epsilons are placed in such a way that they form a diagonal and the last three lines have a kind of rhyme.

**_λέγουσιν_** _- They say_

**_ἃ θέλουσιν -_** _What they like_

**_λεγέτωσαν_** _- Let them say it_

**_οὐ μέλει μοι -_** _I don’t care_

**_σὺ φίλει με -_** _Go on, love me_

**_συμφέρει σοι -_** _It does you good._

More than just the form, the content of the poem is also fascinating. It rejects prevailing conventions (both in intimacy and literature), seems to be repulsive, is an example of a kind of emerging middle classes and individualism… but it is also a mass product. It was manufactured and found in great numbers. You could compare it to a Che Guevara t-shirt in Primark. Throwing off responsibility, οὐ μέλει μοι means "I don't care," and the intimate lyrics are more reminiscent of a Taylor Swift's lyrics than Sappho or Virgil. It would also look damn good on an edgy t-shirt.

![](../../../assets/migrated/14/14c0149a463de2afeadc09793b9eb50742be0435f6bc65544f609736e0868217-w1140.webp)

### Contact

Do you have questions, feedback or remarks? Head on over to the contact page!

<div class="content-button-row content-button-row--center"><a class="content-button content-button--primary content-button--medium" href="/contactinfo">Contact</a></div>
