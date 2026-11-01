# Neuron Lens

> {{description}}

Neuron Lens (https://neuron-lens.com) is the explorer of neuron-lens, a public catalog of every MLP neuron and attention head in two open-weight models, by a9lim (https://a9l.im) and treetown (https://logits.ml) with Claude. Its premise is the one argued in Nick Cammarata's "Neural Networks Are Already Clean" (Goodfire, 2026, https://already-clean.goodfire.com/): a model's own neurons are legible units, and apparent polysemanticity mostly comes from ordinary, fixable causes (weak tools, poor architectures, neurons that generalize in a few related directions) rather than superposition, so neurons can be studied directly rather than through a learned decomposition. neuron-lens adds evidence that needs no forward pass: two Jacobian lenses read each neuron's input and output directions from the weights alone, and those reads agree with what steering the neuron does and with what it fires on.

{{models}}

## Method

**Units.** Both models have gated MLPs (SwiGLU in Qwen3-8B; Gemma 4 12B gates with GELU in place of SiLU), so a neuron's activation can be positive or negative. The catalog treats each sign as its own unit, a pole (+ or −), with an input side (what drives it) and a write side (what its output vector does), since the two often mean different things, and, as Cammarata also finds, the negative side matters about as much as the positive. Poles are split by the activation's sign, not by regime: a + pole's firings can mix gate and value both positive with both negative (the double-negative regime Cammarata describes). Heads are read through their QK circuit (where they look) and OV circuit (what they copy).

**Lenses.** The R-lens (camilablank et al., 2026) is the J-lens of Gurnee et al. (2026) under RelP's propagation rules: an averaged Jacobian from a layer to the final residual, read through the unembedding, so it says what a vector makes the model say. The S-lens, introduced by this project, is Theia Vogel's K-lens under the same rules, taken back to the input embeddings, so it says which input tokens put a direction there. Each pole gets eight reads: its input direction and its write, each through both lenses, raw and scored against the layer's other poles (z). Heads get token-by-token OV and QK maps built from S-lens footprints. Lens reads give directions, not effect sizes.

**Running the model.** Activations over 15M positions of web, Chinese, Python and chat text give each unit's rate, strength and top firings. Exact drivers come from substituting every common token at one position of 8 real documents. Steering adds a pole's write at 1× and 4× its typical activation to 48 positions of 16 web documents and records the change in next-token log-probabilities. Gemma 4 12B is also run on 49,694 labelled images and 46,932 labelled sounds.

**Tests.** Each pole's reads are tested at its own 24 top firings against mismatched pairs (another pole of the layer and sign), at a 5% false discovery rate per layer. A pole that fires but passes no token-level test is called dark.

**Labels.** Claude Haiku 5.5 labelled every pole (what it fires on, what it writes) and head (what it fires on, attends to, writes) with a confidence, from a card holding the reads that carry signal at that depth and the top firings. The explorer shows each label above all the evidence it was written from, so a reader can judge it.

## Results

Qwen3-8B unless stated; numbers are medians over a layer's poles. The research README and findings have setup, controls and limits for each.

**The write's lens read predicts steering.** Correlating a pole's R-lens read of its write with the change steering it causes gives a median r of 0.46–0.51 at L4–L8, 0.64–0.74 at L12–L16 and 0.9 or more from L22, against ±0.04 for another pole's read. From L5, 92–100% of random poles have a specific steering effect that their own read predicts (mismatched pairs: 0–5%). The R-lens leads the J-lens by 0.03–0.12 from L4 to L23; the logit lens trails until about L20 (L8: 0.51 against 0.12). In Gemma 4 12B the R-lens predicts steering from L11: 0.53 at L12–L23, 0.82 at L24–L35, 0.97 at L36–L47. Write labels written from the lens reads alone, without seeing steering, are picked out of four by a judge reading steered text 95% of the time at L28–L35 (chance 25%).

**But steering is not what a firing does.** Before about L21, the same pole firing equally hard pushes the predictions different ways in different documents (one firing against its other firings: r 0.05–0.11; from L28: 0.78). Lens and steering agree because both average over contexts. A write read says what a mid-network neuron's direction means, not what one firing does in its context.

**The input side's lens read agrees with what the neuron fires on.** Early neurons detect tokens and token families (阔 "wide"; words starting with 出; English given names), and the S-lens recovers them: at L0 the peak token of 40% of a pole's top firings is in its S-lens top 10 (another pole's read: 0.1%), and the read holds at the pole's own top firings for 78% of L0's poles and 35–58% at L1, L3 and L4. Layers 0–8 act as an extended embedding: these neurons also write back the tokens they detect. L8 is the crossover, where a pole's input and write reads share the most tokens; from L9 the R-lens read of the input names exact drivers instead (5–8% of its top 10, against 0.3% for controls). L13–L20 is the weakest stretch for every weight-only input read, and there the firings are the evidence. In Gemma 4 12B the input side reads through L13, about the same relative depth.

**How many neurons mean one thing.** neuron-lens has not run a direct count like Cammarata's (who estimates that about 90% of Qwen3-32B's poles have one main job, about 7% two related jobs and 2–4% are not yet understood), so it gives no share of its own. What it has measured points the same way: nearly every pole's write has a specific steering effect that its own read names; in a pilot that described random poles from full evidence, most were token- or phrase-level detectors; and in Gemma 4 12B many poles hold one concept across text, images and sound (below).

**Dark is not polysemantic.** 38% of Qwen3-8B's poles pass some token-level test, 5% are silent, and 57% are dark (82% at L13–L20; Gemma 4 12B: 52%). Dark poles are still describable: explainers given their full evidence describe them nearly as well as legible ones. Most look like concept detectors whose firings vary in surface form, which token-level tests miss. This fits two motifs from Cammarata's essay: context neurons that fire on punctuation where the model summarizes what came before, and long-context neurons that look incoherent in short windows. The catalog's activations come from documents of up to 256 tokens, so some dark poles may be the latter.

**Prediction and suppression are two signs of one neuron.** Late poles fire on the token before a word their write promotes ("is⟦ once⟧" → *again*); prediction peaks at L28–L31, where 7–8% of poles have more than a third of their top firings followed by a promoted token (control under 0.1%). Suppression starts at L32 and overtakes prediction at L35, the role Cammarata's essay gives the last layer. In SwiGLU the two kinds sit on one neuron's two poles.

**One concept in text, images and sound.** At L12–L23 of Gemma 4 12B, 42% of the poles with a reliable image label also fire on the label's name in text (5% by chance). 4,378 poles pass every text test for their image label (its name fires them, the text S-lens reads it, the text R-lens writes it), and 708 for their audio label; 18 pass all for both, against 1.8 expected (L14 n8313 +: mosques, Arabic speech, Arabic names; L37 n7165 +: giant pandas, Mandarin speech, 熊猫).

**Heads.** A head's OV map, built from the weights, predicts where the attended token ranks in the head's actual output at each firing (Spearman +0.54; another head's map: 0.00), and its QK map finds the duplicate-token heads (AUROC 0.96). Heads are dark mid-network as neurons are: 74–78% of L9–L20's heads pass no test. Qwen3-8B has 33 induction heads and 33 duplicate-token heads, and removing any one costs in-context copying at most 0.07 nats.

**Sinks and temperature.** Three Qwen3-8B L6 neurons create the attention sink on the first token by writing onto one of two dimensions the final norm all but ignores, and L35 n9510 + raises the output's entropy on hashes and IDs through that norm.

**Which reads to trust where:**

{{depth}}

## Addresses

Every view of the explorer is a path:

- `/qwen3-8b`, `/gemma-4-12b`: a model's atlas of layers (`/` is Qwen3-8B)
- `/qwen3-8b/L8`: a layer's neurons, easiest to read first (`?all` lists every neuron of the layer)
- `/qwen3-8b/L8/n344`: one neuron, here layer 8, neuron 344 of Qwen3-8B, which fires on "owl" and writes toward owls and night
- `/gemma-4-12b/heads`, `/gemma-4-12b/L27/heads`: a model's or a layer's attention heads
- `/gemma-4-12b/L27/h4`: one head, here layer 27, head 4 of Gemma 4 12B, which at a word for a group ("both", "respectively") looks back at the members just named
- `/about`, `/credits`

The explorer draws each view in the browser, and this site serves no unit's data as text. To look up a unit, use the catalog on Hugging Face: its tables have a row for every pole and head, by model and layer.

## Research and data

- [neuron-lens README](https://raw.githubusercontent.com/stdlogits/neuron-lens/main/README.md): the lenses, the catalog and the findings
- [Findings](https://raw.githubusercontent.com/stdlogits/neuron-lens/main/docs/findings.md): every result with its setup, controls and limits
- [Methods](https://raw.githubusercontent.com/stdlogits/neuron-lens/main/docs/design.md): how the lenses, reads, tests and labels are made
- [The catalog](https://huggingface.co/datasets/stdlogits/neuron-lens): Parquet tables for every pole and head (reads, acts, drivers, legible, labels; image, audio and media for Gemma 4 12B), CC BY 4.0; its dataset card documents every column
- [The lenses](https://huggingface.co/stdlogits/rs-lenses): the R-lens and S-lens for both models, CC BY 4.0
- [Neural Networks Are Already Clean](https://already-clean.goodfire.com/): Cammarata (Goodfire, 2026), the case for studying a model's own neurons

## The site

- [About](https://neuron-lens.com/about): a walk through what the explorer shows, for readers new to interpretability
- [Credits](https://neuron-lens.com/credits): the people, models, collections and licences
- [Source](https://github.com/stdlogits/neuron-lens.com): this site, AGPL-3.0

## Optional

- [Qwen3-8B](https://huggingface.co/Qwen/Qwen3-8B) and [Gemma 4 12B](https://huggingface.co/google/gemma-4-12B): the models, both Apache 2.0
- [Drowse](https://drowse.ai): an interpretability workbench for activation steering and trait monitoring, in the browser
