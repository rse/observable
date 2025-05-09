/*
**  @rse/observable - Observable Objects for TypeScript
**  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under MIT license <https://spdx.org/licenses/MIT>
*/

import * as chai from "chai"
import sinon     from "sinon"
import sinonChai from "sinon-chai"

import { observable, isObservable, raw, observer } from "./observable"

const expect = chai.expect
chai.config.includeStack = true
chai.use(sinonChai)

describe("@rse/observable", () => {
    it("exposed API", () => {
        expect(observable).to.be.a("function")
        expect(isObservable).to.be.a("function")
        expect(raw).to.be.a("function")
        expect(observer).to.be.a("function")
    })

    it("basic usage", () => {
        class Foo {}
        const objR = {
            a: true,
            b: 1,
            c: "foo",
            d: { d1: { d2: { d3: "foo" } } },
            e: [ 7, 42, [ 1, 2, 3 ] ],
            f: new Set<number | number[]>([ 7, 42, [ 1, 2, 3 ] ]),
            g: new Map<string, number | number[]>([ [ "g1", 7 ], [ "g2", 42 ], [ "g3", [ 1, 2, 3 ]] ]),
            h: new Uint8Array([ 0x01, 0x02, 0x03 ]),
            i: new Float32Array([ 1.0, 2.0, 3.0 ]),
            j: /foo/,
            k: new Date()
        }

        const objO = observable(objR)
        expect(observable(objO)).to.be.eq(objO)
        expect(raw(objO)).to.be.eq(objR)
        expect(isObservable(objR)).to.be.eq(false)
        expect(isObservable(objO)).to.be.eq(true)

        expect(JSON.stringify(objR)).to.be.deep.equal(JSON.stringify(objO))

        const spy = sinon.spy()
        const o1 = observer(objO, (observation) => {
            spy("observation-1", observation)
        })
        const o2 = observer(objO.d.d1, (observation) => {
            spy("observation-2", observation)
        })
        objO.a = false
        objO.b = 2
        objO.c = "bar"
        objO.d.d1.d2.d3 = "bar"
        delete objO.e[2]
        objO.f.add(7)
        objO.g.set("g4", 0)
        objO.h.fill(0x07, 1, 3)
        objO.h[2] = 0x08
        objO.i[2] = 7

        expect(spy.getCalls().map((call) => call.args)).to.be.deep.equal([
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "a",
                valueNew: false,
                valueOld: true
            } ],
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "b",
                valueNew: 2,
                valueOld: 1
            } ],
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "c",
                valueNew: "bar",
                valueOld: "foo"
            } ],
            [ "observation-2", {
                type:     "change",
                target:   objO.d.d1,
                path:     "d2.d3",
                valueNew: "bar",
                valueOld: "foo"
            } ],
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "d.d1.d2.d3",
                valueNew: "bar",
                valueOld: "foo"
            } ],
            [ "observation-1", {
                type:     "delete",
                target:   objO,
                path:     "e.2",
                valueNew: undefined,
                valueOld: [ 1, 2, 3 ]
            } ],
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "f.*",
                valueNew: 7,
                valueOld: undefined
            } ],
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "g.g4",
                valueNew: 0,
                valueOld: undefined
            } ],
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "h.1",
                valueNew: new Uint8Array([ 7, 7 ]),
                valueOld: new Uint8Array([ 2, 3 ])
            } ],
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "h.2",
                valueNew: 0x08,
                valueOld: 0x07
            } ],
            [ "observation-1", {
                type:     "change",
                target:   objO,
                path:     "i.2",
                valueNew: 7,
                valueOld: 3
            } ]
        ])
    })
})

