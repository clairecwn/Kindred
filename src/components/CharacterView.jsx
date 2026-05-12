import Animal3D from "./Animal3D.jsx";

const animals = ["fox", "cat", "bunny"];
const colors = ["honey", "mint", "berry", "sky", "cocoa"];
const accessories = ["none", "scarf", "hat"];

export default function CharacterView({ emotion, character, setCharacter }) {
  function patchCharacter(key, value) {
    setCharacter((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="page-grid">
      <section className="hero-panel character-hero">
        <div>
          <p className="eyebrow">Character studio</p>
          <h1>Editable 3D companion</h1>
          <p>Animal type, body color, and accessory are now real controls tied to the animated preview.</p>
        </div>
        <Animal3D emotion={emotion} {...character} />
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
        <h2>Color</h2>
        <div className="choice-row">
          {colors.map((color) => (
            <button
              key={color}
              className={character.color === color ? "swatch active" : "swatch"}
              type="button"
              onClick={() => patchCharacter("color", color)}
            >
              {color}
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
    </div>
  );
}
