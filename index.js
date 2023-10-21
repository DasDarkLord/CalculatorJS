// UTILITY

function multifactorial(x, f) {
    if (x < 0 || x === 1) return x
    return x * multifactorial(x - f, f)
}

// LEXER

class TokenType {
    id
    word

    constructor(id, word = null) {
        this.id = id
        this.word = word
    }

    // Types
    static NUMBER = new TokenType("num")

    // Operators
    static ADDITION = new TokenType("add", "+")
    static SUBTRACTION = new TokenType("sub", "-")
    static MULTIPLICATION = new TokenType("mul", "*")
    static IMPLICIT_MULTIPLICATION = new TokenType("imul")
    static DIVISION = new TokenType("div", "/")
    static EXPONENT = new TokenType("pow", "^")
    static FACTORIAL = new TokenType("fact", "!")

    // Parentheses
    static OPEN_PARENTHESIS = new TokenType("oparen", "(")
    static CLOSED_PARENTHESIS = new TokenType("cparen", ")")

    // Misc
    static IDENTIFIER = new TokenType("identifier")
    static FUNCTION_CALL = new TokenType("func_call")
    static COMMA = new TokenType("comma", ",")

    // VALUES
    static values = [
        this.NUMBER,
        this.ADDITION, this.SUBTRACTION, this.MULTIPLICATION, this.IMPLICIT_MULTIPLICATION, this.DIVISION, this.EXPONENT, this.FACTORIAL,
        this.OPEN_PARENTHESIS, this.CLOSED_PARENTHESIS,
        this.IDENTIFIER, this.FUNCTION_CALL, this.COMMA
    ]
}

class Token {
    type
    value

    constructor(type, value) {
        this.type = type
        this.value = value
    }
}

function lexString(source) {
    let tokens = []
    source = source.trim()

    let position = 0
    while (position < source.length) {
        if (source[position].match(RegExp("[0-9]"))) {
            let num = ""
            let amountPoints = 0
            while (position < source.length && (source[position].match(RegExp("[0-9]")) || (source[position] == "." && amountPoints == 0))) {
                if (source[position] == ".") amountPoints++
                num += source[position]
                position++
            }
            position--

            tokens.push(new Token(
                TokenType.NUMBER,
                +num
            ))
        } else if (source[position].match(RegExp("[a-zA-Z]"))) {
            let str = ""

            while (position < source.length) {
                if (!(source[position].match(RegExp("[a-zA-Z]")) || source[position] == "_")) break

                str += source[position]
                position++
            }

            let funcExists = false
            for (func of functions) for (let name of func["names"]) if (name == str) funcExists = true

            let type = TokenType.IDENTIFIER
            if (position < source.length && source[position] == "(" && funcExists) {
                type = TokenType.FUNCTION_CALL
            }
            position--

            tokens.push(new Token(
                type,
                str
            ))
        } else {
            for (type of TokenType.values) {
                if (type.word != null && type.word == source[position]) {
                    tokens.push(new Token(
                        type,
                        type.word
                    ))
                    break
                }
            }
        }

        position++
    }

    return tokens
}

// PARSER
class TreeNode {
    type
    left
    right
    value
    args

    constructor(type, left = null, right = null, value = null, args = null) {
        this.type = type
        this.left = left
        this.right = right
        this.value = value
        this.args = args
    }
}

class NodeParser {
    index
    tokens

    constructor(tokens) {
        this.tokens = tokens
        this.index = 0
    }

