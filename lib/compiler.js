const path = require("path");
const fs = require("fs");
const babylon = require("babylon");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generator = require("@babel/generator").default;
const ejs = require("ejs");

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
  }
  // 获取文件
  getSource(modulePath) {
    let file = fs.readFileSync(modulePath, "utf-8");
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
        node.callee.name = "__webpack_require__";
        let moduleName = node.arguments[0].value; // 模块的引用名字
        moduleName = moduleName + (path.extname(moduleName) ? "" : ".js");
        moduleName = "./" + path.join(parentPath, moduleName);
        dependencies.push(moduleName);
        node.arguments = [t.stringLiteral(moduleName)];
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
    console.log(moduleName, "ssss");
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
    // 执行，并且创建模块的依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true);
    // 发射打包后的文件
    this.emitFile();
  }
}
module.exports = Compiler;
