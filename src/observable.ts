/*
**  @rse/observable - Observable Objects for TypeScript
**  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under MIT license <https://spdx.org/licenses/MIT>
*/

/*  type of an observer (return value of "observer" method)  */
type Observer<T extends object> = {
    pause   (): void                   /*  pause  observer triggering  */
    resume  (): void                   /*  resume observer triggering  */
    destroy (): void                   /*  destroy observer  */
}

/*  type of an observation (value of "observer" callbacks)  */
type Observation<T extends object> = {
    type:      "change" | "delete"    /*  type of observation  */
    target:    T                      /*  target proxy object  */
    path:      string                 /*  path to modification element  */
    valueNew:  any | undefined        /*  value of element after  modification  */
    valueOld:  any | undefined        /*  value of element before modification  */
}

/*  type of observation callback  */
type ObservationCallback<T extends object> =
    (observation: Observation<T>) => void

/*  type of observable marker value  */
type ObservableInfo<T extends object> = {
    raw:       T                                    /*  pointer to underlying object  */
    name:      string | symbol                      /*  name of proxy in parent (optional)  */
    parent:    any                                  /*  parent proxy (optional)  */
    callbacks: Set<ObservationCallback<T>>          /*  callbacks of observers  */
    paused:    Map<ObservationCallback<T>, boolean> /*  paused flags of observers */
}

/*  observable map  */
const observableMap = new WeakMap<object, ObservableInfo<any>>()

/*  internal utility function for triggering observers  */
const triggerObserver = <T extends object>(
    type: "change" | "delete", target: T, path: string, valueNew?: any, valueOld?: any
) => {
    /*  determine information context object  */
    const info = observableMap.get(target)
    if (!info)
        throw new Error("internal error: missing information context")

    /*  iterate and call all observer callbacks  */
    for (const callback of info.callbacks.values())
        if (!info.paused.get(callback))
            callback({ type, target, path, valueNew, valueOld })

    /*  recursively trigger observers on parent objects  */
    if (info.parent !== null)
        triggerObserver(type, info.parent,
            `${String(info.name)}.${path}`, valueNew, valueOld) /* RECURSION */
}