    parseFunction() {
        let token = this.tokens[this.index]
        this.index++

        let argumentTokens = []
        let currentTokens = []

        let openParens = 0
        while (this.index < this.tokens.length) {
            if (this.tokens[this.index].type == TokenType.OPEN_PARENTHESIS) openParens++
            if (this.tokens[this.index].type == TokenType.CLOSED_PARENTHESIS) openParens--

            if (openParens == 0) break

            if (this.tokens[this.index].type == TokenType.COMMA && openParens == 1) {
                argumentTokens.push(currentTokens.slice())
                currentTokens = []
                this.index++
                continue
            }

            if (this.tokens[this.index].type == TokenType.OPEN_PARENTHESIS && openParens == 1) {
                this.index++
                continue
            }
            currentTokens.push(this.tokens[this.index])

            this.index++
        }
        if (currentTokens.length > 0) argumentTokens.push(currentTokens.slice())

        let treeArguments = []
        for (let exprTokens of argumentTokens) {
            treeArguments.push(NodeParser.parseTokens(exprTokens))
        }

        this.index++
        return this.parseOtherStuff(
            new TreeNode(
                "func_call",
                null,
                null,
                token.value,
                treeArguments
            )
        )
    }

    parseOtherStuff(node) {
        return this.parseFactorial(node)
    }

    parseFactorial(node) {
        if (this.index < this.tokens.length) {
            let factorial = 0
            while (this.index < this.tokens.length && this.tokens[this.index].type === TokenType.FACTORIAL) {
                factorial++
                this.index++
            }

            if (factorial === 0) return node
            else {
                return new TreeNode(
                    "factorial",
                    node,
                    new TreeNode(
                        "number",
                        null,
                        null,
                        factorial
                    )
                )
            }
        }

        return node
    }

    parseNumber() {
        let token = this.tokens[this.index]
        this.index++
        return this.parseOtherStuff(
            new TreeNode(
                "number", null, null, token.value
            )
        )
    }
    
    parseIdentifier() {
        let token = this.tokens[this.index]
        this.index++
        return this.parseOtherStuff(
            new TreeNode(
                "id", null, null, token.value
            )
        )
    }

    parseExpression() {
        let leftNode = this.parseTerm()

        while (this.index < this.tokens.length && (this.tokens[this.index].type == TokenType.ADDITION || this.tokens[this.index].type == TokenType.SUBTRACTION)) {
            let operator = this.tokens[this.index].type.id
            this.index++
            let rightNode = this.parseTerm()
            leftNode = new TreeNode(operator, leftNode, rightNode)
        }

        return leftNode
    }

    parseTerm() {
        let leftNode = this.parseImplicitMultiplication()

        while (this.index < this.tokens.length && (this.tokens[this.index].type == TokenType.MULTIPLICATION || this.tokens[this.index].type == TokenType.DIVISION)) {
            let operator = this.tokens[this.index].type.id
            this.index++
            let rightNode = this.parseImplicitMultiplication()
            leftNode = new TreeNode(operator, leftNode, rightNode)
        }

        return leftNode
    }

    parseImplicitMultiplication() {
        let leftNode = this.parseExponentiation()

        while (this.index < this.tokens.length && (this.tokens[this.index].type == TokenType.IMPLICIT_MULTIPLICATION)) {
            let operator = this.tokens[this.index].type.id
            this.index++
            let rightNode = this.parseExponentiation()
            leftNode = new TreeNode(operator, leftNode, rightNode)
        }

        return leftNode
    }

    parseExponentiation() {
        let leftNode = this.parseFactor()

        while (this.index < this.tokens.length && (this.tokens[this.index].type == TokenType.EXPONENT)) {
            let operator = this.tokens[this.index].type.id
            this.index++
            let rightNode = this.parseFactor()
            leftNode = new TreeNode(operator, leftNode, rightNode)
        }

        return leftNode
    }

