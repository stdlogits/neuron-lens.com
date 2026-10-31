# Neuron Lens

> {{description}}

Neuron Lens (https://neuron-lens.com) is the explorer of neuron-lens, a public catalog of every MLP neuron and attention head in two open-weight language models. It was made by a9lim (https://a9l.im) and treetown (https://logits.ml) with Claude; Claude Haiku 5.5 wrote its labels and translations. Each unit is read three ways: from its weights alone, through two Jacobian lenses; from what it does on 15 million tokens of real text; and from the exact tokens that drive it. Gemma 4 12B also takes images and sound, so its neurons are read through 49,694 images and 46,932 sounds too.

{{models}}

**Neurons and heads.** Each layer of a transformer reads the residual stream (one vector per token) and adds to it, in two steps. Attention heads move information between tokens: a head's QK circuit decides where it looks, its OV circuit what it copies from there. MLP neurons rework one position at a time: a neuron measures how hard the stream points along the direction it reads (its activation), then adds a fixed vector, its write, scaled by that. In both models' gated MLPs the activation can be positive or negative, so every neuron has two poles, + and −, which can mean different things. A pole has an input side (what makes it fire) and a write side (what its write does to the model's predictions).

**The lenses.** A lens reads a vector inside the model as a ranking over tokens, from the weights alone. The R-lens (camilablank et al., 2026) is the J-lens of Gurnee et al. (2026) taken under RelP's propagation rules: it averages the Jacobian from a layer to the final residual and reads through the unembedding, so it says what a vector makes the model say later. The S-lens, introduced by this project, is Theia Vogel's K-lens under the same rules: it takes the Jacobian back to the input embeddings, so it says which input tokens put a direction there. In the explorer's notation, in·S and in·R read a neuron's input direction; out·R reads what its write makes the model say and out·S which tokens' footprints the write imitates; OV·S and OV·R read what a head copies. Lens reads describe directions, not effect sizes.

**Evidence from running the model.** Activations over 15M positions of web, Chinese, Python and chat text give each unit's firing rate, strength and top contexts. Exact drivers come from substituting every common token at one position of 8 real documents and measuring which ones make the unit fire. For Gemma 4 12B, each neuron also has the images and sounds that fire it, its read direction drawn as a patch of pixels or 40 ms of sound, and a pattern optimised to drive it.

**Labels.** Claude Haiku 5.5 labelled every neuron pole (what it fires on, what it writes) and every head (where it fires, what it attends to, what it writes), each label with a confidence. Checked blind, against another unit's label or chance:

{{checks}}

**Which reads to trust at which depth.** No single read works at every depth. Early layers read best from their input side, late layers from their write side, and the middle is hard from both: most mid-network units respond to context built up over many words, and their real-text examples are the best evidence there.

{{depth}}

**Findings, in brief.** From the research README, which has each result's setup, controls and limits:

- A write's R-lens read predicts what steering the neuron does. In Qwen3-8B the median correlation is 0.46–0.51 at L4–L8, 0.64–0.74 at L12–L16 and 0.9 or more from L22, against ±0.04 for another neuron's read. But steering is not what a neuron does when it fires: before about L21, the same pole firing equally hard pushes the predictions different ways in different contexts.
- Early neurons detect tokens and token families, which the S-lens recovers from the weights, and write back the tokens they detect: layers 0–8 act as an extended embedding. Late neurons fire just before a word their write promotes, most at L28–L31; from L32 many suppress it instead.
- 57% of Qwen3-8B's poles are dark: they fire, but no token-level test of a weight-only read passes at their own top firings (82% at L13–L20). Explainers given full evidence still describe them almost as well as legible ones.
- Three L6 neurons create the attention sink on the first token by writing onto one of two dimensions the final norm all but ignores; L35 n9510 + raises the output's entropy on hashes and IDs.
- Gemma 4 12B, from another lab with another activation, norm layout and attention scheme, reads the same way. Many of its neurons mean one thing whatever the input: at L12–L23, 42% of the poles with a reliable image label also fire on the label's name in text.

**Addresses.** Every view of the explorer is a path:

- `/qwen3-8b`, `/gemma-4-12b`: a model's atlas of layers (`/` is Qwen3-8B)
- `/qwen3-8b/L8`: a layer's neurons, easiest to read first (`?all` lists every neuron of the layer)
- `/qwen3-8b/L8/n344`: one neuron, here layer 8, neuron 344 of Qwen3-8B, which fires on "owl" and writes toward owls and night
- `/gemma-4-12b/heads`, `/gemma-4-12b/L35/heads`: a model's or a layer's attention heads
- `/gemma-4-12b/L35/h14`: one head, here layer 35, head 14 of Gemma 4 12B, an induction head
- `/about`, `/credits`

The explorer draws each view in the browser, and this site serves no unit's data as text. To look up a unit, use the catalog on Hugging Face: its tables have a row for every pole and head, by model and layer.

## Research and data

- [neuron-lens README](https://raw.githubusercontent.com/stdlogits/neuron-lens/main/README.md): the background, the lenses, the catalog and the findings
- [Findings](https://raw.githubusercontent.com/stdlogits/neuron-lens/main/docs/findings.md): every result with its setup, controls and limits
- [Methods](https://raw.githubusercontent.com/stdlogits/neuron-lens/main/docs/design.md): how the lenses, reads, tests and labels are made
- [The catalog](https://huggingface.co/datasets/stdlogits/neuron-lens): Parquet tables for every pole and head (reads, acts, drivers, legible, labels; image, audio and media for Gemma 4 12B), CC BY 4.0; its dataset card documents every column
- [The lenses](https://huggingface.co/stdlogits/rs-lenses): the R-lens and S-lens for both models, CC BY 4.0

## The site

- [About](https://neuron-lens.com/about): what the explorer shows and how far to trust it, through real units
- [Credits](https://neuron-lens.com/credits): the people, models, collections and licences
- [Source](https://github.com/stdlogits/neuron-lens.com): this site, AGPL-3.0

## Optional

- [Qwen3-8B](https://huggingface.co/Qwen/Qwen3-8B) and [Gemma 4 12B](https://huggingface.co/google/gemma-4-12B): the models, both Apache 2.0
- [Drowse](https://drowse.ai): an interpretability workbench for activation steering and trait monitoring, in the browser
