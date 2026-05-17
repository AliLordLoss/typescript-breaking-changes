# Test Design

## Usage

We create 2 files - v1, v2
We also create a client that uses the files via invoking the function.

## Design

We test:

- Adding a function
- Removing a function
- Changing a function modifier state
- Changing a parameter - from no parameters; with all operators and with and without a declared type, in all viable function states
- Parameter name change

# Tests

Soon we found out that the states with no export in the modifiers always lead to BCs.
This means that any change on a function with no export is not a BC.
Also, changing a function to not have an export is a BC.
Finally this dropped our testable states from 6 to 4 (discarding no modifiers and async modifier states)

We reach 120 tests and 52 BCs.

# Analysis

- Adding a function is not a BC
- Removing a function is a BC
- Adding and removing the default modifier is a BC
- Adding and removing the async modifier is a BC since it adds the Promise type to the return type. Consult with types if there are exceptions to that rule.
  - Note - this change is not breaking here, but in the types testing. Since we are not testing for types here, we are infering the knowledge here.
- Changing parameter names is not a BC
- Changing parameter modifiers (and adding/removing):
  - Changing from a dotdotdot modifier is always a BC.
  - Changing from an initializer is a BC iff the parameter is removed or there is no modifier. If there is a question mark or a dotdotdotdot, it is not a BC.
  - Changing from no operator is a BC only if the parameter is removed.
  - Changing from no parameter is a BC only if changed to an operator with no operators. Adding a parameter with dotdotdot, questionmark or initializer is not a BC.
  - Changing from a question mark is a BC iff parameter is removed or changed to have no operator. It is not a BC if changed to a dotdotdot or an initializer.
- Removing export is a BC
