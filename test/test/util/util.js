/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

goog.provide('shaka.test.StatusPromise');
goog.provide('shaka.test.Util');


/**
 * @extends {Promise}
 */
shaka.test.StatusPromise = class {
  /**
   * @param {!Promise} p
   * @return {!Object}
   */
  constructor(p) {
    /** @type {string} */
    this.status;

    // TODO: investigate using PromiseMock for this when possible.
    p.status = 'pending';
    p.then(() => {
      p.status = 'resolved';
    }, () => {
      p.status = 'rejected';
    });
    return /** @type {!shaka.test.StatusPromise} */(p);
  }
};

shaka.test.Util = class {
  /**
   * Fakes an event loop. Each tick processes some number of instantaneous
   * operations and advances the simulated clock forward by 1 second. Calls
   * onTick just before each tick if it's specified.
   *
   * @param {number} duration The number of seconds of simulated time.
   * @param {function(number)=} onTick
   */
  static fakeEventLoop(duration, onTick) {
    expect(window.Promise).toBe(PromiseMock);

    // Run this synchronously:
    for (let time = 0; time < duration; ++time) {
      // We shouldn't need more than 6 rounds.
      for (let i = 0; i < 6; ++i) {
        jasmine.clock().tick(0);
        PromiseMock.flush();
      }

      if (onTick) {
        onTick(time);
      }
      jasmine.clock().tick(1000);
      PromiseMock.flush();
    }
  }

  /**
   * Returns a Promise which is resolved after the given delay.
   *
   * @param {number} seconds The delay in seconds.
   * @param {function(function(), number)=} realSetTimeout
   * @return {!Promise}
   */
  static delay(seconds, realSetTimeout) {
    return new Promise(((resolve, reject) => {
      const timeout = realSetTimeout || setTimeout;
      timeout(() => {
        resolve();
        // Play nicely with PromiseMock by flushing automatically.
        if (window.Promise == PromiseMock) {
          PromiseMock.flush();
        }
      }, seconds * 1000.0);
    }));
  }

  /**
   * @param {!shaka.util.Error} error
   * @return {*}
   */
  static jasmineError(error) {
    // NOTE: Safari will add extra properties to any thrown object, and some of
    // the properties we compute in debug builds are unhelpful and introduce
    // inconsistency in tests.  Therefore we only capture the critical fields
    // below.
    const {severity, category, code, data} = error;
    return jasmine.objectContaining({severity, category, code, data});
  }

  /**
   * @param {*} actual
   * @param {!shaka.util.Error} expected
   */
  static expectToEqualError(actual, expected) {
    expect(actual).toEqual(shaka.test.Util.jasmineError(expected));
  }

  /**
   * @param {?} actual
   * @param {!Element} expected
   * @return {!Object} result
   * @private
   */
  static expectToEqualElementCompare_(actual, expected) {
    const diff =
        shaka.test.Util.expectToEqualElementRecursive_(actual, expected);
    const result = {};
    result.pass = diff == null;
    if (result.pass) {
      result.message = 'Expected ' + actual.innerHTML + ' not to match ';
      result.message += expected.innerHTML + '.';
    } else {
      result.message = 'Expected ' + actual.innerHTML + ' to match ';
      result.message += expected.innerHTML + '. ' + diff;
    }
    return result;
  }

  /**
   * @param {?} actual
   * @param {!Node} expected
   * @return {?string} failureReason
   * @private
   */
  static expectToEqualElementRecursive_(actual, expected) {
    const prospectiveDiff = 'The difference was in ' +
        (actual.outerHTML || actual.textContent) + ' vs ' +
        (expected['outerHTML'] || expected.textContent) + ': ';

    if (!(actual instanceof Element) && !(expected instanceof Element)) {
      // Compare them as nodes.
      if (actual.textContent != expected.textContent) {
        return prospectiveDiff + 'Nodes are different.';
      }
    } else if (!(actual instanceof Element) || !(expected instanceof Element)) {
      return prospectiveDiff + 'One is element, one isn\'t.';
    } else {
      // Compare them as elements.
      if (actual.tagName != expected.tagName) {
        return prospectiveDiff + 'Different tagName.';
      }

      if (actual.attributes.length != expected.attributes.length) {
        return prospectiveDiff + 'Different attribute list length.';
      }
      for (let i = 0; i < actual.attributes.length; i++) {
        const aAttrib = actual.attributes[i].nodeName;
        const aAttribVal = actual.getAttribute(aAttrib);
        const eAttrib = expected.attributes[i].nodeName;
        const eAttribVal = expected.getAttribute(eAttrib);
        if (aAttrib != eAttrib || aAttribVal != eAttribVal) {
          const diffNote =
              aAttrib + '=' + aAttribVal + ' vs ' + eAttrib + '=' + eAttribVal;
          return prospectiveDiff + 'Attribute #' + i +
              ' was different (' + diffNote + ').';
        }
      }

      if (actual.childNodes.length != expected.childNodes.length) {
        return prospectiveDiff + 'Different child node list length.';
      }
      for (let i = 0; i < actual.childNodes.length; i++) {
        const aNode = actual.childNodes[i];
        const eNode = expected.childNodes[i];
        const diff =
            shaka.test.Util.expectToEqualElementRecursive_(aNode, eNode);
        if (diff) {
          return diff;
        }
      }
    }

    return null;
  }

  /**
   * Custom comparer for segment references.
   * @param {*} first
   * @param {*} second
   * @return {boolean|undefined}
   */
  static compareReferences(first, second) {
    const isSegment = first instanceof shaka.media.SegmentReference &&
        second instanceof shaka.media.SegmentReference;
    const isInit = first instanceof shaka.media.InitSegmentReference &&
        second instanceof shaka.media.InitSegmentReference;
    if (isSegment || isInit) {
      const a = first.getUris();
      const b = second.getUris();
      if (typeof a !== 'object' || typeof b !== 'object' ||
          typeof a.length != 'number' || typeof b.length !== 'number') {
        return false;
      }
      if (a.length != b.length ||
          !a.every((x, i) => { return x == b[i]; })) {
        return false;
      }
    }
    if (isSegment) {
      return first.position == second.position &&
          first.startTime == second.startTime &&
          first.endTime == second.endTime &&
          first.startByte == second.startByte &&
          first.endByte == second.endByte;
    }
    if (isInit) {
      return first.startByte == second.startByte &&
          first.endByte == second.endByte;
    }
    return undefined;
  }

  /**
   * Fetches the resource at the given URI.
   *
   * @param {string} uri
   * @return {!Promise.<!ArrayBuffer>}
   */
  static fetch(uri) {
    return new Promise(((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', uri, true /* asynchronous */);
      xhr.responseType = 'arraybuffer';

      xhr.onload = (event) => {
        if (xhr.status >= 200 &&
            xhr.status <= 299 &&
            !!xhr.response) {
          resolve(/** @type {!ArrayBuffer} */(xhr.response));
        } else {
          reject(xhr.status);
        }
      };

      xhr.onerror = (event) => {
        reject('shaka.test.Util.fetch failed: ' + uri);
      };

      xhr.send(null /* body */);
    }));
  }

  /**
   * Accepts a mock object (i.e. a simple JavaScript object composed of jasmine
   * spies) and makes it strict.  This means that every spy in the given object
   * will be made to throw an exception by default.
   * @param {!Object} obj
   */
  static makeMockObjectStrict(obj) {
    for (const name in obj) {
      obj[name].and.throwError(new Error(name));
    }
  }

  /**
   * @param {!jasmine.Spy} spy
   * @return {!Function}
   */
  static spyFunc(spy) {
    return spy;
  }

  /**
   * @param {!jasmine.Spy} spy
   * @param {...*} varArgs
   * @return {*}
   */
  static invokeSpy(spy, ...varArgs) {
    return spy(...varArgs);
  }

  /**
   * @param {boolean} loadUncompiled
   * @return {*}
   */
  static async loadShaka(loadUncompiled) {
    /** @type {!shaka.util.PublicPromise} */
    const loaded = new shaka.util.PublicPromise();
    let compiledShaka;
    if (loadUncompiled) {
      // For debugging purposes, use the uncompiled library.
      compiledShaka = shaka;
      loaded.resolve();
    } else {
      // Load the compiled library as a module.
      // All tests in this suite will use the compiled library.
      require(['/base/dist/shaka-player.ui.js'], (shakaModule) => {
        compiledShaka = shakaModule;
        compiledShaka.net.NetworkingEngine.registerScheme(
            'test', shaka.test.TestScheme.plugin);
        compiledShaka.media.ManifestParser.registerParserByMime(
            'application/x-test-manifest',
            shaka.test.TestScheme.ManifestParser);

        loaded.resolve();
      }, (error) => {
        loaded.reject('Failed to load compiled player.');
        shaka.log.error('Error loading compiled player.', error);
      });
    }

    await loaded;
    return compiledShaka;
  }


  /**
   * Wait for the video playhead to move forward by some meaningful delta.
   * If this happens before |timeout| seconds pass, the Promise is resolved.
   * Otherwise, the Promise is rejected.
   *
   * @param {!shaka.util.EventManager} eventManager
   * @param {!HTMLMediaElement} target
   * @param {number} timeout in seconds, after which the Promise fails
   * @return {!Promise}
   */
  static waitForMovementOrFailOnTimeout(eventManager, target, timeout) {
    const waiter = new shaka.test.Waiter(eventManager)
        .timeoutAfter(timeout)
        .failOnTimeout(true);
    return waiter.waitForMovement(target);
  }

  /**
   * @param {!shaka.util.EventManager} eventManager
   * @param {!HTMLMediaElement} target
   * @param {number} playheadTime The time to wait for.
   * @param {number} timeout in seconds, after which the Promise fails
   * @return {!Promise}
   */
  static waitUntilPlayheadReaches(eventManager, target, playheadTime, timeout) {
    const waiter = new shaka.test.Waiter(eventManager)
        .timeoutAfter(timeout)
        .failOnTimeout(true);
    return waiter.waitUntilPlayheadReaches(target, playheadTime);
  }

  /**
   * Wait for the video to end or for |timeout| seconds to pass, whichever
   * occurs first.  The Promise is resolved when either of these happens.
   *
   * @param {!shaka.util.EventManager} eventManager
   * @param {!HTMLMediaElement} target
   * @param {number} timeout in seconds, after which the Promise succeeds
   * @return {!Promise}
   */
  static waitForEndOrTimeout(eventManager, target, timeout) {
    const waiter = new shaka.test.Waiter(eventManager).timeoutAfter(timeout);
    return waiter.waitForEnd(target);
  }
};

