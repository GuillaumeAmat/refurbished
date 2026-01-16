import GUI from 'lil-gui';

type Controllers = Record<string, unknown>;
type Folders = Record<string, { controllers: Controllers; folders: Folders }>;
type Config = {
  controllers: Controllers;
  folders: Folders;
};

export class Debug {
  static #instance: Debug;

  #active = false;
  #gui!: GUI;
  #configFromLocalStorage!: Config | null;

  get active() {
    return this.#active;
  }

  get gui() {
    return this.#gui;
  }

  get configFromLocaleStorage() {
    return this.#configFromLocalStorage;
  }

  constructor() {
    Debug.#instance = this;

    if (!window) {
      throw new Error('"Debug" can only be instanciated in a browser environment.');
    }

    if (!window.location.search.includes('debug')) {
      return;
    }

    this.#active = true;

    this.#gui = new GUI({
      closeFolders: true,
    });

    this.#gui.close();

    this.loadFromLocalStorage();
  }

  static getInstance() {
    return Debug.#instance;
  }

  public save() {
    this.saveToLocalStorage();
  }

  private saveToLocalStorage() {
    const payload = this.#gui.save();
    localStorage.setItem('debug', JSON.stringify(payload));
  }

  private loadFromLocalStorage() {
    const payload = localStorage.getItem('debug');

    if (payload) {
      try {
        this.#configFromLocalStorage = JSON.parse(payload);

        if (this.#configFromLocalStorage) {
          this.#gui.load(this.#configFromLocalStorage);
        }
      } catch (error) {
        console.error('Could not parse debug config from localStorage', error);
      }
    }
  }
}
