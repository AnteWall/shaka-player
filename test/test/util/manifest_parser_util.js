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

goog.provide('shaka.test.ManifestParser');


shaka.test.ManifestParser = class {
  /**
   * Verifies the segment references of a stream.
   *
   * @param {?shaka.extern.Stream} stream
   * @param {!Array.<shaka.media.SegmentReference>} references
   */
  static verifySegmentIndex(stream, references) {
    expect(stream).toBeTruthy();
    expect(stream.segmentIndex).toBeTruthy();

    if (references.length == 0) {
      expect(stream.segmentIndex.find(0)).toBe(null);
      return;
    }

    // Even if the first segment doesn't start at 0, this should return the
    // first segment.
    expect(stream.segmentIndex.find(0)).toBe(references[0].position);

    for (const expectedRef of references) {
      // Don't query negative times.  Query 0 instead.
      const startTime = Math.max(0, expectedRef.startTime);
      const position = stream.segmentIndex.find(startTime);
      expect(position).not.toBe(null);
      const actualRef =
          stream.segmentIndex.get(/** @type {number} */ (position));
      // NOTE: A custom matcher for SegmentReferences is installed, so this
      // checks the URIs as well.
      expect(actualRef).toEqual(expectedRef);
    }

    // Make sure that the references stop at the end.
    const lastExpectedReference = references[references.length - 1];
    const positionAfterEnd =
        stream.segmentIndex.find(lastExpectedReference.endTime);
    expect(positionAfterEnd).toBe(null);
    const referencePastEnd =
        stream.segmentIndex.get(lastExpectedReference.position + 1);
    expect(referencePastEnd).toBe(null);
  }

  /**
   * Creates a segment reference using a relative URI.
   *
   * @param {string} uri A relative URI to http://example.com
   * @param {number} position
   * @param {number} start
   * @param {number} end
   * @param {string=} baseUri
   * @param {number=} startByte
   * @param {?number=} endByte
   * @return {!shaka.media.SegmentReference}
   */
  static makeReference(uri, position, start, end, baseUri = '',
      startByte = 0, endByte = null) {
    const getUris = () => [baseUri + uri];
    return new shaka.media.SegmentReference(
        position, start, end, getUris, startByte, endByte);
  }
};