/**
 * @const
 * @private
 */
shaka.test.Util.customMatchers_ = {
  // Custom matcher for Element objects.
  toEqualElement: (util, customEqualityTesters) => {
    return {
      compare: shaka.test.Util.expectToEqualElementCompare_,
    };
  },
  // Custom matcher for working with spies.
  toHaveBeenCalledOnceMore: (util, customEqualityTesters) => {
    return {
      compare: (actual, expected) => {
        const callCount = actual.calls.count();

        const result = {};

        if (callCount != 1) {
          result.pass = false;
          result.message = 'Expected to be called once, not ' + callCount;
        } else {
          result.pass = true;
        }

        actual.calls.reset();

        return result;
      },
    };
  },
  toHaveBeenCalledOnceMoreWith: (util, customEqualityTesters) => {
    return {
      compare: (actual, expected) => {
        const callCount = actual.calls.count();
        const callArgs = callCount > 0 ?
                         actual.calls.mostRecent().args :
                         [];

        const result = {};

        if (callCount != 1) {
          result.pass = false;
          result.message = 'Expected to be called once, not ' + callCount;
        } else if (!util.equals(callArgs, expected, customEqualityTesters)) {
          result.pass = false;
          result.message =
              'Expected to be called with ' + expected + ' not ' + callArgs;
        } else {
          result.pass = true;
        }

        actual.calls.reset();

        return result;
      },
    };
  },
};

beforeEach(() => {
  jasmine.addCustomEqualityTester(shaka.test.Util.compareReferences);
  jasmine.addMatchers(shaka.test.Util.customMatchers_);
});
