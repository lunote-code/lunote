import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'src-tauri/target', 'src-tauri/gen', 'scripts/test']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-caught-error': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/documentRuntime/documentKernel.ts',
      'src/io/documentIO.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='setActivePath']",
          message: 'Document state must be changed through dispatchDocumentCommand.',
        },
        {
          selector: "CallExpression[callee.name='setContent']",
          message: 'Document state must be changed through dispatchDocumentCommand.',
        },
        {
          selector: "CallExpression[callee.name='setOpenedTabs']",
          message: 'Document tabs must be changed through dispatchDocumentCommand.',
        },
        {
          selector: "CallExpression[callee.name='publishDocumentEvent']",
          message: 'Document events may only be published by DocumentRuntimeKernel.',
        },
        {
          selector: "CallExpression[callee.name='invoke'] Literal[value='read_note']",
          message: 'read_note IPC must be isolated in src/io/documentIO.ts.',
        },
        {
          selector: "CallExpression[callee.name='invoke'] Literal[value='save_note']",
          message: 'save_note IPC must be isolated in src/io/documentIO.ts.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/navigation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportSpecifier[imported.name='openNote']",
          message: 'Navigation entry must use dispatchNavigationEvent via src/navigation/navigationFactory.ts.',
        },
        {
          selector: "ImportSpecifier[imported.name='openInTab']",
          message: 'Navigation entry must use dispatchNavigationEvent via src/navigation/navigationFactory.ts.',
        },
        {
          selector: "CallExpression[callee.name='openNote']",
          message: 'Direct openNote calls are forbidden outside the navigation factory layer.',
        },
        {
          selector: "CallExpression[callee.name='openInTab']",
          message: 'Direct openInTab calls are forbidden outside the navigation factory layer.',
        },
        {
          selector: "CallExpression[callee.name='openEntry']",
          message: 'Direct noteNavigationRuntime.openEntry calls are forbidden; dispatch a NavigationEvent instead.',
        },
        {
          selector: "CallExpression[callee.property.name='navigate'][callee.object.name='kernelExecutor']",
          message: 'Direct kernelExecutor.navigate calls are forbidden; dispatch a NavigationEvent instead.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: './editor/knowledgeOS/ui/interactionModel/kernelExecutor',
              message: 'Do not import kernelExecutor navigation entry outside navigation factory layer.',
            },
            {
              name: '../editor/knowledgeOS/ui/interactionModel/kernelExecutor',
              message: 'Do not import kernelExecutor navigation entry outside navigation factory layer.',
            },
          ],
          patterns: [
            {
              group: ['**/kernelExecutor'],
              message: 'Do not import kernelExecutor navigation entry outside navigation factory layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/AppRoot.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/debug/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportSpecifier[imported.name='serializeDocToMarkdownDebug']",
          message: 'Debug serializer is non-production; import only in tests/debug tooling.',
        },
        {
          selector: "ImportSpecifier[imported.name='serializeBlockNodeToMarkdownDebug']",
          message: 'Debug serializer is non-production; import only in tests/debug tooling.',
        },
        {
          selector: "ImportSpecifier[imported.name='serializePmRangeToMarkdownDebug']",
          message: 'Debug serializer is non-production; import only in tests/debug tooling.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/editor/compiler/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportSpecifier[imported.name='serializeDocToMarkdownStrict']",
          message: 'Use compiler boundary module: src/editor/compiler/markdownCompiler.ts',
        },
        {
          selector: "ImportSpecifier[imported.name='serializeDocToMarkdownWithMode']",
          message: 'Use compiler boundary module: src/editor/compiler/markdownCompiler.ts',
        },
        {
          selector: "ImportSpecifier[imported.name='serializeDocToMarkdown']",
          message: 'Use compiler boundary module: src/editor/compiler/markdownCompiler.ts',
        },
        {
          selector: "ImportSpecifier[imported.name='serializeDocToMarkdownForModeBridge']",
          message: 'Use compiler boundary module: src/editor/compiler/markdownCompiler.ts',
        },
        {
          selector: "ImportSpecifier[imported.name='trySerializeDocToMarkdown']",
          message: 'Use compiler boundary module: src/editor/compiler/markdownCompiler.ts',
        },
        {
          selector: "ImportSpecifier[imported.name='serializeBlockNodeToMarkdown']",
          message: 'Use compiler boundary module: src/editor/compiler/markdownCompiler.ts',
        },
        {
          selector: "ImportSpecifier[imported.name='serializePmRangeToMarkdown']",
          message: 'Use compiler boundary module: src/editor/compiler/markdownCompiler.ts',
        },
      ],
    },
  },
  {
    files: ['src/editor/**/*.{ts,tsx}'],
    ignores: ['src/editor/compiler/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/knowledgeOS/ui/wikiLinkDom'],
              message: 'Interaction layer must consume compiler metadata helpers from src/editor/compiler/wikiInteractionMetadata.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/editor/compiler/wikiInteractionMetadata.ts',
      'src/editor/knowledgeOS/ui/cmWikiLinkExtension.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='textBetween']",
          message: 'Interaction wiki resolver must be metadata-only; textBetween is forbidden.',
        },
        {
          selector: 'Literal[regex]',
          message: 'Interaction wiki resolver must not use regex parsing.',
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message: 'Interaction wiki resolver must not use regex parsing.',
        },
      ],
    },
  },
  {
    files: [
      'src/editor/knowledgeInteractionRuntime/semanticSearchRuntime.ts',
      'src/editor/knowledgeInteractionRuntime/semanticRankRuntime.ts',
      'src/editor/knowledgeInteractionRuntime/unlinkedMentionRuntime.ts',
      'src/editor/knowledgeInteractionRuntime/knowledgeSuggestionRuntime.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportSpecifier[imported.name='dispatchKnowledgeNavigate']",
          message: 'Heuristic runtime must not dispatch navigation authority.',
        },
        {
          selector: "ImportSpecifier[imported.name='resolveEditorAnchor']",
          message: 'Heuristic runtime must not resolve anchors.',
        },
        {
          selector: "ImportSpecifier[imported.name='resolveNavigationTarget']",
          message: 'Heuristic runtime must not resolve navigation authority.',
        },
        {
          selector: "ImportSpecifier[imported.name='resolveDocKey']",
          message: 'Heuristic runtime must not resolve docKey authority.',
        },
        {
          selector: "CallExpression[callee.name='resolveDocKey']",
          message: 'Heuristic runtime must not call resolveDocKey.',
        },
      ],
    },
  },
])
