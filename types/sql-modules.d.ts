/**
 * babel-plugin-inline-import turns the generated `.sql` files into string
 * literals at build time (see babel.config.js); TypeScript needs telling.
 */
declare module '*.sql' {
  const content: string;
  export default content;
}
