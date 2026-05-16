import Animal3D from "./Animal3D.jsx";

const animals = ["fox", "rabbit", "bear", "cat", "dog", "panda"];
const skins = ["honey", "ivory", "mint", "berry", "sky", "cocoa", "slate"];
const outfits = ["none", "hoodie", "jacket", "overalls", "kimono", "explorer"];
const hats = ["none", "hat", "beanie", "crown"];
const glasses = ["none", "round", "star"];
const shoes = ["none", "sneakers", "boots", "sandals"];
const accessories = ["none", "scarf", "satchel", "heart"];
const patterns = ["none", "blush", "spots"];
const furStyles = ["soft", "spiky", "tufted"];
const emotes = ["wave", "heart", "nod"];
const animations = ["idle", "dance"];

export default function CharacterView({ emotion, character, setCharacter }) {
  const rotation = character.rotation ?? 0;

  function patchCharacter(key, value) {
    setCharacter((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="page-grid">
      <section className="character-studio">
        <div className="studio-stage">
          <Animal3D emotion={emotion} {...character} rotation={rotation} interactive />
          <input
            aria-label="Rotate character"
            className="rotation-slider"
            type="range"
            min="-90"
            max="90"
            value={rotation}
            onChange={(event) => patchCharacter("rotation", Number(event.target.value))}
          />
        </div>
        <div className="studio-panel">
          <p className="eyebrow">Character</p>
          <h1>Animal companion studio</h1>
          <p>Turn the character 180 degrees, change species, fur, clothing, hats, glasses, shoes, accessories, emotes, and idle style.</p>
          <div className="studio-stat">
            <span>Preview angle</span>
            <strong>{rotation + 90} / 180</strong>
          </div>
        </div>
      </section>

      <section className="wide-panel">
        <h2>Animal</h2>
        <div className="choice-row">
          {animals.map((animal) => (
            <button
              key={animal}
              className={character.animal === animal ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("animal", animal)}
            >
              {animal}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Skin</h2>
        <div className="choice-row">
          {skins.map((color) => (
            <button
              key={color}
              className={(character.skin || character.color) === color ? "swatch active" : "swatch"}
              style={{ "--swatch": `var(--skin-${color})` }}
              type="button"
              onClick={() => patchCharacter("skin", color)}
            >
              {color}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Clothes</h2>
        <div className="choice-row">
          {outfits.map((outfit) => (
            <button
              key={outfit}
              className={character.outfit === outfit ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("outfit", outfit)}
            >
              {outfit}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Accessory</h2>
        <div className="choice-row">
          {accessories.map((accessory) => (
            <button
              key={accessory}
              className={character.accessory === accessory ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("accessory", accessory)}
            >
              {accessory}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Hats</h2>
        <div className="choice-row">
          {hats.map((hat) => (
            <button
              key={hat}
              className={character.hat === hat ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("hat", hat)}
            >
              {hat}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Glasses</h2>
        <div className="choice-row">
          {glasses.map((item) => (
            <button
              key={item}
              className={character.glasses === item ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("glasses", item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Shoes</h2>
        <div className="choice-row">
          {shoes.map((item) => (
            <button
              key={item}
              className={character.shoes === item ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("shoes", item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Markings</h2>
        <div className="choice-row">
          {patterns.map((pattern) => (
            <button
              key={pattern}
              className={character.pattern === pattern ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("pattern", pattern)}
            >
              {pattern}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Fur Style</h2>
        <div className="choice-row">
          {furStyles.map((style) => (
            <button
              key={style}
              className={character.furStyle === style ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("furStyle", style)}
            >
              {style}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Emotes</h2>
        <div className="choice-row">
          {emotes.map((emote) => (
            <button
              key={emote}
              className={character.emote === emote ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("emote", emote)}
            >
              {emote}
            </button>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <h2>Animations</h2>
        <div className="choice-row">
          {animations.map((item) => (
            <button
              key={item}
              className={character.animation === item ? "choice active" : "choice"}
              type="button"
              onClick={() => patchCharacter("animation", item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
