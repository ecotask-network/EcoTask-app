/**
 * Vendor type-compatibility shims.
 *
 * See README ("Type checking with skipLibCheck disabled") for the full story.
 *
 * `zustand/middleware`'s devtools typing references the DOM `Window` type,
 * which does not exist in a React Native program (we do not include
 * `lib.dom`, because it collides with React Native's own globals). Declaring
 * the slice of `Window` that zustand inspects lets its devtools middleware
 * resolve its configuration type without pulling DOM types into the program.
 */
declare interface Window {
  __REDUX_DEVTOOLS_EXTENSION__?: {
    connect(options: Record<string, unknown>): unknown;
  };
}
