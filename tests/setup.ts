import { Window } from 'happy-dom'

const window = new Window()

global.window = window as unknown as Window & typeof globalThis
global.document = window.document
global.DOMParser = window.DOMParser
