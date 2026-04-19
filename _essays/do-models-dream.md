---
title: "Do Models Dream of <span class='text-primary'>Fascist</span> Sheep?"
date: 2026-04-18
layout: essay
excerpt_separator: <!--more-->
banner_img: "/assets/images/do-models-dream/fascist-party-hq.jpg"
yt_id: "xDg8kd9nopQ"
gh_url: "https://github.com/matthewhaynesonline/Axiom"
---

Embedding models encode invisible value systems. Let's measure them and ask what happens when those judgments end up inside your search and recommendation engines.

<!--more-->

When you think of attack vectors, [SQL injections](https://en.wikipedia.org/wiki/SQL_injection) and [buffer overflows](https://en.wikipedia.org/wiki/Buffer_overflow) come to mind. But what if the more interesting vulnerability isn't a code exploit at all? What if the moral compass of a machine learning model, baked in during training and invisible to standard audits, can quietly shape what your search engine surfaces, what your recommendation system promotes and what your content moderation system flags?

Embedding models underpin all of these systems. Their job is to encode the meaning of text in geometric space, so that "king" ends up near "queen" and "democracy" ends up somewhere near "freedom". [^2] In doing so, they can't avoid making semantic judgments.

{% include yt_embed.html %}

<em>Additionally, <a href="https://raw.githubusercontent.com/matthewhaynesonline/Axiom/refs/heads/main/paper/paper.pdf">a research paper</a> and a <a href="https://huggingface.co/collections/matthewhaynesonline/axiom">collection on Hugging Face</a> is available for a more in depth look at the project.</em>

So: do these models have ingrained value systems? And if they do, does the answer change depending on where the model was trained? The short answer is yes to both and it turns out the disagreements _between_ models are as interesting as the findings within any single model.

---

## Measuring Morality

Machine learning models are products of their training data and the process that shapes them. That led me to suspect that cultural and philosophical artifacts from that training would surface in model behavior. Secretly, I was hoping for a bombshell; say, Eastern models overtly favoring communism and decrying capitalism. That turns out not to be the case (this isn't a cartoon); what's there instead is subtler, more structurally interesting and arguably harder to dismiss. But to get there, I needed a way to measure it.

As it so happens, the research field is rich with [literature on measuring and interpreting model bias](#references). Coming from a [dev background](https://github.com/matthewhaynesonline), rather than an academic one, I inadvertently reinvented the wheel up to roughly the late 2010s of the research world. [^3] [^4] [^5] Having independently converged with the research literature was reassuring, though; I was on to something.

The core premise was simple: gather models from different origins (East, West, Academia), collect a set of ideologically loaded terms (communism, capitalism, fascism) and measure how similar each model thinks those terms are to judgment words like "good" and "evil". The geometric foundation for this kind of meaning measurement goes back further than you might expect. [^1]

## The Wheel, Reinvented

My first instinct was straightforward: generate embeddings for ideological terms like "communism" generate embeddings for judgment words like "good" and "evil" calculate the similarity of each ideological term against both and use that to produce a good vs evil score. This premise actually holds up surprisingly well ([check out the big brain on Matt](/assets/images/do-models-dream/brain.jpg)), but there are a few implementation problems I had to work through.

The first one: if you have two separate similarity scores (one for "good" one for "evil"), how do you combine them into a single score? My naive first pass was to flip the sign on the evil similarity score and average the two. Voilà, a simple good to evil spectrum.

<div class="mb-4" id="good-evil-avg-viz" data-svelte-component="AxiomGoodEvilAvg"></div>

There's a more elegant approach called semantic axis projection [^3] [^5], but we'll get there.

Next problem: a single term's position on that spectrum is almost meaningless in isolation; you need something to compare it against.

## It's All Relative

So now we have a good to evil score for each term. Since we're using cosine similarity, the values are bounded (`+/- 1.0`), but the real problem is that different models use different portions of that range with different spreads. One model might score its most evil term at `-0.1` and its most positive at `+0.15`. Another might span `-0.45` to `+0.4`. The absolute values aren't comparable... but if we had a way to compare the relative spread and ranking of terms across models, that should still do the trick.

Enter [z-score normalization](https://en.wikipedia.org/wiki/Standard_score). Z-score takes a set of values and recenters them so the mean is zero and one unit of distance equals one standard deviation. In plain terms: it converts each model's raw scores into relative positions within that model's own distribution.

<div class="mb-4" id="z-score-viz" data-svelte-component="AxiomZScore"></div>

Now we can put every model on the same scale and compare them directly. Not because the raw numbers match, but because we've made the spread equivalent. And this works well... until you have one term, like fascism, that drags spread to one extreme and squishes all the other terms into the middle.

## Extreme Terms Are Extreme

Fascism, for example, is so clearly negative that it anchors one end of the scale and every other term loses resolution. But there is a solution... clever math to the rescue yet again: [the hyperbolic tangent function, tanh](https://en.wikipedia.org/wiki/Hyperbolic_functions).

Its output is S-shaped: values near zero pass through almost unchanged, while values at the extremes get gently squeezed toward the boundary without ever hitting it. Instead of fascism pinning the scale and flattening everything else, it gracefully approaches the limit and leaves room for the rest of the distribution to breathe.

<div class="mb-4" id="tanh-viz" data-svelte-component="AxiomTanh"></div>

Combined with z-score, this gives us a final score for each term in the range (-1.0, +1.0), never exactly hitting the edges, comparable across models, and robust to the occasional term that really, _really_ wants to be the most evil thing in the room.

## Welcome to 2016

The results looked promising, but something felt off about blending two separate similarity scores into one. It was around this point that I had the brilliant idea to check whether anyone had already solved this more elegantly... and of course, they had.

The better approach is called semantic axis projection. [^3] [^5] [^10] Instead of scoring a term's similarity to "good" and "evil" separately and combining the results, you construct a single directional vector by subtracting the "evil" embedding from the "good" embedding.

<div class="mb-4" id="axis-projection-viz" data-svelte-component="AxiomAxisProjection"></div>

This gives you a conceptual axis pointing from negative to positive in the embedding space. Then you “project” each term onto that axis; one operation, one score, no blending required. Terms that align with the positive direction score high; terms that point the other way score low. The same tanh normalization applies after.

It's more methodologically sound and in testing, the rankings are cleaner and less sensitive to the scoring quirks of either pole individually. [^8]

## Beyond Good and Evil

There's one more wrinkle worth addressing. Early bias research used static embeddings like Word2Vec, [^2] where every word had a single fixed vector. Modern transformer models, however, are contextual: the same word gets a different embedding depending on the surrounding text. Those of you familiar with machine learning may be wondering if I'm about to [mention financial institutions and water](https://en.wikipedia.org/wiki/Word_embedding#Polysemy_and_homonymy). You better believe it!

"Bank" next to "river" lands somewhere different than "bank" next to "interest rate". That context sensitivity is what makes modern models so capable and what makes measuring isolated terms trickier. The research community has already wrestled with this problem when going from static to contextual encoders. [^6]

However, for my use case, the chosen terms are fairly unambiguous: "fascism" doesn't have a competing river adjacent use, so I suspected contextual drift would be minimal and testing seemed to confirm that. But I still wanted a way to smooth over any methodological quirks a single axis pair might introduce.

Time for more clever math? Not exactly. The solution: run multiple axis pairs in parallel. Good/evil, virtuous/wicked, safe/dangerous, feasible/unfeasible, superior/inferior, ideal/flawed. Six pairs, all measuring the same terms. Any single pair might have an idiosyncratic blind spot. Six pairs, averaged? Considerably harder to fool. [^7]

## Matt-chanistic Interpretability

With per model scores in hand, it was time to [actually look at the data](https://en.wikipedia.org/wiki/Mechanistic_interpretability). I built a companion app to interactively filter and visualize it, with a few aggregate metrics added on top: a composite score blending all six axis pairs, per term averages across all models and per origin averages grouping the Eastern, Western, and Academia models respectively.

Three visualizations did most of the analytical work. The first is a heatmap: terms as rows, models as columns, cells color coded from red to green by score. At a glance you can see which terms every model agrees on (uniformly red or green across the row) and which ones fracture (where one model's green is another's red).

<div class="mb-4" id="heatmap-viz" data-svelte-component="AxiomHeatmap"></div>

The second is a scatter plot (also interactive) with the following axes: x is mean sentiment (evil to good), y is cross model disagreement (consensus to contested). This puts every term into one of four quadrants: consensus negative, consensus positive, contested negative, contested positive. Terms near the origin are ones the models collectively shrug at and terms far from it are strongly opinionated, deeply divisive or sometimes both.

<div class="mb-4" id="scatter-viz" data-svelte-component="AxiomSentimentConsensus"></div>

The third is a Value Systems ranking which asks each model a series of questions like: "what is the best type of economy?" or "how should knowledge be established?" and ranks the selected answers by how close each model places them to the question itself. Unlike the axis projection scoring used in the heatmap and scatter plot, this measures the cosine similarity between the question embedding and each answer embedding and normalized within each model. The result is less a sentiment score and more a preference: not "is capitalism good?" but "when asked about economic systems, which answer does this model reach for first?".

<div class="mb-4" id="value-rankings-viz" data-svelte-component="AxiomValueSystems"></div>

## Where's the Bombshell

Glad you asked, rhetorical section header. [And now for something completely different.](https://en.wikipedia.org/wiki/And_Now_for_Something_Completely_Different)

## When the Control Becomes the Experiment

Before getting to the political stuff, I need to tell you about hammers. You see, control terms were included to validate the pipeline (can you imagine if I forgot that?). And if the method is working as expected, seemingly neutral things like "hammer" and "table" should score close to zero. No model should have strong feelings about screwdrivers, right? Except, well, they do.

Consistently, across all eight models, tools score negative: Hammer (`-0.45`), Screwdriver (`-0.38`), Rope (`-0.19`). The cross model disagreement on these terms is low, meaning it's not a quirk of one model's training data, it's consensus.

My first take on this was that tools could be associated with violence, but that only explains half the story. What about the strongly positive terms? Consumption / domestic / services concepts do well: e.g. Store (`+0.45`) and Bank (`+0.16`). Maybe, these models are class conscious after all, just not in the way you were hoping. Seemingly the models have absorbed a conception that consumption and service concepts are closer to "good" and "ideal" and manual and physical ones are closer to "flawed" and "inferior". [^7]

I can't imagine this is a deliberate choice in the training (certainly not across multiple models and origins); instead it's an artifact of what gets written about positively, on the internet, etc., versus what doesn't. This is an implicit class bias baked into the models (that are running in search and recommendation systems) and it showed up in the dataset designed to have no signal at all. Your controls may not be as clean as you think.

## Can We Get Along

The next surprise, or rather relief, was what the models didn't disagree about. Running the political/economic terms through the disagreement scatter, I expected the most contested concepts to be the ideologically charged ones. Fortunately, we all can agree that fascism is bad. It has a cross model standard deviation of `0.08`. All eight models, regardless of origin, agree. The concept is so thoroughly associated with historical atrocities, which would reflect in the training data, that the models converge.

Where the models depart from one another is the messy middle: Deregulation (std=`0.29`), Mixed economy (`0.29`), Corporatism (`0.25`). These are concepts without a clean ideological home; terms whose score, positive or negative, depends entirely on your priors about what role the state should play. So, the models faithfully mirror our general political discourse: we agree on everything we agree on except the things we don't.

## Forgiveness Is for Losers?

Value laden terms were supposed to be the easy read, but it looks like the ethics text books didn't quite make it through training unscathed. Collective terms score well: Sustainability (`+0.38`), Solidarity (`+0.33`) and Stewardship (`+0.31`). On the other hand, yielding terms not so much: Forgiveness (`-0.29`), Humility (`-0.25`). Yielding traits probably cluster near weakness and inferiority in training text, while collective achievement and stewardship terms co-occur with positive (civic / environmental) discourse. Now, the models aren't making a philosophical call about forgiveness; they're doing something more mechanical and more alarming: they've learned that texts containing words like "forgiveness" and "humility" tend to appear in contexts that also contain words like "surrender" and "inadequate" and the scoring reflects that. [^4]

Empathy (std=`0.23`) and Piety (std=`0.23`) are also contested value terms, with no cross model consensus on whether caring and religious devotion are positive or negative concepts. That means if you're using these models for content moderation, educational recommendation or alignment evaluation for other AI systems, you may end up systematically penalizing traits that meatbags, er humans, broadly consider virtuous.

## East vs West: You Can't Always Get What You Want

In case this hasn't been appropriately hedged enough already, here's where I have to disappoint anyone looking for a gotcha moment. No group overtly favors authoritarian or extremist systems. There is no model that scores "dictatorship" positive and "democracy" negative. The differences are subtler but also more interesting because they're not obviously crude.

On economic framing divergence: East composite models (the average of all Eastern models) are measurably more favorable toward state involved concepts: Planned economy, Subsidy, Sovereign debt score higher relative to West composites. West composites, on the other hand, score market mechanism terms higher. Neither group is extreme and both occupy a plausible fence sitting centrist range. They just disagree, consistently, about which flavor of centrism.

The value framing divergence is the cleaner signal. West composite models score individualistic and accountability oriented values higher: Liberty, Freedom, Accountability. East composite models score social cohesion values higher: Service, Stewardship, Fraternity. This roughly tracks with individualism/collectivism axes and the embedding geometry is reconstructing something real about where these models' training data come from. [^9]

The sharpest single divergence was in the Value Systems ranking: East ranks globalism dead last (#7) and multiculturalism #3. West ranks multiculturalism dead last (#7) and globalism #4. A reversal on two closely related concepts. And then we have epistemology. East composite ranks empiricism #1: bottom up, trust what you observe. West and Academia rank scientific consensus #1: institutionally validated, trust the process. The distinction between direct observation and institutional authority as the source of legitimate knowledge is a genuine philosophical divide and it appears in the embedding space of models you'd otherwise evaluate exclusively on retrieval benchmarks. I'm not quite sure what to make of it, given the otherwise collectivist vs individualist tilt, but that's live television for you. A skepticism, perhaps, toward Western credentialing structures?

## Disorderly Anarchy

Leave it to the anarchists to buck our tidy little experiment. Every group ranks Mixed economy #1 for best type of economy in the Value Systems rankings. West and Academia composites both rank Market anarchism in the top 3, above Socialism - and when's the last time someone got elected on anarchy?

This is almost certainly a geometric artifact; "market" carries strong positive value and "anarchism" clusters near decentralization and autonomy, which score well. The combination produces a high score without an ideological signal about actual market anarchism. This is worth flagging because it's an example of how embedding geometry can generate semantically surprising outputs that look like findings, but are likely accidents. The method is measuring something real but it is also capable of producing misleading outputs worth investigating. Caveat emptor.

## So What

Let's talk about what any of this actually means in order of how confident I am.

Here's what I can demonstrate directly: standard benchmarks don't detect any of this. [MTEB](https://huggingface.co/spaces/mteb/leaderboard) doesn't measure ideology. A model can be state of the art on retrieval benchmarks and still encode findings described above. That's a concrete gap, not a theoretical concern.

The biases are also coherent, not random. The East / West divergences are consistent across multiple model representatives within each group, survive across six independent semantic axes and map onto documented cultural differences. Structure, not noise.

What's plausible but unmeasured at scale: a search or recommendation engine running on an Eastern origin model may produce systematically different rankings than one running on a Western origin model for queries involving politically loaded concepts. Not because anything is filtered or blocked, just a result of the model geometry’s baked in preferences. The companion app gives a miniature look into this. The Value Systems tab shows each model's ranking of concepts like "best type of economy" and "how should knowledge be established". The lists aren't wildly different, but they aren't the same either and nothing in standard deployment practice would surface that gap. The bias operates silently, entirely through similarity score ordering. And it compounds. A single query tilt is small in absolute terms, but recommendation systems make thousands of successive judgments. A consistent geometric tilt per step compounds the same way interest does: slowly, and then all at once. The cross model disagreement scores this pipeline produces are a measure of that per step tilt.

Now for the speculative part.

The same geometric structure that organically encodes cultural bias from training data could instead be deliberately encoded by a sophisticated actor with influence over training data: state media operations, large organizations and entities control and shape the large crawled datasets. What would that actually look like? You wouldn't make "democracy" score negative; that's too obvious. Instead you'd compress the positive signal slightly. Push contested terms toward neutral. Increase the distance between certain concepts and positive anchors a hair. Nothing is censored, nothing is removed. Concepts remain in the vocabulary, they're just slightly harder to find, slightly less similar to "good" and "ideal". For a system operating at scale, that's sufficient to shape what information surfaces. And the resulting biases would be statistically indistinguishable from organic ones.

A pipeline like this, run systematically across model releases over time, could function as an early warning system for this class of manipulation. Model weights are billions of floating point numbers with no direct mapping between individual parameters and semantic concepts. Probing of the output is one of the few practical investigative methods available. But here's the uncomfortable corollary: a published detection pipeline is also a benchmark for calibrating an attack. You could use this to tune the attack to [fall just below detection thresholds](https://en.wikipedia.org/wiki/Goodhart%27s_law). That's the same disclosure tension arms race as security vulnerability research: publish the exploit, improve the defenses, accept that you've also handed a tool to the people you're defending against. I don't think there's a clean answer; only the acknowledgment that the tradeoff is there.

## Fin

So, do models dream of jack booted sheep? Not exactly. They dream of subtler, more interesting world where hammers are vaguely suspect, forgiveness is for the weak and whether globalism is good or bad depends on who trained you. No smoking gun. Just geometry, quietly doing its thing inside the search and recommendation engines you use every day.

## References

[^1]: Osgood, C.E., Suci, G.J., & Tannenbaum, P.H. (1957). _The Measurement of Meaning_. The foundational psychology text introducing the Semantic Differential scale, which established that meaning can be geometrically mapped as coordinates in a multidimensional space defined by polar opposite axes; the direct theoretical ancestor of semantic axis projection.

[^2]: Mikolov, T., et al. (2013). ["Linguistic Regularities in Continuous Space Word Representations."](https://aclanthology.org/N13-1090/) The landmark Word2Vec paper, which proved that linear substructures within an embedding space correspond to human concepts, establishing the geometric foundation that makes semantic axis extraction mathematically possible.

[^3]: Bolukbasi, T., et al. (2016). ["Man is to Computer Programmer as Woman is to Homemaker?"](https://arxiv.org/abs/1607.06520) Pioneered the modern method of defining a semantic axis by subtracting antonym pairs and applying PCA to find the primary direction of variance, formalizing how to construct and project words onto an axis.

[^4]: Caliskan, A., Bryson, J., & Narayanan, A. (2017). ["Semantics Derived Automatically from Language Corpora Contain Human-like Biases."](https://arxiv.org/abs/1608.07187) Introduced WEAT, validating that measuring where a word lands along an axis between two conceptual poles is a reliable method for uncovering latent semantic associations in models.

[^5]: An, J., et al. (2018). ["SemAxis: A Lightweight Framework to Characterize Domain-Specific Word Semantics Beyond Sentiment."](https://arxiv.org/abs/1806.05521) Generalized the axis concept beyond bias and sentiment into a customizable framework for mapping any conceptual dimension, providing the direct blueprint for constructing arbitrary semantic axes from opposing seed words.

[^6]: May, C., et al. (2019). ["On Measuring Social Biases in Sentence Encoders."](https://arxiv.org/abs/1903.10561) Extended WEAT to contextual sentence encoders (SEAT), demonstrating that axis based measurement remains valid even when a word's vector changes based on surrounding context.

[^7]: Kozlowski, A.C., et al. (2019). ["The Geometry of Culture: Analyzing the Meanings of Class through Word Embeddings."](https://arxiv.org/abs/1803.09288) Demonstrated the robustness of semantic axes as cultural dimensions by using antonym derived axes to track sociological shifts across 100 years of historical text.

[^8]: Mathew, B., et al. (2020). ["POLAR: A Framework for Exploiting Polar Opposites in Language Models."](https://arxiv.org/abs/2001.09876) Bridged Osgood's 1957 psychological framework with modern NLP by transforming opaque embeddings into an interpretable polar space defined entirely by explicit semantic differentials, making internal representations human-readable.

[^9]: Wolfe, R., et al. (2022). ["ML-EAT: A Multilevel Embedding Association Test."](https://arxiv.org/abs/2408.01966v2) Extended WEAT/SEAT methodologies to a multilingual context, testing how conceptual axes map across different linguistic and cultural embedding spaces.

[^10]: Grand, G., et al. (2022). ["Semantic Projection Recovers Rich Human Knowledge of Multiple Object Features from Word Embeddings."](https://arxiv.org/abs/1802.01241) Provided rigorous empirical validation that projecting words onto linear axes in embedding space accurately reflects human semantic understanding.

[^11]: Zou, A., et al. (2023). ["Representation Engineering: A Top-Down Approach to AI Transparency."](https://arxiv.org/abs/2310.01405) Introduced a method for finding linear concept directions in LLM hidden states, evolving semantic axes from passive observational tools into active mechanisms for steering generative AI behavior.
