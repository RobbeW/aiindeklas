---
id: "source-article-1fd5a1a8e86177f9"
title: "Build your own smart trash can!"
slug: "build-your-own-smart-trash-can"
locale: "en"
translation_key: null
status: "review"
source_url: "https://www.robbewulgaert.be/education/build-your-own-smart-trash-can"
source_html_sha256: "457583d6cf1fb43e4f632487086463761b7257cce99dc8d594dcf146b06ff3b1"
migration_status: "transformed"
created_at: "2022-03-07T07:11:11+01:00"
updated_at: "2022-03-07T07:11:11+01:00"
published_at: "2022-03-07T07:11:11+01:00"
author: "robbe-wulgaert"
excerpt: "Sorting is important. Sorting is also sometimes doubting. But what if you could remove that doubt? What if you could build your own smart bin with artificial intelligence that helps you sort? It is all possible in your classroom!"
hero: null
seo:
  title: "Build your own smart trash can!"
  description: null
  canonical_path: "/education/build-your-own-smart-trash-can"
  image: "media-16f704932f3e95bb"
  noindex: true
tags: []
categories: []
featured: false
previous_source_url: "https://www.robbewulgaert.be/education/train-your-own-self-driving-car"
next_source_url: "https://www.robbewulgaert.be/education/open-an-ai-art-gallery"
gallery: []
downloads: []
citations:
  - label: "The Python software;"
    url: "https://www.python.org/"
  - label: "The Arduino IDE software to program the board;"
    url: "https://www.arduino.cc/en/software"
  - label: "Google's Teachable Machine"
    url: "https://teachablemachine.withgoogle.com/"
---

**Have you ever stood in front of a rubbish bin and wondered "is this still plastics, residual waste or something else?" You're not the only one. Sorting well is important and you want to do it right. That way we take care of the environment and the people who take care of our waste. A small effort for a better world. But what if you could remove that doubt? What if we could teach an artificial intelligence to sort and together build a smart waste bin? It is possible! And you don't need a doctorate or a huge computer to do it. This can be done perfectly with a laptop in the classroom!** 