    parseFactor() {
        if (this.tokens[this.index].type == TokenType.NUMBER) {
            return this.parseNumber()
        } else if (this.tokens[this.index].type == TokenType.IDENTIFIER) {
            return this.parseIdentifier()
        } else if (this.tokens[this.index].type == TokenType.FUNCTION_CALL) {
            return this.parseFunction()
        } else if (this.tokens[this.index].type == TokenType.OPEN_PARENTHESIS) {
            this.index++
            let expressionNode = this.parseExpression()
            if (this.index < this.tokens.length && this.tokens[this.index].type == TokenType.CLOSED_PARENTHESIS) {
                this.index++
                return expressionNode
            }
            throw Error("Expected closing parenthesis")
        } else {
            if (this.tokens[this.index].type == TokenType.SUBTRACTION) {
                let nextIndex = this.index + 1
                if (nextIndex < this.tokens.length) {
                    let nextToken = this.tokens[nextIndex]
                    if (nextToken.type == TokenType.NUMBER) {
                        this.tokens[this.index] = new Token(
                            TokenType.NUMBER,
                            -(+nextToken.value)
                        )
                        this.index++

                        return new TreeNode(
                            "number",
                            null,
                            null,
                            -(+nextToken.value)
                        )
                    } else if (nextToken.type == TokenType.IDENTIFIER || nextToken.type == TokenType.FUNCTION_CALL || nextToken.type == TokenType.OPEN_PARENTHESIS) {
                        this.tokens.splice(this.index, 0, new Token(
                            TokenType.NUMBER,
                            0.0
                        ))

                        return this.parseFactor()
                    }
                }
            }
        }

        throw Error(`Unexpected token: ${this.tokens[this.index].type.id}`)
    }

    static parseTokens(tokens) {
        let implicitMultiplicationTokens = []

        let operationTokenTypes = [
            TokenType.ADDITION, TokenType.MULTIPLICATION, TokenType.SUBTRACTION, TokenType.DIVISION, TokenType.EXPONENT, TokenType.IMPLICIT_MULTIPLICATION, TokenType.FACTORIAL,
            TokenType.OPEN_PARENTHESIS, TokenType.CLOSED_PARENTHESIS, 
            TokenType.FUNCTION_CALL, TokenType.COMMA,
        ]

        let valueTokenTypes = [
            TokenType.NUMBER
        ]

        let index = 0
        for (let token of tokens) {
            let nextIndex = index + 1
            if (nextIndex >= tokens.length) {
                implicitMultiplicationTokens.push(token)
                break
            }
            let nextToken = tokens[nextIndex]

            implicitMultiplicationTokens.push(token)

            let addImplicitMultiplication =
                (!operationTokenTypes.includes(token.type) && (nextToken.type == TokenType.OPEN_PARENTHESIS || nextToken.type == TokenType.IDENTIFIER || nextToken.type == TokenType.FUNCTION_CALL)) ||
                (token.type == TokenType.IDENTIFIER && (!operationTokenTypes.includes(nextToken.type) || nextToken.type == TokenType.OPEN_PARENTHESIS)) ||
                (token.type == TokenType.CLOSED_PARENTHESIS && (!operationTokenTypes.includes(nextToken.type) || nextToken.type == TokenType.OPEN_PARENTHESIS ||  nextToken.type == TokenType.FUNCTION_CALL)) ||
                (valueTokenTypes.includes(token.type) && valueTokenTypes.includes(nextToken.type))

            if (addImplicitMultiplication) {
                implicitMultiplicationTokens.push(new Token(
                    TokenType.IMPLICIT_MULTIPLICATION,
                    "*"
                ))
            }

            index++
        }

        let parser = new NodeParser(implicitMultiplicationTokens)
        return parser.parseExpression()
    }

}

// FUNCTIONS

class AbsFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.abs(num)
    }
}

class SinFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.sin(num)
    }
}

class AsinFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.asin(num)
    }
}

class SinhFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.sinh(num)
    }
}

class AsinhFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.asinh(num)
    }
}

class CosFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.cos(num)
    }
}

class AcosFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.acos(num)
    }
}

class CoshFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.cosh(num)
    }
}

class AcoshFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.acosh(num)
    }
}

class TanFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.tan(num)
    }
}

class AtanFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.atan(num)
    }
}

class TanhFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.tanh(num)
    }
}

class AtanhFunction {
    execute(args) {
        if (args.length < 1) return undefined
        let num = +evaluate(args[0])
        return Math.atanh(num)
    }
}


class SumFunction {
    execute(args) {
        if (args.length < 3) return undefined
        let expression = args[0]
        let start = +evaluate(args[1])
        let end = +evaluate(args[2])
        if (start > end) return undefined

        let sum = 0
        for (let i = start; i <= end; i++) {
            let customConstants = [
                {
                    "names": ["x", "X", "n", "N"],
                    "value": i
                }
            ]

            sum += +evaluate(expression, customConstants)
        }

        return sum
    }
}

