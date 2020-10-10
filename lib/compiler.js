const path = require("path");
const fs = require("fs");
const babylon = require("babylon");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generator = require("@babel/generator").default;
const ejs = require("ejs");
const { SyncHook } = require("tapable");

class Compiler {
  constructor(config) {
    this.config = config;
    // 保存入口文件的路径
    this.entryId;
    this.entry = config.entry;
    // 保存所有的模块依赖
    this.modules = {};
    // 工作目录
    this.root = process.cwd();
    // hooks
    this.hooks = {
      entryOptions: new SyncHook(),
      compile: new SyncHook(),
      afterCompile: new SyncHook(),
      afterPlugins: new SyncHook(),
      run: new SyncHook(),
      emit: new SyncHook(), // 生成资源到output目录之前
      done: new SyncHook(), // 编译完成
    };
    // 判断plugins是否存在，存在的话执行
    let plugins = this.config.plugins;
    if (Array.isArray(plugins)) {
      plugins.forEach((p) => {
        p.apply(this);
      });
    }
    this.hooks.afterPlugins.call();
  }
  // 获取module，递归调用loader，实现转化功能
  getSource(modulePath) {
    let file = fs.readFileSync(modulePath, "utf-8");
    let rules = this.config.module.rules;
    for (let i = 0; i < rules.length; i++) {
      let rule = rules[i];
      let { test, use } = rule;
      let len = rules.length - 1;
      if (test.test(modulePath)) {
        function normalLoader() {
          let loader = require(use[len--]);
          file = loader(file);
          if (len > 0) {
            normalLoader;
          }
        }
        normalLoader();
      }
    }
    return file;
  }
  /**
   * 解析源码
   * @param {*} source
   * @param {*} parentPath
   * babylon 把源码转换为ast
   * @babel/traverse 遍历ast节点
   * @babel/types 替换节点
   * @babel/generator ast转换为js源码
   */
  parse(source, parentPath) {
    let ast = babylon.parse(source); // 源码转为 AST
    let dependencies = [];
    traverse(ast, {
      // 遍历并更改节点内容、获取依赖模块
      CallExpression(p) {
        let node = p.node;
        if ((node.callee.name = "require")) {
          node.callee.name = "__webpack_require__";
          let moduleName = node.arguments[0].value; // 模块的引用名字
          moduleName = moduleName + (path.extname(moduleName) ? "" : ".js");
          moduleName = "./" + path.join(parentPath, moduleName);
          dependencies.push(moduleName);
          node.arguments = [t.stringLiteral(moduleName)];
        }
      },
    });
    let sourceCode = generator(ast).code;
    return {
      sourceCode,
      dependencies,
    };
  }
  // 构建模块
  buildModule(modulePath, isEntry) {
    let source = this.getSource(modulePath);
    let moduleName = "./" + path.relative(this.root, modulePath); // 相对路径
    if (isEntry) {
      this.entryId = moduleName;
    }
    // 解析源码，进行改造并返回依赖列表
    const { sourceCode, dependencies } = this.parse(
      source,
      path.dirname(moduleName)
    );
    this.modules[moduleName] = sourceCode;
    // 递归处理其他模块
    dependencies.forEach((dep) => {
      this.buildModule(path.join(this.root, dep), false);
    });
  }
  emitFile() {
    // 获取输出路径
    let main = path.join(this.config.output.path, this.config.output.filename);
    // 读取模板
    let templateStr = this.getSource(path.join(__dirname, "main.ejs"));
    let code = ejs.render(templateStr, {
      entryId: this.entryId,
      modules: this.modules,
    });
    this.assets = {};
    this.assets[main] = code;
    fs.mkdir(this.config.output.path, () => {
      fs.writeFileSync(main, this.assets[main], () => {});
    });
  }
  run() {
    this.hooks.run.call();
    this.hooks.compile.call();
    // 执行，并且创建模块的依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true);
    this.hooks.afterCompile.call();
    // 发射打包后的文件
    this.emitFile();
    this.hooks.emit.call();
    this.hooks.done.call();
  }
}
module.exports = Compiler;
