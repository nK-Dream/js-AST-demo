const fs = require('fs');
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generator = require("@babel/generator").default;

const { decryptStr, decryptStrFnName } = require("./module");

let jscode = fs.readFileSync("source.js", {
    encoding: "utf-8"
})
//使用parse将js转为ast语法树
let ast = parse(jscode);

//使用traverse遍历语法树，因为方法的调用为CallExpression类型，所以只对type为CallExpression的节点进行处理
traverse(ast, {
    CallExpression: funToStr,
});

function funToStr(path) {
    var curNode = path.node;
    if (curNode.callee.name === decryptStrFnName && curNode.arguments.length === 2) {
        var strC = decryptStr(curNode.arguments[0].value, curNode.arguments[1].value);
        path.replaceWith(t.stringLiteral(strC))
    }
}


//使用generator将ast语法树转为js代码
let { code } = generator(ast, opts = { jsescOption: { "minimal": true } });
fs.writeFile('result.js', code, (err) => { });