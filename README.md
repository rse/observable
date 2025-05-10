
@rse/observable
===============

**Observable Objects for TypeScript**

<p/>
<a href="https://github.com/rse/observable">Github Repository</a> |
<a href="https://npmjs.com/@rse/observable">NPM Distribution</a>

<p/>
<img src="https://nodei.co/npm/@rse/observable.png?downloads=true&stars=true" alt=""/>

[![github (author stars)](https://img.shields.io/github/stars/rse?logo=github&label=author%20stars&color=%233377aa)](https://github.com/rse)
[![github (author followers)](https://img.shields.io/github/followers/rse?label=author%20followers&logo=github&color=%234477aa)](https://github.com/rse)
<br/>
[![npm (project release)](https://img.shields.io/npm/v/@rse/observable?logo=npm&label=npm%20release&color=%23cc3333)](https://npmjs.com/@rse/observable)
[![npm (project downloads)](https://img.shields.io/npm/dm/@rse/observable?logo=npm&label=npm%20downloads&color=%23cc3333)](https://npmjs.com/@rse/observable)

About
-----

This is a small TypeScript library for making a data structure
"observable" in order to let registered "observer" functions called
in case of any modifications to the data structure. The key design
criterias for this library are: simple API, TypeScript type safety, and
support for objects of the standard types Object, Array, Typed Arrays,
Map/WeakMap, and Set/WeakSet.

Installation
------------

```sh
$ npm install --save @rse/observable
```

API
---

```ts
type Observer<T extends object> = {
    pause(): void
    resume(): void
    destroy(): void
};
type Observation<T extends object> = {
    type: "change" | "delete"
    target: T
    path: string
    valueNew: any | undefined
    valueOld: any | undefined
};
type ObservationCallback<T extends object> =
    (observation: Observation<T>) => void

declare function observable<T extends object>(obj: T, strict?: boolean): T
declare function observer<T extends object>(observable: T, callback: ObservationCallback<T>): Observer<T>

declare function isObservable(object: object): boolean
declare function raw<T extends object>(observable: T): T
```

Example
-------

Code:

```ts
import { observable, observer } from "@rse/observable"

const obj = observable({
    a: 1,
    b: { b1: { b2: { b3: "foo" } } },
    c: [ 7, 42, [ 1, 2, 3 ] ],
    d: new Set<number | number[]>([ 7, 42, [ 1, 2, 3 ] ]),
    e: new Map<string, number | number[]>([ [ "g1", 7 ], [ "g2", 42 ], [ "g3", [ 1, 2, 3 ]] ]),
    f: new Uint8Array([ 0x01, 0x02, 0x03 ])
})

observer(obj, (observation) => {
    console.log(observation)
})
observer(obj.b.b1, (observation) => {
    console.log(observation)
})

obj.a = 2
obj.b.b1.b2.b3 = "bar"
delete obj.c[2]
obj.d.add(7)
obj.e.set("g4", 0)
obj.f.fill(0x07, 1, 3)
```

Output:

```txt
{
  type: 'change',
  target: {
    a: 2,
    b: { b1: [Object] },
    c: [ 7, 42, [Array] ],
    d: Set(3) { 7, 42, [Array] },
    e: Map(3) { 'g1' => 7, 'g2' => 42, 'g3' => [Array] },
    f: Uint8Array(3) [ 1, 2, 3 ]
  },
  path: 'a',
  valueNew: 2,
  valueOld: 1
}
{
  type: 'change',
  target: { b2: { b3: 'bar' } },
  path: 'b2.b3',
  valueNew: 'bar',
  valueOld: 'foo'
}
{
  type: 'change',
  target: {
    a: 2,
    b: { b1: [Object] },
    c: [ 7, 42, [Array] ],
    d: Set(3) { 7, 42, [Array] },
    e: Map(3) { 'g1' => 7, 'g2' => 42, 'g3' => [Array] },
    f: Uint8Array(3) [ 1, 2, 3 ]
  },
  path: 'b.b1.b2.b3',
  valueNew: 'bar',
  valueOld: 'foo'
}
{
  type: 'delete',
  target: {
    a: 2,
    b: { b1: [Object] },
    c: [ 7, 42, <1 empty item> ],
    d: Set(3) { 7, 42, [Array] },
    e: Map(3) { 'g1' => 7, 'g2' => 42, 'g3' => [Array] },
    f: Uint8Array(3) [ 1, 2, 3 ]
  },
  path: 'c.2',
  valueNew: undefined,
  valueOld: [ 1, 2, 3 ]
}
{
  type: 'change',
  target: {
    a: 2,
    b: { b1: [Object] },
    c: [ 7, 42, <1 empty item> ],
    d: Set(3) { 7, 42, [Array] },
    e: Map(3) { 'g1' => 7, 'g2' => 42, 'g3' => [Array] },
    f: Uint8Array(3) [ 1, 2, 3 ]
  },
  path: 'd.*',
  valueNew: 7,
  valueOld: undefined
}
{
  type: 'change',
  target: {
    a: 2,
    b: { b1: [Object] },
    c: [ 7, 42, <1 empty item> ],
    d: Set(3) { 7, 42, [Array] },
    e: Map(4) { 'g1' => 7, 'g2' => 42, 'g3' => [Array], 'g4' => 0 },
    f: Uint8Array(3) [ 1, 2, 3 ]
  },
  path: 'e.g4',
  valueNew: 0,
  valueOld: undefined
}
{
  type: 'change',
  target: {
    a: 2,
    b: { b1: [Object] },
    c: [ 7, 42, <1 empty item> ],
    d: Set(3) { 7, 42, [Array] },
    e: Map(4) { 'g1' => 7, 'g2' => 42, 'g3' => [Array], 'g4' => 0 },
    f: Uint8Array(3) [ 1, 7, 7 ]
  },
  path: 'f.1',
  valueNew: Uint8Array(2) [ 7, 7 ],
  valueOld: Uint8Array(2) [ 2, 3 ]
}
```

History
-------

The **@rse/observable** library was implemented in May 2025 for
potential use in the **SpeechFlow** application.

Support
-------

The work on this Open Source Software was financially supported by the
german non-profit organisation *SEA Software Engineering Academy gGmbH*.

See Also
--------

- [mobx](https://www.npmjs.com/package/mobx)
- [zen-observable](https://www.npmjs.com/package/zen-observable)
- [light-observable](https://www.npmjs.com/package/light-observable)
- [observable-slim](https://www.npmjs.com/package/observable-slim)
- [micro-observer](https://www.npmjs.com/package/micro-observer)
- [@cadolabs/observable](https://www.npmjs.com/package/@cadolabs/observable)

License
-------

Copyright &copy; 2025 Dr. Ralf S. Engelschall (http://engelschall.com/)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

