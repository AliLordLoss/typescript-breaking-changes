import { FeatureModel } from "../../model";

export const HeritageClauses: FeatureModel = {
  name: "heritageClauses",
  parentRelation: "optional",
  childrenRelation: "or",
  children: [
    {
      name: "extendsHeritageClause",
      parentRelation: "optional",
      children: [
        {
          name: "token",
          parentRelation: "mandatory",
          children: [
            {
              name: "ExtendsKeyword",
            },
          ],
        },

        {
          name: "type",
          parentRelation: "mandatory",
          children: [
            {
              name: "Expression",
            },
          ],
        },
      ],
    },
    {
      name: "implementsHeritageClause",
      parentRelation: "optional",
      children: [
        {
          name: "token",
          parentRelation: "mandatory",
          children: [
            {
              name: "ImplementsKeyword",
            },
          ],
        },
        {
          name: "types",
          parentRelation: "mandatory",
          children: [
            {
              name: "type*",
              parentRelation: "mandatory",
              children: [
                {
                  name: "Expression",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  excludes: [
    [
      "ClassDeclaration.modifiers.export.default",
      "ClassDeclaration.modifiers.declare",
    ],
  ],
};
