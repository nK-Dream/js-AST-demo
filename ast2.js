const fs = require('fs');
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generator = require("@babel/generator").default;

let jscode = fs.readFileSync("result.js", {
    encoding: "utf-8"
})
//使用parse将js转为ast语法树
let ast = parse(jscode);

//使用traverse遍历语法树，因为方法的调用为CallExpression类型，所以只对type为CallExpression的节点进行处理
traverse(ast, {
    VariableDeclarator: callToStr,
    ExpressionStatement:convParam
});

function convParam(path) {
    var node = path.node;
    //判断是否是我们想要修改的节点
    if(!t.isCallExpression(node.expression))
        return;
    if(node.expression.arguments === undefined || node.expression.callee.params === undefined || node.expression.arguments.length > node.expression.callee.params.length)
        return;
    //获取形参和实参
    var argumentList = node.expression.arguments;
    var paramList = node.expression.callee.params;
    //实参数可能比形参少，所以对实参进行遍历，查看当前作用域是否有该实参的引用
    for(var i = 0; i < argumentList.length;i++){
        var argumentName = argumentList[i].name;
        var paramName = paramList[i].name;
        path.traverse({
            MemberExpression: function(_path){
                var _node = _path.node;
                if(!t.isIdentifier(_node.object) || _node.object.name !== paramName)
                    return;
                //有对实参的引用则将形参的名字改为实参的名字
                _node.object.name = argumentName;    
            }
        })
    }
    //删除实参和形参的列表
    node.expression.arguments = [];
    node.expression.callee.params = [];
}

function callToStr(path) {
    var node = path.node;
    // 判断是否符合条件
    if (!t.isObjectExpression(node.init))
        return;
    var objPropertiesList = node.init.properties;
    if (objPropertiesList.length == 0)
        return;
    var objName = node.id.name;
    // 对定义的各个 方法 或 字符串 依次在作用域内查找是否有调用     
    objPropertiesList.forEach(prop => {
        var key = prop.key.value;
        if (!t.isStringLiteral(prop.value)) {
            // 对方法属性的遍历
            var retStmt = prop.value.body.body[0];
            // 该path的最近父节点
            var fnPath = path.getFunctionParent();
            fnPath.traverse({
                CallExpression: function (_path) {
                    if (!t.isMemberExpression(_path.node.callee)) return;
                    // 判断是否符合条件
                    var _node = _path.node.callee;
                    if (!t.isIdentifier(_node.object) || _node.object.name !== objName)
                        return;
                    if (!t.isStringLiteral(_node.property) || _node.property.value != key)
                        return;
                    var args = _path.node.arguments;
                    // 二元运算
                    if (t.isBinaryExpression(retStmt.argument) && args.length === 2) {
                        _path.replaceWith(t.binaryExpression(retStmt.argument.operator, args[0], args[1]));
                    }
                    // 逻辑运算                                         
                    else if (t.isLogicalExpression(retStmt.argument) && args.length == 2) {
                        _path.replaceWith(t.logicalExpression(retStmt.argument.operator, args[0], args[1]));
                    }
                    // 函数调用                                         
                    else if (t.isCallExpression(retStmt.argument) && t.isIdentifier(retStmt.argument.callee)) {
                        _path.replaceWith(t.callExpression(args[0], args.slice(1)))
                    }
                }
            })
        } else {
            // 对字符串属性的遍历             
            var retStmt = prop.value.value;
            // 该path的最近父节点            
            var fnPath = path.getFunctionParent();
            fnPath.traverse({
                MemberExpression: function (_path) {
                    var _node = _path.node;
                    if (!t.isIdentifier(_node.object) || _node.object.name !== objName)
                        return;
                    if (!t.isStringLiteral(_node.property) || _node.property.value != key)
                        return;
                    _path.replaceWith(t.stringLiteral(retStmt))
                }
            })
        }
    });

    // 遍历过的对象无用了，直接删除。     
    path.remove();
}

//使用generator将ast语法树转为js代码
let { code } = generator(ast, opts = { jsescOption: { "minimal": true } });
fs.writeFile('result2.js', code, (err) => { });