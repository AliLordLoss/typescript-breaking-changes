import ts from "typescript";

/**
 * Takes a fuzzed V1 parameter string and generates an array of structurally
 * narrowed V2 strings using AST transformations.
 */
export function generateV2ParamMutations(v1Params: string): string[] {
  if (!v1Params || !v1Params.trim()) return [];

  const code = `function foo(${v1Params}) {}`;
  const sourceFile = ts.createSourceFile(
    "dummy.ts",
    code,
    ts.ScriptTarget.Latest,
    true,
  );

  // Extract the first parameter declaration
  let paramDecl: ts.ParameterDeclaration | undefined;
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.parameters.length > 0) {
      paramDecl = node.parameters[0];
    }
  });

  if (!paramDecl) return [];

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const printNode = (node: ts.Node) =>
    printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
  const mutations: string[] = [];

  // MUTATION 1: Remove Optional Token ('?')
  if (paramDecl.questionToken) {
    const mutatedParam = ts.factory.updateParameterDeclaration(
      paramDecl,
      paramDecl.modifiers,
      paramDecl.dotDotDotToken,
      paramDecl.name,
      undefined, // Strips the '?'
      paramDecl.type,
      paramDecl.initializer,
    );
    mutations.push(printNode(mutatedParam));
  }

  // MUTATION 2: Remove Rest Token ('...')
  if (paramDecl.dotDotDotToken) {
    const mutatedParam = ts.factory.updateParameterDeclaration(
      paramDecl,
      paramDecl.modifiers,
      undefined, // Strips the '...'
      paramDecl.name,
      paramDecl.questionToken,
      paramDecl.type,
      paramDecl.initializer,
    );
    mutations.push(printNode(mutatedParam));
  }

  // MUTATION 3: Deep Type Narrowing (Unions -> Intersections, Arrays -> Tuples)
  if (paramDecl.type) {
    // We run a custom AST transformer over the type node
    const typeMutations = getDeepTypeMutations(paramDecl.type);

    for (const mutatedType of typeMutations) {
      const mutatedParam = ts.factory.updateParameterDeclaration(
        paramDecl,
        paramDecl.modifiers,
        paramDecl.dotDotDotToken,
        paramDecl.name,
        paramDecl.questionToken,
        mutatedType,
        paramDecl.initializer,
      );
      mutations.push(printNode(mutatedParam));
    }
  }

  // Remove exact duplicates
  return Array.from(new Set(mutations));
}

/**
 * Creates mutated versions of a type node by finding susceptible targets (Unions, Arrays)
 */
function getDeepTypeMutations(rootType: ts.TypeNode): ts.TypeNode[] {
  const mutatedNodes: ts.TypeNode[] = [];

  // Safely transforms the AST using the official TS Transformation API
  const visitAndMutate = (
    nodeToTransform: ts.Node,
    targetNode: ts.Node,
    mutation: (n: ts.Node) => ts.Node,
  ): ts.Node => {
    const transformer =
      <T extends ts.Node>(context: ts.TransformationContext) =>
      (rootNode: T) => {
        function visit(node: ts.Node): ts.Node {
          if (node === targetNode) {
            return mutation(node);
          }
          return ts.visitEachChild(node, visit, context);
        }
        return ts.visitNode(rootNode, visit) as T;
      };

    const result = ts.transform(nodeToTransform, [transformer]);
    const transformedNode = result.transformed[0];
    result.dispose(); // Clean up memory
    return transformedNode;
  };

  // Find all susceptible nodes in the tree
  const findTargets = (node: ts.Node) => {
    // Target: Union Types (A | B) -> Intersection (A & B)
    if (ts.isUnionTypeNode(node)) {
      const mutatedTree = visitAndMutate(rootType, node, (n) => {
        return ts.factory.createIntersectionTypeNode(
          (n as ts.UnionTypeNode).types,
        );
      });
      mutatedNodes.push(mutatedTree as ts.TypeNode);
    }

    // Target: Array Types (T[]) -> Tuple ([T, T])
    if (ts.isArrayTypeNode(node)) {
      const mutatedTree = visitAndMutate(rootType, node, (n) => {
        const elementType = (n as ts.ArrayTypeNode).elementType;
        return ts.factory.createTupleTypeNode([elementType, elementType]);
      });
      mutatedNodes.push(mutatedTree as ts.TypeNode);
    }

    ts.forEachChild(node, findTargets);
  };

  findTargets(rootType);
  return mutatedNodes;
}

/**
 * Parses a fuzzed parameter string (e.g., "a: string | number, b?: { id: string }")
 * and returns an array of literal string arguments (e.g., ["'mock'", "{ id: 'mock' }"])
 */
