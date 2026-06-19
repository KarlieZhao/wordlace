//https://api.mymemory.translated.net/get?q=sentence&langpair=en|es


// TODO: 
// whats the best way to debounce? 
// how to show the translation? 
//      - replace original word
//      - add tooltip kinda thing
//      - show on the side
// cache all translated text 
export class Translator {
  constructor(inputLang, outputLang) {
    this.inputLang = inputLang;
    this.outputLang = outputLang;
    this.div = document.querySelector("#translation-label");
  }

  async translate(phrase) {
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(phrase)}` +
      `&langpair=${this.inputLang}|${this.outputLang}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Translation request failed: ${response.status}`);
    }

    const data = await response.json();
    this.div.textContent = data.responseData.translatedText;
    console.log(`original: ${phrase}`);
    console.log(`translated: ${data.responseData.translatedText}`);
    return data.responseData.translatedText;
  }
}
