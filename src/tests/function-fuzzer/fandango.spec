<func> ::= <modifiers> 'function ' <name> '(' <params> ')' ': ' <data_type> ' {}'
<modifiers> ::= ('export ' ('default ')?)? ('async ')?

<params> ::= <req_group> | <opt_group> | <rest_group> | ''
<req_group> ::= <req_param> (', ' <req_group> | ', ' <opt_group> | ', ' <rest_group>)?
<opt_group> ::= <opt_param> (', ' <opt_group> | ', ' <rest_group>)?
<rest_group> ::= <rest_param>

<req_param> ::= <name> ': ' <data_type>
<opt_param> ::= <name> '?: ' <data_type>
<rest_param> ::= '...' <name> ': Array<' <data_type> '>'

<name> ::= <ascii_uppercase_letter><ascii_lowercase_letter>+


# 1. Top level
<data_type> ::= <base_type> | <array_type> | <union_type> | <intersection_type> | <mixed_type>

<base_type> ::= <primitive_type> | <object_type> | <class_type>

<primitive_type> ::= 'string' | 'number' | 'boolean' | 'bigint'
<object_type> ::= '{ ' <object_props> ' }'
<object_props> ::= <object_prop> | <object_prop> ', ' <object_props>
<object_prop> ::= <name> ': ' <primitive_type>
<class_type> ::= 'Error' | 'Date'
<array_type> ::= <base_type> '[]'

# 2. Simple Unions and Intersections (1 level deep)
<union_type> ::= <base_type> ' | ' <base_type> | <base_type> ' | null' | <base_type> ' | undefined'
<intersection_type> ::= <object_type> ' & ' <object_type> | <class_type> ' & ' <object_type>

# 3. The Mixed Types (2 levels deep max)
# This allows combining them without recursive infinite loops
<mixed_type> ::= <union_intersection> | <intersection_union>

# e.g., (string | number) & { id: string }
<union_intersection> ::= '(' <union_type> ') & ' <object_type> | '(' <union_type> ') & ' <class_type>

# e.g., (Error & { code: number }) | undefined
<intersection_union> ::= '(' <intersection_type> ') | ' <base_type> | '(' <intersection_type> ') | null' | '(' <intersection_type> ') | undefined'