[Video on YouTube](https://www.youtube.com/watch?v=mngiIefe8Nk)

### Requirements

To build a smart trash can that can help us sort, we need a few things. This project can be done on almost any school laptop that has a webcam and runs on a Windows operating system. If necessary, it can be adapted to run on, for example, Mac, but this requires its own adaptations and more extensive knowledge.

What do we need to build this smart bin?

\- A laptop with a webcam; 

\- [The Python software;](https://www.python.org/) 

\- An Arduino Uno, breadboard and LEDs; 

\- [The Arduino IDE software to program the board;](https://www.arduino.cc/en/software)

\- A USB cable to connect the Arduino Uno to the laptop; 

\- A sloppy 5,000 photos of rubbish to train an AI model.

5,000 photos of rubbish!? Don't worry, I'll help you out! But first a word about how an AI model works and why we need those pictures.

![](../../../assets/migrated/b1/b1b77edb4c5b05c3b0f868bb9f44eb8a28ac3d6b4cc3212b5987f71504b2d82f-w1600.webp)

### How can an AI recognise waste? 

If we want to build a smart rubbish bin with artificial intelligence, we first have to teach the AI to recognise and sort rubbish. This sounds very complicated, but it is very similar to how we teach children new words. If we want to teach children what a kitten, dog or cow is, we show pictures and tell them what the animal is called. We do the same with waste. We show a picture of a plastic bottle and say its name. We do this over and over again. Thousands of times even with our AI. Because that is what artificial intelligence is: autonomous systems that can imitate human behaviour. Just like you, an AI can learn!

![](../../../assets/migrated/78/781d7ddcd25e5d1f04e576443ecad35fc5e7b202905a9394ac197eb56365aeba-w1600.webp)

Inside the computer, our AI model will look for patterns in the images via algorithms. Usually, the more data and time we give the AI model, the better it gets at its task. This is called **Machine** **Learning**. As with human learning, there are different strategies to achieve learning. The one we use here, where we show the AI model thousands of pictures and indicate the name of the class (rubbish, plastic, paper, etc.), is called supervised learning. The model learns from the human pre-sorted pictures.

![](../../../assets/migrated/50/50992d9271243a946d2f285a4058d31824678056c25402e1ebb21cb9e2b23853-w618.webp)

_“Do I have some 5.000 pictures of trash on my personal computer? … Maybe.”_

You can do this 'machine learning' yourself via your computer. You can use [Google's Teachable Machine](https://teachablemachine.withgoogle.com/) for this. You can provide it with collections of photos that you label, and then train it! Once trained, our AI model can do a neat trick: you can take a picture of its learned knowledge (= checkpoint) and download it to the computer. That file can be loaded into another computer, which the pre-trained model can use immediately. Imagine that a maths exam is scheduled. The strongest student in the class studies this subject thoroughly and uploads his/her knowledge, whereupon the rest of the class downloads this to their brains.

Voila, the "brains" of our smart bin are ready!

![](../../../assets/migrated/d3/d33070ae19b61ec6335baf3aa3f7d24d337d4cb04c2b016a233e5600fd0fb3f2-w888.webp)

_You can train your own AI model for this project, or simply use my pre-trained_ **_checkpoint._**

### HTML – webcam trash sorting

Now that we have trained our artificial intelligence, thus providing our smart dustbin with "brains", it is time to work on its "eyes". In order to correctly recognise rubbish, our AI must of course be able to see it.  For this, we use the webcam of our laptop and the browser. 

For this project, you can use my standard HTML and Javascript files. If these computer languages no longer hold any secrets for you, you can also adapt them to your heart's content.

![](../../../assets/migrated/ab/ab5c6fb5a07dc91cc4c6a7226523c3d5de0820c96933d227bf89540ca2747b98-w1600.webp)

According to the AI, I am 100% paper waste. Clearly not a compliment day ...

### Arduino – our sorting / traffic light

We have equipped our smart waste bin with brains and eyes, but now it also has to 'do something' when it recognises a certain type of waste. For this we use an Arduino Uno. This is a small programmable computer board that we can very easily connect to a computer. We also have a breadboard on which we place four LEDs. This can later be expanded with servo-motors to open/close a physical bin. 

To program our Arduino, we need the Arduino IDE software. With this, we place a piece of code on our Arduino Uno. Through this piece of code, the Arduino will listen to incoming signals from our computer. Depending on the signal, it will light a specific colour LED.

![](../../../assets/migrated/cd/cd773304b34bc9f4b028dcc3b122b8b784bdfdb806395539930ee2473f6b3bbf-w1600.webp)

When our computer, via its webcam, recognises a piece of rubbish, it will send a signal. To send this signal, we use the USB port of the computer and a piece of software that forms the bridge between the recognition of our AI model and the Arduino. 

![](../../../assets/migrated/64/643e264a4d00f1443ab056b4cfb59b394c8f360ab71ef367a02656aa20d2100d.gif)

When all the pieces are in place, we can launch our smart bin. To do this, we use a few lines of Python in the command prompt of the computer. When you then use your web browser, you will be directed to the web page that can make use of your webcam. As a test, hold a piece of rubbish in front of it. Check the result on the screen and with the Arduino!

Voila, this is how you build a bin with artificial intelligence in your classroom and contribute to a better world!

[Video on YouTube](https://www.youtube.com/watch?v=EcN2jM6rDHs)

### I want this in my classroom! What do I have to do?  

Do you want to work with this in your classroom? Super! The future will be increasingly digital. A future in which artificial intelligence will play a very important role. It goes without saying that we need to prepare and motivate young people. I am happy to help you with that! You can send me a message via the button below. I usually reply within 48 hours!

<div class="content-button-row content-button-row--center"><a class="content-button content-button--primary content-button--medium" href="/contactinfo">Contact</a></div>
