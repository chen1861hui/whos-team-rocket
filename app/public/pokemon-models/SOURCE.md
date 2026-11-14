# Arena model assets

The 81 GLB files cover the Pokémon forms in the current selection roster. The mapping is in forms.json, ordered by gameplay level. A repeated number means that the level keeps the same Pokémon form.

Most meshes and textures come from the regular forms in [Pokémon 3D API assets](https://github.com/Pokemon-3D-api/assets/tree/429de1288cea0d43f5b4f56305d2276e94239d65/models/opt/regular). The local copies use standard glTF geometry so the game can load them without a separate decoder. The arena animates recall, release and evolution in Three.js. Charmander, Charmeleon, Charizard, Pikachu, Weezing, Dratini and Dragonite use the meshes and idle animations from the [06wj Pokémon viewer](https://github.com/06wj/pokemon/tree/00d96f7f18894055e7f1db44fa0df6462e5e4c8a/public/models). Their textures were resized and converted to WebP.

Pokémon characters and associated assets belong to their respective owners.

Eight additional GLBs are loaded only for event Pokémon: Jigglypuff, Farfetch’d, Mr. Mime, Articuno, Zapdos, Moltres, Mewtwo and Mew. They use the same Pokémon 3D API regular-form source. Mewtwo retains its battle idle clip. The game animates the other event models in the arena.

Growlithe (`58.glb`, `pm0058_00`) and Snorlax (`143.glb`, `pm0143_00`) use the matching Let's Go meshes, textures and `ba10_waitA01` battle idle from the local `LGPE-Poke.zip` and `LGPE-PokeAnim.zip` archives. The clips are named `idle` in the exported GLBs. The conversion uses the [GFBMDL/GFBANM Blender importer](https://github.com/ChicoEevee/Pokemon-Switch-Model-Importer-Blender/tree/bb597581916c7407385afb5461efe4d2ae2f38f9) and [BNTX Extractor](https://github.com/aboood40091/BNTX-Extractor/tree/2c08e8e55fcc666ba6568a102f36dabd6c584e25). The body textures bake the game's horizontal mirroring into the atlas. Facial UVs map to the resting eye and mouth tiles, with Growlithe's iris baked into the eye texture.

The same archives supply the battle idle for 77 more forms. Most use their existing meshes and materials with the corresponding Let's Go skin or retargeted bone tracks. Beedrill, Pidgey, Clefairy, Magnemite, Magneton, Haunter, Exeggutor, Tauros and Lapras use the matching Let's Go meshes and color maps. Gastly and Koffing use the original torso motion on their existing models to retain their visual effects. Moltres uses retargeted bone rotations to keep its existing flame mesh. Models whose idle loop dips into the podium carry an `idleGroundTime` in the GLB scene metadata, giving the arena the time in seconds of the loop's lowest pose. Grimer and Muk still use the arena's procedural idle because their original slime materials and deformation need a separate conversion.

The archives also supply `ba41_down01` for 86 forms, exported as the `faint` clip alongside any existing idle. The clip uses the matching skeleton where possible. Models with different rigs use retargeted joint motion, with Gastly and Koffing using the original torso motion. Kakuna, Magikarp, and Porygon use the arena's fallback faint pose.

Raichu (`26.glb`, `pm0026_00`) uses the matching Let's Go body and tail meshes, native skin weights, and idle and faint clips.

Charmander, Squirtle, Staryu and Lapras also include the Let's Go `ba21_tokusyu01` special attack as `special`. Squirtle, Staryu and Lapras use the original skeleton tracks. Charmander uses joint rotations retargeted to the arena model.

Bulbasaur, Pikachu, Clefairy, Abra and Dratini also include `ba21_tokusyu01`. Pidgey, Machop, Cubone, Scyther, Tauros, Aerodactyl and Snorlax include the Let's Go `ba20_buturi01` physical attack as `physical`. Bulbasaur, Pikachu and Dratini use retargeted motion. The other forms use the original skeleton tracks.
