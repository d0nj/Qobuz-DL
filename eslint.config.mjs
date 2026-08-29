import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@next/next/no-img-element': 'off',
            '@next/next/no-sync-scripts': 'off',
            'react-hooks/exhaustive-deps': 'off',
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/immutability': 'off',
            'react/display-name': 'off'
        }
    },
    {
        ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'public/**']
    }
];

export default eslintConfig;
