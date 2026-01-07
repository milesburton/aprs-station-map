import { Window } from 'happy-dom'

const window = new Window()

// @ts-expect-error happy-dom types don't fully match DOM types
global.window = window
// @ts-expect-error happy-dom types don't fully match DOM types
global.document = window.document
// @ts-expect-error happy-dom types don't fully match DOM types
global.DOMParser = window.DOMParser
