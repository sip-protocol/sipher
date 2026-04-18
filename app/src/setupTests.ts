import '@testing-library/jest-dom/vitest'

// jsdom does not implement layout APIs; stub scroll methods used in components
window.HTMLElement.prototype.scrollIntoView = () => {}