let functions = [
    {
        "names": ["abs", "absolute", "absolute_value"],
        "value": new AbsFunction()
    },
    {
        "names": ["asin", "arcsin"],
        "value": new AsinFunction()
    },
    {
        "names": ["sinh"],
        "value": new SinhFunction()
    },
    {
        "names": ["asinh", "arcsinh"],
        "value": new AsinhFunction()
    },
    {
        "names": ["sin", "sine"],
        "value": new SinFunction()
    },
    {
        "names": ["acos", "arccos"],
        "value": new AcosFunction()
    },
    {
        "names": ["cosh"],
        "value": new CoshFunction()
    },
    {
        "names": ["acosh", "arccosh"],
        "value": new AcoshFunction()
    },
    {
        "names": ["cos", "cosine"],
        "value": new CosFunction()
    },
    {
        "names": ["tan"],
        "values": new TanFunction()
    },
    {
        "names": ["atan"],
        "values": new AtanFunction()
    },
    {
        "names": ["tanh"],
        "values": new TanhFunction()
    },
    {
        "names": ["atanh"],
        "values": new AtanhFunction()
    },
    {
        "names": ["sum", "summation"],
        "value": new SumFunction()
    }
]

let constants = [
    {
        "names": ["pi"],
        "value": Math.PI
    },
    {
        "names": ["e", "euler"],
        "value": Math.E
    },
    {
        "names": ["inf", "infinity"],
        "value": Number.POSITIVE_INFINITY
    },
    {
        "names": ["nan", "NaN", "NAN"],
        "value": Number.NaN
    }
]

// EVALUATOR

function evaluate(tree, customConstants = null) {
    switch (tree.type) {
        case "number":
            return tree.value
        case "add":
            return evaluate(tree.left, customConstants) + evaluate(tree.right, customConstants)
        case "sub":
            return evaluate(tree.left, customConstants) - evaluate(tree.right, customConstants)
        case "mul":
        case "imul":
            return evaluate(tree.left, customConstants) * evaluate(tree.right, customConstants)
        case "div":
            return evaluate(tree.left, customConstants) / evaluate(tree.right, customConstants)
        case "pow":
            return Math.pow(evaluate(tree.left, customConstants), evaluate(tree.right, customConstants))
        case "id":
            let fullConstants = constants.slice()
            if (customConstants != null) fullConstants = fullConstants.concat(customConstants)

            let constValue = tree.value
            for (let constant of fullConstants) {
                let names = constant["names"]
                for (let name of names) {
                    if (name == constValue) {
                        return constant["value"]
                    }
                }
            }
            return undefined
        case "func_call":
            let funcValue = tree.value
            for (let func of functions) {
                let names = func["names"]
                for (let name of names) {
                    if (name == funcValue) {
                        let funcClass = func["value"]
                        return funcClass.execute(tree.args)
                    }
                }
            }
            return undefined
        case "factorial":
            let num = +evaluate(tree.left, customConstants)
            let factorial = +evaluate(tree.right, customConstants)
            return multifactorial(num, factorial)
        default:
            return undefined
    }
}

// fnuy

function calculate(inp, customConstants = null) {
    let lexed = lexString(inp)
    console.log(lexed)

    let tree = NodeParser.parseTokens(lexed)
    console.log(tree)

    let eval = evaluate(tree, customConstants)
    console.log(prettyVersion(eval))

    return eval
}

// formatting

function prettyVersion(inp) {
    if (!isNaN(inp)) {
        return inp.toLocaleString('fullwide', { useGrouping: false })
    }
    if (inp === undefined) return "undefined"
    return inp.toString()
}

// 

calculate("sin(2)!")

function expressionHandler() {
    let element = document.getElementById("expression-out")
    try {
        element.textContent = calculate(document.getElementById("expression-in").value)
    } catch (ignored) {
        element.textContent = "undefined"
    }
}