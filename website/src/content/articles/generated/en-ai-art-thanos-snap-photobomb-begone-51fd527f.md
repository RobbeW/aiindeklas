---
id: "source-article-51fd527f31139380"
title: "AI & ART - Thanos Snap: photobomb begone!"
slug: "ai-art-thanos-snap-photobomb-begone"
locale: "en"
translation_key: null
status: "review"
source_url: "https://www.robbewulgaert.be/education/ai-art-thanos-snap-photobomb-begone"
source_html_sha256: "dc3b587ace167d01fb0f93c498b25654310fbba73c9c5b55420b0d0a0dcf84bd"
migration_status: "transformed"
created_at: "2021-12-30T17:10:45+01:00"
updated_at: "2021-12-30T17:11:15+01:00"
published_at: "2021-12-30T17:10:45+01:00"
author: "robbe-wulgaert"
excerpt: null
hero: null
seo:
  title: "AI & ART - Thanos Snap: photobomb begone!"
  description: null
  canonical_path: "/education/ai-art-thanos-snap-photobomb-begone"
  image: "media-e4748620cbdff248"
  noindex: true
tags:
  - "AI"
  - "AI in de klas"
  - "Art"
  - "artificial intelligence"
  - "artificiële intelligentie"
  - "Thanos"
categories: []
featured: false
previous_source_url: "https://www.robbewulgaert.be/education/ai-in-the-classroom-deepfaking-a-deputy-prime-minister"
next_source_url: "https://www.robbewulgaert.be/education/digital-storytelling-in-virtual-reality-g4mbc"
gallery: []
downloads: []
citations:
  - label: "'large mask inpainting with Fourier Convolutions'"
    url: "https://github.com/saic-mdal/lama"
---

![](../../../assets/migrated/7a/7ab9bdf630597637744f637a40bd53a24c1ac8c8d8615a77e9a9b5a485948a1e.gif)

### I don't have to convince you that our world is becoming more and more visually oriented, where photos and cameras are gaining in importance. Ever since the smartphone has supplanted many a small camera and apps like Instagram have democratized photography, everyone has become an amateur photographer. With such photos, users like to strive for perfection. But what if an accidental passer-by, a difficult friend or a piece of garbage mar your shot? What if you could just erase those jammers with an AI model.

### **Are you the new Thanos?**

![](../../../assets/migrated/d1/d19c5459a21f28f7a647b605a208427236294926ffd3f1d04d34830aa3fec08c.gif)

You can clearly see what's going on in the GIF above. Disturbing objects simply disappear like snow in the sun. Ideal, therefore, when you have just taken that one holiday snapshot, but there is still one disruptive device to be seen.

But what **AI** **technology** is at work here? Is this form of **inpainting**  completely new? Where can we use this technology?

### **An easy job for Photoshop**

Avid users of photo editing software like Photoshop will know the clone stamp. It is a tool to clone pixels from one place to another place in the photo. If you do this very carefully and if you use the surrounding pixels of the disturbing object, you can manually remove it. The main drawback of this approach is, of course, that you have to do this manually, so the workload is on the user. A well trained AI model can help the user!

The **content aware brush** is such a handy tool that means you don't have to clone all pixels yourself, so manually, from one place on the photo to another place on the photo. This brush within programs such as Photoshop itself looks at which pixels are eligible to be used in the inpainting. The results are not always as convincing as if you were to do it manually, but it is a lot faster!

### **A new trick for Google Pixel**

![](../../../assets/migrated/f1/f1182fd7c89e73d7c4d21a437370a462237c3e6ecd1669d8032bc3b13f7c2461.gif)

In October 2021, Google launched its new smartphones, the sixth member of the Pixel line. These are notable because they contain a SoC (system-on-a-chip)  designed by Google itself. Google used to buy mobile chips from other manufacturers. With their own design, they bring their Tensor computing cores to mobile phones. These cores are specialized for processing AI applications and algorithms! In the past, this all had to be done on the CPU or central computing unit of a smartphone. This required too much computing power for the average processor.

One of their new AI applications is called the magic eraser and you guessed it, you can erase unwanted objects from a photo with it. So where before you had to edit the photo with a special program on a computer with a decent processor, you can now do it with AI on your smartphone!

### **How does this work?**

The AI model we use in this project uses so-called ['large mask inpainting with Fourier Convolutions'](https://github.com/saic-mdal/lama). A whole mouth full. But how does this actually work?

Default inpainting: This shape attempts to erase unwanted objects by looking at the immediately surrounding pixels. This approach does not look at the bigger picture.

Large mask inpainting: Here, in the initial phase of the approach of the model, a larger analysis field is used. This large mask therefore analyzes much more at a glance of the photo in order to adjust the unwanted parts. This approach succeeds better in including (predictable) textures of, for example, walls or fences in its solution.

![](../../../assets/migrated/78/78ec976f6fdfdec1f08b966dc6d549220e77181d85ed28b3c6d107a76330460f.gif)

### In the classroom!

[Video on YouTube](https://www.youtube.com/watch?v=aHzn5jEZ1m8)

### Questions, feedback?

Questions or feedback? Hit the botton down below and I’ll get back to you.

<div class="content-button-row content-button-row--center"><a class="content-button content-button--primary content-button--medium" href="/contactinfo">Contact</a></div>
