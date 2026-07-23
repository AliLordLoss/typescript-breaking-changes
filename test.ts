class Base<T extends NonNullable<Partial<Readonly<{ id: string }>>>> {}

class C<
  T extends NonNullable<Partial<Readonly<{ id: string }>>>,
> extends Base<T> {}

const c = new C();