/*  internal utility function for making an observable  */
const makeObservable = <T extends object> (obj: T, name: string | symbol, parent: any, strict: boolean): T => {
    /*  sanity check input  */
    if (typeof obj !== "object")
        throw new Error("can convert objects to observables only")

    /*  short-circuit operation  */
    if (observableMap.has(obj))
        return obj

    /*  start with a passed-through "proxy" object  */
    let proxy = obj

    /*  utility function for adding information context object  */
    const addInfo = (proxy: T) => {
        observableMap.set(proxy, {
            raw:       obj,
            name,
            parent,
            callbacks: new Set(),
            paused:    new Map()
        } satisfies ObservableInfo<T>)
    }

    /*  dispatch proxy creation according to target object type  */
    if (obj instanceof Set || obj instanceof WeakSet) {
        /*  Set/WeakSet object  */
        proxy = new Proxy(obj, {
            /*  handle get/read operations  */
            get (target: T, p: string | symbol, receiver: any): any {
                if ((obj instanceof Set && String(p).match(/^(?:add|delete|clear)$/))
                    || (obj instanceof WeakSet && String(p).match(/^(?:add|delete)$/))) {
                    /*  special case of modifying method  */
                    const orig = Reflect.get(target, p, receiver) as (...args: any[]) => unknown
                    const wrapper = function (this: Set<any> | WeakSet<any>, ...args: any[]) {
                        /*  execute original method  */
                        const result = orig.apply(target, args)

                        /*  trigger observers  */
                        if (String(p) === "add")
                            triggerObserver("change", proxy, "*", args[0], undefined)
                        else if (String(p) === "delete")
                            triggerObserver("change", proxy, "*", undefined, args[0])
                        else if (String(p) === "clear")
                            triggerObserver("change", proxy, "*", undefined, undefined)
                        return result
                    }

                    /*  re-bind method to target (Set) instead of receiver (proxy)  */
                    return wrapper.bind(target as Set<any> | WeakSet<any>)
                }
                else {
                    /*  special case of non-modifying method  */
                    const wrapper = Reflect.get(target, p, receiver)
                    if (typeof wrapper === "function")
                        /*  re-bind method to target (Set) instead of receiver (proxy)  */
                        return wrapper.bind(target)
                }
                return Reflect.get(target, p, receiver)
            },

            /*  handle set/assignment operations  */
            set (target: T, p: string | symbol, valueNew: any, receiver: any): boolean {
                const valueOld = Reflect.get(target, p, receiver)
                if (typeof valueNew === "object")
                    if (!isObservable(valueNew))
                        valueNew = makeObservable(valueNew, p, receiver, strict) /* RECURSION */
                const result = Reflect.set(target, p, valueNew, receiver)
                triggerObserver("change", proxy, String(p), valueNew, valueOld)
                return result
            },

            /*  handle delete operations  */
            deleteProperty (target: T, p: string | symbol): boolean {
                return false
            }
        })

        /*  add information context object  */
        addInfo(proxy)

        /*  iterate over content to recursively make contained objects observables, too
            (NOTICE: we cannot iterate over a WeakSet collection)  */
        if (proxy instanceof Set) {
            const items = Array.from(proxy.values())
            for (const item of items) {
                if (typeof item === "object") {
                    proxy.delete(item)
                    proxy.add(makeObservable(item, "", proxy, strict)) /* RECURSION */
                }
            }
        }
    }
    else if (obj instanceof Map || obj instanceof WeakMap) {
        /*  Map/WeakMap object  */
        proxy = new Proxy(obj, {
            /*  handle get/read operations  */
            get (target: T, p: string | symbol, receiver: any): any {
                if ((obj instanceof Map && String(p).match(/^(?:set|delete|clear)$/))
                    || (obj instanceof WeakMap && String(p).match(/^(?:set|delete)$/))) {
                    /*  special case of modifying method  */
                    const orig = Reflect.get(target, p, receiver) as (...args: any[]) => unknown
                    const wrapper = function (this: Map<any, any> | WeakMap<any, any>, ...args: any[]) {
                        /*  remember old value  */
                        let valueOld: unknown
                        if (String(p) === "set") {
                            const getter = Reflect.get(target, "get", receiver) as (...args: any[]) => unknown
                            valueOld = getter.call(target, args[0])
                        }

                        /*  execute original method  */
                        const result = orig.apply(target, args)

                        /*  trigger observers  */
                        if (String(p) === "set")
                            triggerObserver("change", proxy, args[0], args[1], valueOld)
                        else if (String(p) === "delete")
                            triggerObserver("change", proxy, args[0], undefined, args[1])
                        else if (String(p) === "clear")
                            triggerObserver("change", proxy, "*", undefined, undefined)
                        return result
                    }

                    /*  re-bind method to target (Set) instead of receiver (proxy)  */
                    return wrapper.bind(target as Map<any, any> | WeakMap<any, any>)
                }
                else {
                    /*  special case of non-modifying method  */
                    const wrapper = Reflect.get(target, p, receiver)
                    if (typeof wrapper === "function")
                        /*  re-bind method to target (Map) instead of receiver (proxy)  */
                        return wrapper.bind(target)
                }
                return Reflect.get(target, p, receiver)
            },

            /*  handle set/assignment operations  */
            set (target: T, p: string | symbol, valueNew: any, receiver: any): boolean {
                const valueOld = Reflect.get(target, p, receiver)
                if (typeof valueNew === "object")
                    if (!isObservable(valueNew))
                        valueNew = makeObservable(valueNew, p, receiver, strict) /* RECURSION */
                const result = Reflect.set(target, p, valueNew, receiver)
                triggerObserver("change", proxy, String(p), valueNew, valueOld)
                return result
            },

            /*  handle delete operations  */
            deleteProperty (target: T, p: string | symbol): boolean {
                return false
            }
        })

        /*  add information context object  */
        addInfo(proxy)

        /*  iterate over content to recursively make contained objects observables, too
            (NOTICE: we cannot iterate over a WeakMap collection)  */
        if (proxy instanceof Map) {
            const items = Array.from(proxy.entries())
            for (const [ key, item ] of items) {
                if (typeof item === "object") {
                    proxy.delete(key)
                    proxy.set(key, makeObservable(item, key, proxy, strict)) /* RECURSION */
                }
            }
        }
    }
    else if (
           obj instanceof Int8Array
        || obj instanceof Uint8Array
        || obj instanceof Uint8ClampedArray
        || obj instanceof Int16Array
        || obj instanceof Uint16Array
        || obj instanceof Int32Array
        || obj instanceof Uint32Array
        || obj instanceof Float32Array
        || obj instanceof Float64Array
        || obj instanceof BigInt64Array
        || obj instanceof BigUint64Array
    ) {
        /*  Typed Array object  */
        proxy = new Proxy(obj, {
            /*  handle get/read operations  */
            get (target: T, p: string | symbol, receiver: any): any {
                if (String(p).match(/^(?:set|fill|copyWithin|sort|reverse)$/)) {
                    /*  special case of modifying method  */
                    const orig = Reflect.get(target, p, receiver) as (...args: any[]) => unknown
                    const wrapper = function (this: typeof obj, ...args: any[]) {
                        /*  remember old value  */
                        let valueOld:
                            Int8Array |
                            Uint8Array |
                            Uint8ClampedArray |
                            Int16Array |
                            Uint16Array |
                            Int32Array |
                            Uint32Array |
                            Float32Array |
                            Float64Array |
                            BigInt64Array |
                            BigUint64Array |
                            undefined
                        if (String(p) === "set")
                            valueOld = this.slice(args[1], args[0].length)
                        else if (String(p) === "fill")
                            valueOld = this.slice(args[1], args[2])
                        else if (String(p) === "copyWithin")
                            valueOld = this.slice(args[1], args[2])
                        else if (String(p) === "sort")
                            valueOld = this.slice(0)
                        else if (String(p) === "reverse")
                            valueOld = this.slice(0)

                        /*  execute original method  */
                        const result = orig.apply(this, args)

                        /*  trigger observers  */
                        if (String(p) === "set")
                            triggerObserver("change", proxy, args[1], args[0], valueOld)
                        else if (String(p) === "fill")
                            triggerObserver("change", proxy, args[1], this.slice(args[1], args[2]), valueOld)
                        else if (String(p) === "copyWithin")
                            triggerObserver("change", proxy, args[0], this.slice(args[0], args[0] + (args[2] - args[1])), valueOld)
                        else if (String(p) === "sort")
                            triggerObserver("change", proxy, String(0), this, valueOld)
                        else if (String(p) === "reverse")
                            triggerObserver("change", proxy, String(0), this, valueOld)
                        return result
                    }

                    /*  re-bind method to target instead of receiver (proxy)  */
                    return wrapper.bind(target as typeof obj)
                }
                else {
                    /*  special case of non-modifying method  */
                    const wrapper = Reflect.get(target, p, receiver)
                    if (typeof wrapper === "function")
                        /*  re-bind method to target instead of receiver (proxy)  */
                        return wrapper.bind(target)
                }
                return Reflect.get(target, p, receiver)
            },

            /*  handle set/assignment operations  */
            set (target: T, p: string | symbol, valueNew: any, receiver: any): boolean {
                const valueOld = Reflect.get(target, p, receiver)
                if (typeof valueNew === "object")
                    if (!isObservable(valueNew))
                        valueNew = makeObservable(valueNew, p, receiver, strict) /* RECURSION */
                const result = Reflect.set(target, p, valueNew, receiver)
                triggerObserver("change", proxy, String(p), valueNew, valueOld)
                return result
            },

            /*  handle delete operations  */
            deleteProperty (target: T, p: string | symbol): boolean {
                const valueOld = Reflect.get(target, p, target)
                const result = Reflect.deleteProperty(target, p)
                triggerObserver("delete", proxy, String(p), undefined, valueOld)
                return result
            }
        })

        /*  add information context object  */
        addInfo(proxy)

        /*  notice, an UInt8Array contains just Uint8 elements, and hence there is no
            need to iterate over this content in order to recursively make objects observables  */
    }
    else if (obj instanceof Array) {
        /*  Array object  */
        proxy = new Proxy(obj, {
            /*  handle get/read operations  */
            get (target: T, p: string | symbol, receiver: any): any {
                if (String(p).match(/^(?:push|pop|unshift|shift|splice|sort|reverse)$/)) {
                    /*  special case of modifying method  */
                    const orig = Reflect.get(target, p, receiver) as (...args: any[]) => unknown
                    const wrapper = function (this: Array<any>, ...args: any[]) {
                        /*  remember old value  */
                        let valueOld: any
                        if (String(p) === "splice")
                            valueOld = Reflect.get(target, args[0], receiver)

                        /*  execute original method  */
                        const result = orig.apply(target, args)

                        /*  trigger observers  */
                        if (String(p) === "push")
                            triggerObserver("change", proxy, String((proxy as Array<any>).length), args[0], undefined)
                        else if (String(p) === "pop")
                            triggerObserver("change", proxy, String((proxy as Array<any>).length + 1), undefined, result)
                        else if (String(p) === "unshift")
                            triggerObserver("change", proxy, String(0), args[0], undefined)
                        else if (String(p) === "shift")
                            triggerObserver("change", proxy, String(0), undefined, result)
                        else if (String(p) === "splice")
                            triggerObserver("change", proxy, String(args[0]), args[2], valueOld)
                        else if (String(p) === "sort")
                            triggerObserver("change", proxy, "*", undefined, undefined)
                        else if (String(p) === "reverse")
                            triggerObserver("change", proxy, "*", undefined, undefined)
                        return result
                    }

                    /*  re-bind method to target (Array) instead of receiver (proxy)  */
                    return wrapper.bind(target as Array<any>)
                }
                return Reflect.get(target, p, receiver)
            },

            /*  handle set/assignment operations  */
            set (target: T, p: string | symbol, valueNew: any, receiver: any): boolean {
                const valueOld = Reflect.get(target, p, receiver)
                if (typeof valueNew === "object")
                    if (!isObservable(valueNew))
                        valueNew = makeObservable(valueNew, p, receiver, strict) /* RECURSION */
                const result = Reflect.set(target, p, valueNew, receiver)
                triggerObserver("change", proxy, String(p), valueNew, valueOld)
                return result
            },

            /*  handle delete operations  */
            deleteProperty (target: T, p: string | symbol): boolean {
                const valueOld = Reflect.get(target, p, target)
                const result = Reflect.deleteProperty(target, p)
                triggerObserver("delete", proxy, String(p), undefined, valueOld)
                return result
            }
        })

        /*  add information context object  */
        addInfo(proxy)

        /*  iterate over content to recursively make contained objects observables, too  */
        if (proxy instanceof Array)
            for (let i = 0; i < proxy.length; i++)
                if (typeof proxy[i] === "object")
                    proxy[i] = makeObservable(proxy[i], String(i), proxy, strict) /* RECURSION */
    }
    else if (Object.getPrototypeOf(obj) === null || Object.getPrototypeOf(obj) === Object.prototype) {
        /*  regular/plain object  */
        proxy = new Proxy(obj, {
            /*  handle get/read operations  */
            get (target: T, p: string | symbol, receiver: any): any {
                return Reflect.get(target, p, receiver)
            },

            /*  handle set/assignment operations  */
            set (target: T, p: string | symbol, valueNew: any, receiver: any): boolean {
                const valueOld = Reflect.get(target, p, receiver)
                if (typeof valueNew === "object")
                    if (!isObservable(valueNew))
                        valueNew = makeObservable(valueNew, p, receiver, strict) /* RECURSION */
                const result = Reflect.set(target, p, valueNew, receiver)
                triggerObserver("change", proxy, String(p), valueNew, valueOld)
                return result
            },

            /*  handle delete operations  */
            deleteProperty (target: T, p: string | symbol): boolean {
                const valueOld = Reflect.get(target, p, target)
                const result = Reflect.deleteProperty(target, p)
                triggerObserver("delete", proxy, String(p), undefined, valueOld)
                return result
            }
        })

        /*  add information context object  */
        addInfo(proxy)

        /*  iterate over content to recursively make contained objects observables, too  */
        for (const field of Object.keys(proxy))
            if (typeof (proxy as any)[field] === "object")
                (proxy as any)[field] = makeObservable((proxy as any)[field], field, proxy, strict) /* RECURSION */
    }
    else if (obj instanceof Error || obj instanceof Date || obj instanceof RegExp) {
        /*  just pass-through standard object types which can be treated as non-collections  */
    }
    else if (strict)
        throw new Error("unsupported object type detected")
    return proxy
}

