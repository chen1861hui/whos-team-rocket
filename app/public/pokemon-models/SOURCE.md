# Arena model assets

## Current model set

The arena model directory contains 137 self-contained GLBs. The supplied `XY-PokeModels.7z` and `XYORAS-PokeTexPNG*.zip` archives provide most of the meshes and textures. The export reads skeletal weights with [Nintendo 3DS Asset Importer](https://github.com/sxrmss/n3ds_importer/tree/a68959eae2f476526845a78af6990648cfe3434d). Texture bindings preserve the BCH material's affine UV transform and wrap mode as decoded by [SPICA](https://github.com/gdkchan/SPICA/tree/82acbd63695e4ef8b95a92ce884f25ec1044788f), with the vertical coordinate converted to glTF's image origin. The web materials approximate the original environment reflections and particle layers. Original idle, faint and attack clips are retargeted to the X/Y skeletons. Forms without a matched clip use the arena's procedural motion.

The revised geometry export decodes per-submesh bone palettes and fixed vertex attributes with SPICA. The mouth meshes on Eevee and Pikachu follow their head bones. Treecko's pupil textures combine the source iris and eyelid opacity masks. Gastly retains its X/Y body and uses the earlier arena's two translucent mist layers, aligned to the body and attached to its dominant joint.

Version 16 restores source iris and eye aperture textures for the reported eye materials. Individual meshes keep the neutral iris coverage when the exported eyelid frame overlaps too little of the pupil. The edge of Squirtle's eye panel and Snorlax's mouth panel follows adjacent head normals. Pidgeot's wing surfaces, Sandslash's hand surfaces, Kadabra's upper ears and Jynx's skirt panels are visible from both sides. Grimer and Muk map their texture masks to translucency around the purple body. The Charmander line and Moltres use tinted flame coverage from the X/Y stencil maps on the original skinned meshes. Koffing and Weezing display the earlier Koffing gas plume fitted and attached to each X/Y torso.

Version 17 smooths 14 wing joint tracks in Moltres's battle idle, with a short delay toward the tips. Both skinned wings have subtle animated flame edges. Its event motion also recognizes the X/Y arm joints. Gastly's two existing mist meshes now deform independently while attached to the torso. They loop in idle, swell during its special clip, and settle during the faint clip.

Version 18 composites Mr. Mime's original X/Y pupil and eyelid masks into the eye surface texture to avoid a separate overlapping pupil mesh. Snorlax's mouth uses the neutral X/Y color map. Its head, mouth and adjacent neck normals are matched by source vertex position against the earlier Let's Go export. The two X/Y skeletons and their animation tracks are retained.

Version 19 keeps Gengar's X/Y geometry and bone weights. The long-tongue mesh is hidden in the battle form, while the normal mouth remains on its original rig. The supplied X/Y archive stores Gengar's model and shadow in its two BCH entries. The supplied Let's Go motion archive provides `ba10_waitA01`, `ba10_waitB01`, `ba20_buturi01` and `ba21_tokusyu01`. The two wait clips share a blended loop. Physical and special clips are retargeted across 43 matching joints. Gastly's torso anchor drives a continuous ray-marched cloud in the arena. Moltres retains its four existing fire meshes with soft view-dependent opacity and no separate flame shadow.

Version 23 restores Gengar's authored mouth rendering. The Body_MASK material produces zero alpha in its source combiner. The texture from the original interior and tongue surface is visible after excluding that mask and the supplementary long tongue overlay. Moltres uses the four authored stencil groups. Its flame color is baked from the X/Y texture channels, UV transforms and material colors. The supplied wing mask texture stores a blank frame, so the matching source meshes supply wing coverage in the web renderer.

The original roster's visual mapping in `forms.json` also contains later evolutions and pre-evolutions. Levels refer to the existing card levels. The arena provides procedural motion where an authored clip is unavailable.

Regular Ursaluna (`901.glb`) uses `pm1007_00_00` from the supplied `LA-Poke.zip` and `LA-PokeAnim.zip` archives. Its embedded base-color maps bake the imported layer-mask and palette shader before lighting. The four clips are `idle`, `physical`, `special` and `faint`. Eevee's clips come from Let's Go. Umbreon, Togepi, Teddiursa and Ursaring use clips retargeted from Legends: Arceus.

Pokémon characters and associated assets belong to their respective owners.

## Earlier asset sources

The 81 GLB files cover the Pokémon forms in the current selection roster. The mapping is in forms.json, ordered by gameplay level. A repeated number means that the level keeps the same Pokémon form.

Most meshes and textures come from the regular forms in [Pokémon 3D API assets](https://github.com/Pokemon-3D-api/assets/tree/429de1288cea0d43f5b4f56305d2276e94239d65/models/opt/regular). The local copies use standard glTF geometry so the game can load them without a separate decoder. The arena animates recall, release and evolution in Three.js. Charmander, Charmeleon, Charizard, Pikachu, Weezing, Dratini and Dragonite use the meshes and idle animations from the [06wj Pokémon viewer](https://github.com/06wj/pokemon/tree/00d96f7f18894055e7f1db44fa0df6462e5e4c8a/public/models). Their textures were resized and converted to WebP.

Pokémon characters and associated assets belong to their respective owners.

Eight additional GLBs are loaded only for event Pokémon: Jigglypuff, Farfetch’d, Mr. Mime, Articuno, Zapdos, Moltres, Mewtwo and Mew. They use the same Pokémon 3D API regular-form source. Mewtwo retains its battle idle clip. The game animates the other event models in the arena.

Growlithe (`58.glb`, `pm0058_00`) and Snorlax (`143.glb`, `pm0143_00`) use the matching Let's Go meshes, textures and `ba10_waitA01` battle idle from the local `LGPE-Poke.zip` and `LGPE-PokeAnim.zip` archives. The clips are named `idle` in the exported GLBs. The conversion uses the [GFBMDL/GFBANM Blender importer](https://github.com/ChicoEevee/Pokemon-Switch-Model-Importer-Blender/tree/bb597581916c7407385afb5461efe4d2ae2f38f9) and [BNTX Extractor](https://github.com/aboood40091/BNTX-Extractor/tree/2c08e8e55fcc666ba6568a102f36dabd6c584e25). The body textures bake the game's horizontal mirroring into the atlas. Facial UVs map to the resting eye and mouth tiles, with Growlithe's iris baked into the eye texture.

The same archives supply the battle idle for 77 more forms. Most use their existing meshes and materials with the corresponding Let's Go skin or retargeted bone tracks. Beedrill, Pidgey, Clefairy, Magnemite, Magneton, Haunter, Exeggutor, Tauros and Lapras use the matching Let's Go meshes and color maps. Gastly and Koffing use the original torso motion on their existing models to retain their visual effects. Moltres uses retargeted bone rotations to keep its existing flame mesh. Models whose idle loop dips into the podium carry an `idleGroundTime` in the GLB scene metadata, giving the arena the time in seconds of the loop's lowest pose. Grimer and Muk still use the arena's procedural idle because their original slime materials and deformation need a separate conversion.

The archives also supply `ba41_down01` for 86 forms, exported as the `faint` clip alongside any existing idle. The clip uses the matching skeleton where possible. Models with different rigs use retargeted joint motion, with Gastly and Koffing using the original torso motion. Kakuna, Magikarp, and Porygon use the arena's fallback faint pose.

Raichu (`26.glb`, `pm0026_00`) uses the matching Let's Go body and tail meshes, native skin weights, and idle and faint clips.

Weedle (`13.glb`, `pm0013_00`) uses the matching Let's Go meshes, textures, native skin weights, and idle and faint clips.

Farfetch’d (`83.glb`, `pm0083_00`) uses the matching Let's Go meshes, eye and body textures, native skin weights, and idle and faint clips.

Charmander, Squirtle, Staryu and Lapras also include the Let's Go `ba21_tokusyu01` special attack as `special`. Squirtle, Staryu and Lapras use the original skeleton tracks. Charmander uses joint rotations retargeted to the arena model.

Bulbasaur, Pikachu, Clefairy, Abra and Dratini also include `ba21_tokusyu01`. Pidgey, Machop, Cubone, Scyther, Tauros, Aerodactyl and Snorlax include the Let's Go `ba20_buturi01` physical attack as `physical`. Bulbasaur, Pikachu and Dratini use retargeted motion. The other forms use the original skeleton tracks.

## Kanto & Johto Tour

The game reads the form IDs by level from `app/public/expansion-content.js`. Each file below is included in the model catalogue when present, and portraits cover individual forms with missing assets.

| Group | GLB filenames in level order |
| --- | --- |
| Eevee | `133.glb`, `197.glb`, `197.glb` |
| Togepi | `175.glb`, `176.glb`, `468.glb` |
| Mareep | `179.glb`, `180.glb`, `181.glb` |
| Treecko | `252.glb`, `253.glb`, `254.glb` |
| Totodile | `158.glb`, `159.glb`, `160.glb` |
| Teddiursa | `216.glb`, `217.glb`, `901.glb` |

The arena supports optional clips named `idle`, `faint`, `special`, and `physical`.


## Hoenn Weather Research

Castform's normal (`351.glb`), sunny (`351-sun.glb`) and rainy (`351-rain.glb`) forms use the local X/Y models `462_-_Castform.bin`, `463_-_Castform_Sunny.bin` and `464_-_Castform_Rainy.bin`. The matching texture sheets are `pm0351_11`, `pm0351_12` and `pm0351_13` from `XYORAS-PokeTexPNG3rd.zip`. Each GLB imports the original rig, skin weights and materials. The second BCH section contains press shadows. The browser adds battle hover and pose animation. The portrait images are renders of the same models.

The sunny and rainy exports leave out the opaque copies of the optical shells that would cover the source eye and mouth surfaces in the web renderer. The sunny form approximates the original golden corona with a vertex-alpha rim and an orange-red inner face. The rainy form retains the original blue face and light-blue water shell.


Snowy Castform (`351-hail.glb`) uses `465_-_Castform_Snowy.bin` from the same X/Y model archive and the matching `pm0351_14` images from `XYORAS-PokeTexPNG3rd.zip`. The browser drives the same hover and battle pose system as the other forms. The cloudy halo and violet face were checked against the [official form and game artwork](https://www.pokemon.jp/special/forme/zukan02/zukan2-15.html).


## Ralts evolution line

The models for Ralts (`280.glb`), Kirlia (`281.glb`) and Gardevoir (`282.glb`) use the local X/Y meshes and skins (entries 377–379), with the matching `pm0280_00`, `pm0281_00` and `pm0282_00` texture sheets. Idle, faint, physical and special clips were retargeted from the corresponding local Legends: Arceus skeletons. The skirt bones match the corresponding cloth chains across games; Gardevoir's offsets were reduced to preserve the X/Y silhouette. The portraits render those same models.


## Absol

Absol (`359.glb`) uses `474_-_Absol.bin` from the local X/Y mesh archive and the `pm0359_00` textures from `XYORAS-PokeTexPNG3rd.zip`. The export retains the skin weights and source skeleton. The browser poses the rig for idle, attack, hit, dodge and faint. All three levels use this same form, and the portrait renders the same GLB.


## Wynaut and Wobbuffet

Wynaut (`360.glb`) and Wobbuffet (`202.glb`) use the supplied X/Y BCH geometry and bones from `476_-_Wynaut.bin` and `274_-_Wobbuffet.bin`. The color textures are the matching `pm0360_00` and `pm0202_00` PNG sheets. The arena drives the skeletons at runtime for idle and battle poses. Wobbuffet's arm rest angles are lowered from the source bind pose. The portraits are renders of the same GLBs.


## Nincada, Ninjask and Shedinja

The three models (`290.glb`, `291.glb`, `292.glb`) use the supplied X/Y BCH geometry, skins and PNG textures. Ninjask draws the open wing meshes from the original model and the browser articulates its four wing bones. Nincada uses the quadruped rig, while Shedinja hovers and uses the waist and feeler bones to react. The portraits render the same GLBs.


## Zorua and Zoroark

Zorua (`570.glb`) and Zoroark (`571.glb`) use the supplied X/Y BCH geometry and skeletons from `760_-_Zorua.bin` and `761_-_Zoroark.bin`. The matching `pm0570_00` and `pm0571_00` PNG textures come from `XYORAS-PokeTexPNG5th.zip`. The arena animates the source rigs at runtime for idle and battle poses. The portraits render the same GLBs.


## Mimikyu

`778.glb` and `778-busted.glb` both use the first battle mesh and the 91-bone rig in the supplied Sun/Moon `SuMo-PokeModels.zip` entries `1 (Model)/1128 - Mimikyu.bin` and `1 (Model)/DUMMY/1129 - Mimikyu (Busted).bin`. The two model entries share their geometry. The `pm0819_11_Body1.tga` colour sheet comes from `SuMo-PokeTex7th.zip`. Normal and Busted motions bind separately from the matching 1128 and 1129 fight entries of `SuMo-PokeAnim.zip`. The exported costume UVs retain mirrored U sampling and account for the source image origin. The arena uses its own move particles. Both portraits render their matching GLBs.


### Red Gyarados for Lake of Rage

The scenario-only 130-red.glb derives from the existing 130.glb. Two body textures shift the blue body areas to red while preserving opacity, highlights, eyes and other colors. The base model keeps its own textures. Meshes, skeleton, rig weights, and animation clips are shared in structure with the existing model. The raid uses the same battle-motion mapping as Gyarados.

## Wing, eye and hand repairs

- Pidgey keeps its Let's Go folded wing meshes for the poses in which its open wing bones are scaled down. Its faint clip reduces the folded meshes as the open wings extend. Pidgeotto and Pidgeot use the skinned open wings during their flying loops, with the overlapping folded feather meshes removed. The visible wing surfaces render from both sides.
- Grimer's main eye layer uses the colour and coverage decoded from the supplied X/Y BCH texture entry. The duplicate X/Y eye reflection pass is excluded from the arena material. The rig and its eye mesh remain attached to the original bones.
- Elekid retains the X/Y mesh, textures and rig. Its original battle animations are listed below.
- The Chase and Elaine trainer GLBs use the original neutral iris layers composited into the Let's Go eye atlases. Both eye meshes, all skin weights and the four existing trainer animations are preserved for each avatar.

## Arm rigs and battle reactions

Pichu (172), Scizor (212), Smoochum (238), Elekid (239), Blissey (242), Happiny (440), Munchlax (446), Rhyperior (464) and Electivire (466) retain the X/Y-era geometry and textures. The matching skeletons and battle slots 0, 5, 8, 16 and 17 from the supplied `SuMo-PokeModels.zip` and `SuMo-PokeAnim.zip` provide idle, physical attack, special attack, hit and faint animations. The arena keeps its positional dodge and uses the native idle posture for the limbs during it.

The corresponding Sun/Moon meshes supply corrected joint indices and weights for Scizor's pincer mesh `BodyBSpc00`, Rhyperior's forearm mesh `BodyB01` and Electivire's tail mesh `BodyInc`. The remap uses matching vertex positions and bone names. These updates affect model rendering only.

## Battle motion audit

The supplied Sun/Moon battle models and animations provide matching rigs for Totodile, Croconaw, Feraligatr, Cleffa, Togetic, Mareep, Flaaffy, Ampharos, Wobbuffet, Porygon2, Treecko, Grovyle, Sceptile, Nincada, Ninjask, Shedinja, Absol, Wynaut, Magnezone, Togekiss, Porygon-Z, Zorua and Zoroark. All 23 use battle slots 0, 16 and 17 for idle, hit and faint. Physical and special attacks use slots 5 and 8 where those slots have a skeletal clip. Longer attack displacements are scaled to fit the arena. The arena layers the positional dodge over the authored resting posture.

The source weighting corrects Togetic's wing layer, Porygon2's foot and tail layers and Porygon-Z's arm layer. Ampharos and Magnezone use their existing geometry and weights, verified under the new clips.