export function generateClientArguments(fuzzedParams: string): string[] {
  if (!fuzzedParams || !fuzzedParams.trim()) return [];

  // 1. Wrap the fuzzed string in a dummy function so the TS parser can read it
  const code = `function foo(${fuzzedParams}) {}`;
  const sourceFile = ts.createSourceFile(
    "dummy.ts",
    code,
    ts.ScriptTarget.Latest,
    true,
  );

  // 2. Extract the parameter declarations from the AST
  let params: ts.ParameterDeclaration[] = [];
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node)) {
      params = Array.from(node.parameters);
    }
  });

  // 3. Map each parameter to a mock value
  const args: string[] = [];
  for (const param of params) {
    if (param.type) {
      const isRest = !!param.dotDotDotToken;
      let mockValue = generateMockValue(param.type);

      // If it's a rest parameter (e.g. ...args: string[]), the mockValue will be an array string "[mock]".
      // We need to spread it in the function call.
      if (isRest) {
        mockValue = `...${mockValue}`;
      }
      args.push(mockValue);
    } else {
      args.push("null");
    }
  }

  return args;
}

/**
 * Recursively walks the TS TypeNode AST to build a valid JS value string
 */
function generateMockValue(typeNode: ts.TypeNode): string {
  // Primitives - check the kind directly instead of using a type guard
  switch (typeNode.kind) {
    case ts.SyntaxKind.StringKeyword:
      return '"mock_string"';
    case ts.SyntaxKind.NumberKeyword:
      return "42";
    case ts.SyntaxKind.BooleanKeyword:
      return "true";
    case ts.SyntaxKind.BigIntKeyword:
      return "100n";
  }

  // Arrays (e.g., string[]) -> ["mock_string"]
  if (ts.isArrayTypeNode(typeNode)) {
    return `[${generateMockValue(typeNode.elementType)}]`;
  }

  // Unions (e.g., A | B) -> Just satisfy the left side of the union
  if (ts.isUnionTypeNode(typeNode)) {
    return generateMockValue(typeNode.types[0]);
  }

  // Intersections (e.g., A & B) -> Merge the objects using Object.assign
  if (ts.isIntersectionTypeNode(typeNode)) {
    const parts = typeNode.types.map((t) => generateMockValue(t));
    // E.g., Object.assign({}, { a: "mock" }, { b: 42 })
    return `Object.assign({}, ${parts.join(", ")})`;
  }

  // Object Literals (e.g., { id: string, valid: boolean })
  if (ts.isTypeLiteralNode(typeNode)) {
    const props = typeNode.members
      .map((member) => {
        if (ts.isPropertySignature(member) && member.type) {
          const name = member.name.getText();
          const val = generateMockValue(member.type);
          return `${name}: ${val}`;
        }
        return "";
      })
      .filter(Boolean);
    return `{ ${props.join(", ")} }`;
  }

  // Classes/Type References (e.g., Error, Date)
  if (ts.isTypeReferenceNode(typeNode)) {
    const name = typeNode.typeName.getText();

    // Check if it's the generic Array<T> syntax
    if (
      name === "Array" &&
      typeNode.typeArguments &&
      typeNode.typeArguments.length > 0
    ) {
      const innerType = typeNode.typeArguments[0];
      return `[${generateMockValue(innerType)}]`;
    }

    if (name === "Error") return "new Error('mock error')";
    if (name === "Date") return "new Date()";
  }

  return "null"; // Fallback
}

/**
 * Parses a function declaration, safely renames all of its parameters,
 * and returns the mutated function string.
 */
export function renameFunctionParameters(declaration: string): string {
  const sourceFile = ts.createSourceFile(
    "dummy.ts",
    declaration,
    ts.ScriptTarget.Latest,
    true,
  );

  const transformer =
    <T extends ts.Node>(context: ts.TransformationContext) =>
    (rootNode: T) => {
      function visit(node: ts.Node): ts.Node {
        // If the node is a Parameter and has a standard Identifier name (e.g., 'a')
        if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
          // Create a new name identifier (e.g., 'a' -> 'a_renamed')
          const newName = ts.factory.createIdentifier(
            node.name.text + "_renamed",
          );

          return ts.factory.updateParameterDeclaration(
            node,
            node.modifiers,
            node.dotDotDotToken,
            newName,
            node.questionToken,
            node.type,
            node.initializer,
          );
        }
        return ts.visitEachChild(node, visit, context);
      }
      return ts.visitNode(rootNode, visit) as T;
    };

  const result = ts.transform(sourceFile, [transformer]);
  const transformedSourceFile = result.transformed[0] as ts.SourceFile;

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const v2Declaration = printer.printNode(
    ts.EmitHint.Unspecified,
    transformedSourceFile,
    sourceFile,
  );

  result.dispose(); // Free up memory
  return v2Declaration;
}

export function isValidV2Type(
  fuzzedType: string,
  baseEntityCode: string,
): boolean {
  // Wrap the fuzzed type in a file with the BaseEntity
  const code = `${baseEntityCode}\n export type FuzzedV2 = ${fuzzedType};`;

  const sourceFile = ts.createSourceFile(
    "dummy.ts",
    code,
    ts.ScriptTarget.ES2022,
    true,
  );

  // Create an in-memory compiler host to check for semantic errors
  // Create an in-memory compiler host with the correct modern Node flags
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, // Fixes the undici-types error
    skipLibCheck: true, // Stops it from checking node_modules!
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);

  // Override getSourceFile to serve our in-memory string
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (fileName === "dummy.ts") return sourceFile;
    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };

  const program = ts.createProgram(["dummy.ts"], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  // If there are any errors (length > 0), the fuzzer generated invalid TS
  return diagnostics.length === 0;
}
