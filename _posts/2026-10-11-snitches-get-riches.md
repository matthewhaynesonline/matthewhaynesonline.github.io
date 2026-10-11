---
layout: blog
title: "Snitches Get Riches?"
excerpt_separator: <!--more-->
banner_img: "/assets/images/watermark/watermark-banner.png"
yt_id: "-inCn9ibEtA"
# gh_url: ""
---

How the EU made AI snitch on itself.

<!--more-->

As of August 2nd, 2026, under [Article 50 of the EU AI Act](https://artificialintelligenceact.eu/article/50/), if a generative AI system writes text for anyone in the EU, the output has to be marked in a way so it can be detected as AI. And... that mark has to be "effective, interoperable, robust and reliable as far as technically feasible". No biggie, right?

{% include yt_embed.html %}

---

Here's the problem: the obvious ways to watermark a file, like tacking on some metadata, get stripped when you copy the text into another document or even harder, when you paste as plain text. So, if you want a mark that survives the real world, like retyping it word for word, then it can't be attached as a separate thing. It has to be hiding _inside the text_.

[editor insert zoolander "in the computer" meme]

That shouldn't be possible, right? Turns out, it is possible... mostly.

## Pretty clever isn't

If you're even a little technically inclined, like yours truly, you've probably already got a guess. And five years ago, your guess might've been pretty clever. But, well, pretty clever isn't going to cut it anymore.

### Guess one: invisible characters.

[Unicode](https://en.wikipedia.org/wiki/Unicode) is chock full of characters that don't render... anything at all: [zero width spaces](https://en.wikipedia.org/wiki/Zero-width_space), joiners, all kinds of fun stuff. Sprinkle a secret pattern of these bad boys throughout and you've got yourself an invisible watermark.

<div class="mb-4" data-svelte-component="WatermarkZeroWidth"></div>

Sorry. That ain't it.

<img class="img-fluid rounded" src='{{"/assets/images/watermark/no-dog.jpg"  | relative_url }}'  alt="That's a no, dog.">

Don't feel bad, it was my first thought too, which means it was probably _everybody's_ first thought.

"Paste as plain text" strips those invisible characters instantly as does a good chunk of the internet (can't have nice things), so that watermark gets scrubbed before it has a chance to make Europe proud.

### Guess two: steganography.

Hide the watermark using characters that should _already_ be there. Swap a Latin "c" (U+0063) for a Cyrillic "с" (U+0441) and so on. That specific trick is called [homoglyph](https://en.wikipedia.org/wiki/Homoglyph) substitution, and it's just one tool in the [steganographic](https://en.wikipedia.org/wiki/Steganography) tool kit.

<div class="mb-4" data-svelte-component="WatermarkHomoglyph"></div>

But... same problem. Retype it or run it through autocorrect, and those impostors get caught and goodbye watermark.

See the pattern? Nothing you _add_ or _disguise_ makes it through retyping or spell checking. Soooo that leaves one last place to hide: the word _choices_.

## Hiding in plain sight

So here's how you actually pull it off. And when I first read about this approach, I had a lot of doubts, but stick with me (I guess these PhDs are pretty smart).

The approach is [SynthID Text](https://www.nature.com/articles/s41586-024-08025-4) from Google DeepMind and Anthropic says [future Claude models will use a version of it](https://www.anthropic.com/news/claude-text-watermark). Globally, by the way, not just in the EU. Thanks, Brussels.

An LLM writes one word (token) at a time, based on everything before it. When the model goes to pick the next word (token), it isn't picking from just one choice. It gets a whole bunch of _possible_ next words (tokens), each with its own probability. "The coffee is \_\_\_" maybe "hot", or "good", or "cold", and so on. That's the key to it all.

Before the model picks, we use a secret key to give every possible word a hidden score: a random looking number between zero and one. And we do this _reproducibly_. The score for each word is derived from the secret key plus a hash of the word that came just before it. Same previous word in, same set of secret scores out (the real thing keys on "a few words that come before", but let's keep it simple... you'll live). So, every word (token) gets a score and then what?

## Fight to the death

With those scores in hand, instead of letting the model pick as usual, we make the candidates battle it out in a tournament for the EU's amusement (and they say chivalry is dead). The model still draws real candidates from its own probabilities first, we just keep whichever one drew the _higher_ secret score from those probable options. _That's_ the chosen word. Then we do it again for the next word, and again, and again.

<div class="mb-4" data-svelte-component="SynthIDTournament"></div>

Do that hundreds of times in a paragraph and the text steadily fills up with high scoring words:

<div class="mb-4" data-svelte-component="SynthIDPassage"></div>

You'd think this probably wrecks the writing, right? Well, in theory, it shouldn't.

<img class="img-fluid rounded" src='{{"/assets/images/watermark/you-sure.png"  | relative_url }}'  alt="You sure bout that?">

See, only the model's own candidates make it into the tournament and a word's (token's, wonder if I can drop this clarifier yet without getting crucified) probability decides how _often_ it shows up in the bracket. Likely words hold more tickets to enter, so they still win most of the time _on average_. Over a whole passage it smooths out and doesn't stray much from what the model would have written anyway.

DeepMind ran it live in Gemini across about [20 million responses](https://www.nature.com/articles/s41586-024-08025-4) and found no statistically significant difference in thumbs up / thumbs down ratings between watermarked and unwatermarked answers. `¯\_(ツ)_/¯`

## You feelin lucky punk

Right, that's _writing_ the watermark, but how do you _read_ it? Guess what, you don't need the model at all! Not the weights or the prompt, just the text, the secret key (and yes the matching tokenizer, nerds). Since the secret scores were built from the words themselves (with each word setting the scores for the next), anyone holding the key can walk the text and re derive every score from scratch. Then you look at the winners.

In normal writing, the words that got picked carry a random mix of high and low scores, averaging out around 0.5. In watermarked text, the winners _can't stop winning_.

<div class="mb-4" data-svelte-component="SynthIDDetection"></div>

Just how much winning? Run a thoroughly watermarked passage of a thousand+ words and the odds it happened by chance are smaller than one in a trillion...

<div class="mb-4" data-svelte-component="SynthIDQuality"></div>

Impossible? No, but you're more likely to sink a hole in one and then immediately get struck by lightning.

## Wrinkles

### First, you need the key.

Even though you don't need the model, you still need _something_. And this something, the key, is probably something the model providers are gonna wanna keep a hold of. More on that haves vs have nots later.

### Second, the model needs a choice.

Take a spot where there's basically one reasonable next word. "Barack" is almost certainly followed by "Obama". Both slots draw "Obama", so the tournament is "Obama" vs "Obama" and the secret score really has nothing to decide.

<img class="img-fluid rounded" src='{{"/assets/images/watermark/obama.jpg"  | relative_url }}'  alt="Obamna.">

So, the watermark can only live where the model had options: factual passages, light proofreading and precise output (like code syntax) carry little to no watermark, and short snippets are hard to call either way.

## The one you've heard of

Now, if you've read _anything_ about AI watermarks, you've probably seen green this and red that, and you may be thinking I didn't do my homework.

The paper most people cite, [Kirchenbauer et al. (2023)](https://arxiv.org/abs/2301.10226), does it a little differently. Arguably a little simpler. It's like a cousin to that SynthID paper. Both trace back to a [2022 proposal by Scott Aaronson](https://scottaaronson.blog/?p=6823) whose big idea was that the watermark only changes the _source of randomness_ used to pick among words.

Anyway, you use the secret key to split the model's entire vocabulary in half, team green and team red, and nudge all the green words up _a little bit_ so the model leans green. To check, you just count green words: normal writing lands on green about half the time; watermarked text? Far more.

<div class="mb-4" data-svelte-component="WatermarkGreenList"></div>

Now, it's a lovely way to _get_ the idea (it's what I read about first), but it's rougher on quality: you're boosting half the dictionary instead of the already probable choices the model liked. And notably, [it's _not_ what Claude](https://www.anthropic.com/news/claude-text-watermark) or Gemini ship.

<div class="mb-4" data-svelte-component="GreenVsTournament"></div>

## To the moon

Yet another aside, because you, similarly pretty clever reader, may have had the same thought as me: doesn't this sorta sound like a [blockchain](https://en.wikipedia.org/wiki/Blockchain)? Each word's check depends on the previous word... isn't that the whole schtick?

Almost, but, well, actually, no. In a blockchain, every block's hash incorporates the _entire_ history before it. Edit one early block and the change cascades through everything after it (which is what makes tampering impossible to hide):

<div class="mb-4" data-svelte-component="Blockchain"></div>

The watermark is different. Each spot is seeded by _just_ the word (or few words) right before it, not the whole history. Change a word and you only mess up the handful of spots that depend on it (i.e. the word(s) and the word after it), and that's it. This is why changing a word here and there won't strip the watermark.

## More wrinkles

So the EU has its answer: mandate the watermark and Big AI snitches on itself. Case closed. ...except maybe not. This only works if the model _chooses_ to do it and there are a few ways that falls apart.

### First: the provider just... doesn't.

The watermark happens in the sampling step, inside the model's inner workings. A provider outside the EU's reach

<img class="img-fluid rounded" src='{{"/assets/images/watermark/Communist_Bugs_Bunny.jpg"  | relative_url }}'  alt="Our meme.">

can simply never add it and thus there's nothing in the text to find.

### Second: paraphrasing.

Feed watermarked text to another model and ask it to reword it. This one _does_ work, but there's no free lunch. The watermark isn't in any single word you can surgically delete; it's smeared across every choice in the text, so light edits barely dent it. Based on the green list paper, it requires editing roughly a _quarter_ of the words.

There's another gotcha: to paraphrase _well_, you need a strong model. But if you already have a strong, non watermarking model, well, you probably don't need the watermarked one in the first place. So, in practice you'd use a _weaker_ model to strip the text, which probably _will_ tank the very quality you were trying to keep.

### Third (the doozy): open weights.

If you're of the [molon labe](https://en.wikipedia.org/wiki/Molon_labe) persuasion:

<img class="img-fluid rounded" src='{{"/assets/images/watermark/roomba-gun.png"  | relative_url }}'  alt="Come and take it.">

then the model is probably running on _your_ GPU from weights _you_ downloaded and there's not a dang thing the espresso sipping bureaucrats in Brussels can do to make it watermark anything.

### Haves and have nots.

One more thing. Remember the haves vs have nots? _Nobody has the key except the people who made it._ So you're depending on the model makers for detection tools. Anthropic has a detection API in private preview for regulators, law enforcement, media / fact checkers, researchers and the like, with plans to expand access "over time" (gee thanks). So you and I can't check a piece of text for Claude's watermark. There's also an irony waiting if detection ever goes fully public: a public detector is also a handy tool for tweaking a paraphrase until it passes.

So with the stroke of a pen the law can _require_ the watermark and with some really clever math we can even make it work. But just because the law says so doesn't mean everyone does it. Haven't you heard? Crime's illegal!

## Using the AI to find the AI

So what do you do with the noncompliant rebels? Use the AI to find the AI, of course.

[editor insert thanos "I used the stones to" meme]

The strongest version of this approach comes from a company called [Pangram](https://www.pangram.com/research/how-it-works). In simple terms: train a neural net to do one thing, decide human or not human ([or hotdog or not](https://silicon-valley.fandom.com/wiki/SeeFood)).

<img class="img-fluid rounded" src='{{"/assets/images/watermark/hotdog.png"  | relative_url }}'  alt="Not hot dog.">

Any source, any model, no secret key, no tokenizer, no cooperation required: all you need is the text.

Two not so obvious things make it work:

### First, it's _not_ scanning for predictable words.

The older idea measured how _surprised_ a model is by each word ([perplexity](https://en.wikipedia.org/wiki/Perplexity), for you nerds) and called the unsurprising stuff AI. But then the Bible, the Declaration of Independence and _Frankenstein_ are all [100% AI](https://www.pangram.com/blog/how-does-pangram-work), apparently. But whaddaya know, those texts are all over the training data, so of course every word looks unsurprising.

Instead of per word surprise, Pangram pools the whole passage into a kind of stylistic fingerprint (the phrasing, the flow) and learns which fingerprints are likely AI.

<img class="img-fluid rounded" src='{{"/assets/images/watermark/pangram-paper.png"  | relative_url }}'  alt="Pangram paper.">

Sure, there are tells you could point to, ahem, **"LoAD BEAriNg"**, but Pangram is looking at the big picture.

### Second, the training.

For every piece of human writing, they have a model write its own copy: same topic, same length, same tone, so the only variable is human vs AI.

<img class="img-fluid rounded" src='{{"/assets/images/watermark/pangram-mirrors.png"  | relative_url }}'  alt="Pangram mirrors.">

Then they run the detector across millions of human documents, take the ones it wrongly flags as AI, and train specifically on those mistakes. Each round it gets harder to fool and the false positive rate drops.

<div class="mb-4" data-svelte-component="PangramMirrorMining"></div>

And it works pretty dang well. Pangram's [latest technical report](https://arxiv.org/abs/2607.27183) claims a false positive rate of 0.0041%. Mind you, that's self reported, but an [independent audit](https://www.nber.org/papers/w34223) of the previous version found Pangram had near zero error rates and was the only detector tested that could hold a strict false positive cap without giving up accuracy.

## Fin

Have I mentioned there's no free lunch? The EU's [Code of Practice](https://digital-strategy.ec.europa.eu/en/faqs/code-practice-transparency-ai-generated-content) asks for two layers of marking, signed metadata _and_ watermarking, _and_, if you'd be so kind, optional fingerprinting. With hedges like that, they're telling you they don't have much faith in any single one of them.

You'd be led to believe detection is a solved problem. It isn't. There are two solutions, opposite solutions, that each get about halfway there. One is near certain but needs the model's cooperation _and_ the provider's secret key. The other works on anything but can wreck someone's credibility when it's wrong.

If you're interested in running your own local AI (watermark free), check out my other stuff, and pls dRoP a CoMmEnT on the video to bait the algorithm.

## References

- Anthropic (2026), [_How Claude's text watermarking works_](https://www.anthropic.com/news/claude-text-watermark)
- Dathathri et al. (2024), [_Scalable watermarking for identifying large language model outputs_](https://www.nature.com/articles/s41586-024-08025-4), _Nature_ 634, 818–823
- Kirchenbauer et al. (2023), [_A Watermark for Large Language Models_](https://arxiv.org/abs/2301.10226)
- Aaronson (2022), [_Watermarking GPT's output_](https://scottaaronson.blog/?p=6823)
- [_Pangram 4 Technical Report_](https://arxiv.org/abs/2607.27183) (2026)
- Pangram, [_How it works_](https://www.pangram.com/research/how-it-works) and [_How does Pangram work?_](https://www.pangram.com/blog/how-does-pangram-work)
- Jabarian & Imas (2025), [_Artificial Writing and Automated Detection_](https://www.nber.org/papers/w34223), NBER w34223
- [EU AI Act, Article 50](https://artificialintelligenceact.eu/article/50/), [Article 99](https://artificialintelligenceact.eu/article/99/) and the [Commission FAQ](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- [Code of Practice on Transparency of AI-Generated Content](https://digital-strategy.ec.europa.eu/en/faqs/code-practice-transparency-ai-generated-content)

{% include blog_links.html %}
