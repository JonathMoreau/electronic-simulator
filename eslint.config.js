// eslint.config.js
export default [
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                confirm: 'readonly',
                // Node.js globals
                process: 'readonly',
                require: 'readonly',
                module: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                // Custom globals
                Component: 'readonly',
                breadboardState: 'readonly',
                BREADBOARD_CONFIG: 'readonly',
                activateMoveMode: 'readonly',
                deactivateMoveMode: 'readonly',
                updateInfo: 'readonly',
                updatePlacementStatus: 'readonly'
            }
        },
        rules: {
            'indent': ['error', 4],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'no-unused-vars': ['warn', { 
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^(activateMoveMode|deactivateMoveMode|updateInfo|updatePlacementStatus)$'
            }],
            'no-console': 'off',
            'no-undef': 'error'
        }
    },
    {
        files: ['**/*.js'],
        ignores: ['node_modules/**', 'public/**']
    },
    {
        files: ['public/**/*.js'],
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                confirm: 'readonly',
                Component: 'readonly',
                breadboardState: 'readonly',
                BREADBOARD_CONFIG: 'readonly',
                activateMoveMode: 'readonly',
                deactivateMoveMode: 'readonly',
                updateInfo: 'readonly',
                updatePlacementStatus: 'readonly'
            }
        }
    }
];

