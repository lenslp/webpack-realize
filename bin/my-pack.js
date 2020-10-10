#! /usr/bin/env node

// 1、拿到webpack.config.js配置文件
let path = require("path");
let config = require(path.resolve("webpack.config.js"));
// 编译
let Compiler = require("../lib/compiler");
let compiler = new Compiler(config);
compiler.hooks.entryOptions.call();
compiler.run();
