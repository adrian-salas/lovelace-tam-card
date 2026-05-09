import typescript from 'rollup-plugin-typescript2';
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import serve from 'rollup-plugin-serve';
import json from '@rollup/plugin-json';

const dev = process.env.ROLLUP_WATCH;

const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 5000,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

const plugins = [
  nodeResolve({
    preferBuiltins: false,
  }),
  commonjs(),
  typescript(),
  json({
    preferConst: true,
  }),
  babel({
    exclude: 'node_modules/**',
    presets: [
      ['@babel/preset-env', { modules: false }]
    ]
  }),
  dev && serve(serveopts),
  !dev && terser(),
];

export default [
  {
    input: 'src/tam-card.ts',
    output: {
      file: 'dist/tam-card.js',
      format: 'es',
      sourcemap: dev,
    },
    external: [],
    plugins: [...plugins],
  },
];
