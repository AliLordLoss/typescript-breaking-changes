include('fandango.spec')

<start> ::= <top_level_transform>

<top_level_transform> ::= <partial> | <required> | <readonly> | <nonnullable> | <conditional> | <base>

<non_recursive_transform> ::= <omit> | <pick> | <base_target>

<partial> ::= 'Partial<' <top_level_transform> '>'
<required> ::= 'Required<' <top_level_transform> '>'
<readonly> ::= 'Readonly<' <top_level_transform> '>'
<nonnullable> ::= 'NonNullable<' <top_level_transform> '>'
<base> ::= <non_recursive_transform> (' & ' <fuzzed_extension>)?

<omit> ::= 'Omit<' <base_target> ', ' <valid_keys> '>'
<pick> ::= 'Pick<' <base_target> ', ' <valid_keys> '>'

<valid_keys> ::= '"id"' | '"name"' | '"metadata"' | '"id" | "name"'
<base_target> ::= 'BaseParam'
<fuzzed_extension> ::= <object_type> | <class_type> | <intersection_type>

<conditional_target> ::= 'any' | 'unknown' | 'BaseParam' | '{ id: string }' | 'Record<string, any>'

<conditional> ::= <top_level_transform> ' extends ' <conditional_target> ' ? ' <top_level_transform> ' : ' <top_level_transform>