/*  API function for making an observable  */
export function observable<T extends object> (obj: T, strict = true): T {
    if (isObservable(obj))
        return obj
    return makeObservable(obj, "", null, strict)
}

/*  API function for checking for an observable  */
export function isObservable (object: object): boolean {
    if (typeof object !== "object")
        throw new Error("argument has to be an object")
    return observableMap.has(object)
}

/*  API function for extracting raw backing object of an observable  */
export function raw<T extends object> (observable: T): T {
    if (!isObservable(observable))
        throw new Error("argument not an observable")
    return observableMap.get(observable)!.raw
}

/*  API function for registering an observer  */
export function observer<T extends object> (observable: T, callback: ObservationCallback<T>): Observer<T> {
    if (!isObservable(observable))
        throw new Error("argument not an observable")
    const info = observableMap.get(observable)!
    if (info.callbacks.has(callback))
        throw new Error("callback already registered for observation")

    /*  store observer callback  */
    info.callbacks.add(callback)
    info.paused.set(callback, false)

    /*  return observer handle  */
    return {
        pause () {
            info.paused.set(callback, true)
        },
        resume () {
            info.paused.set(callback, false)
        },
        destroy () {
            if (!info.callbacks.has(callback))
                throw new Error("callback not or no longer registered for observation")
            info.callbacks.delete(callback)
        }
    } satisfies Observer<T>
}
