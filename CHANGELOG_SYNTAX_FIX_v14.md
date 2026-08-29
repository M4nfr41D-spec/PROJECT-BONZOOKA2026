# CHANGELOG_SYNTAX_FIX_v14

- Fixed duplicate `const ang` declaration in `runtime/Bullets.js` enemy bullet render block.
- This resolved `SyntaxError: Identifier 'ang' has already been declared` which prevented the runtime from booting and blocked all UI bindings.
