/**
 * @typedef {import('micromark-util-types').Construct} Construct
 * @typedef {import('micromark-util-types').Exiter} Exiter
 * @typedef {import('micromark-util-types').State} State
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Tokenizer} Tokenizer
 * @typedef {import('micromark-util-types').Extension} Extension
 */

import { codes, constants, types } from "micromark-util-symbol";
import { ok as assert } from "devlop";
import { markdownLineEnding, markdownSpace } from "micromark-util-character";
import { factorySpace } from "micromark-factory-space";
import { blankLine } from "micromark-core-commonmark";

/** @type {Construct} */
const tabbedConstruct = {
  name: "pymdownTabbed",
  tokenize: tabbedTokenizeStart,
  continuation: {
    tokenize: tabbedTokenizeContinuation,
  },
  exit: tabbedTokenizeExit,
};

/** @type {Construct} */
const indentConstruct = { tokenize: tokenizeIndent, partial: true };

/**
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
function tabbedTokenizeStart(effects, ok, nok) {
  const self = this;
  const tail = self.events[self.events.length - 1];

  let initialSize =
    tail && tail[1].type === types.linePrefix
      ? tail[2].sliceSerialize(tail[1], true).length
      : 0;

  /**
   * ```markdown
   * > | ===! "C++"
   *     ^^^ <- count
   * ```
   */
  let matchedEqCount = 0;

  /**
   * ```markdown
   * > | ===! "C++"
   *        ^
   * ```
   *
   * Could be "", "+", "!", "+!" or "!+".
   */
  let extraFlags = "";

  return start;

  /**
   * Start of a tab.
   *
   * ```markdown
   * > | === "C++"
   *     ^
   * > | More Content
   * ```
   *
   * @type {State}
   */
  function start(code) {
    assert(code === codes.equalsTo, "code must be `=`.");
    effects.enter("pymdownTabbed");
    return before(code);
  }

  /**
   * Match equal signs.
   *
   * ```markdown
   * > | === "C++"
   *     ^^^
   * > |     More Content
   * ```
   *
   * @type {State}
   */
  function before(code) {
    /**
     * ```markdown
     * > | === "C++"
     *      ^ <- count
     * ```
     */
    if (code === codes.equalsTo) {
      // ===+=
      if (extraFlags !== "") {
        return nok(code);
      }
      matchedEqCount++;
      effects.consume(code);
      return before;
    }

    /**
     * ```markdown
     * > | ==== "C++"
     *         ^ here but matchedEqCount != 3
     * ```
     */
    if (matchedEqCount !== 3) {
      return nok(code);
    }

    /**
     * ```markdown
     * > | ===+ "C++"
     *        ^
     * ```
     */
    if (code === codes.plusSign) {
      if (extraFlags === "" || extraFlags === "!") {
        if (extraFlags === "") {
          effects.enter("pymdownTabbedFlag", {
            contentType: constants.contentTypeString,
          });
        }
        extraFlags += "+";
        effects.consume(code);
        return before;
      } else {
        return nok(code);
      }
    }

    /**
     * ```markdown
     * > | ===! "C++"
     *        ^
     * ```
     */
    if (code === codes.exclamationMark) {
      if (extraFlags === "" || extraFlags === "+") {
        if (extraFlags === "") {
          effects.enter("pymdownTabbedFlag", {
            contentType: constants.contentTypeString,
          });
        }
        extraFlags += "!";
        effects.consume(code);
        return before;
      } else {
        return nok(code);
      }
    }

    if (extraFlags !== "") {
      effects.exit("pymdownTabbedFlag");
    }

    /**
     * ```markdown
     * > | === "C++"
     *        ^ once or more
     * ```
     */
    if (markdownSpace(code)) {
      return factorySpace(effects, tabTitleBefore, types.whitespace)(code);
    }

    return nok(code);
  }

  /**
   * ```markdown
   * > | === "C++"
   *         ^
   * > |     More Content
   * ```
   *
   * @type {State}
   */
  function tabTitleBefore(code) {
    if (code === codes.quotationMark) {
      effects.consume(code);
      effects.enter("pymdownTabbedTitle", {
        contentType: constants.contentTypeString,
      });
      return tabTitleInside;
    }
    return nok(code);
  }

  /**
   * Match tab title.
   *
   * ```markdown
   * > | === "C++"
   *          ^^^
   * ```
   *
   * @type {State}
   *
   * @warning
   * Note that the behavior of parsing tab title is
   * different from pymdown.
   *
   * Current:
   *
   * ```markdown
   * > | === "C++"another"
   *          ^^^^ // nok
   * ```
   *
   * Pymdown:
   *
   * ```markdown
   * > | === "C++"another"
   *          ^^^^^^^^^^^
   * ```
   */
  function tabTitleInside(code) {
    if (code === codes.quotationMark) {
      effects.exit("pymdownTabbedTitle");
      effects.consume(code);
      return tabTitleAfter;
    }
    effects.consume(code);
    return tabTitleInside;
  }

  /**
   * ```markdown
   * > | === "C++"
   *             ^^^^ (optional trailing spaces)
   * ```
   *
   * @type {State}
   */
  function tabTitleAfter(code) {
    // it has no content
    if (code === codes.eof) {
      return nok(code);
    }

    if (!markdownLineEnding(code)) {
      // only trailing spaces is allowed.
      if (!markdownSpace(code)) {
        return nok(code);
      }
      effects.consume(code);
      return tabTitleAfter;
    }

    assert(self.containerState, "expected state");
    self.containerState.size = initialSize + constants.tabSize;
    return ok;
  }
}

/**
 * @type {Tokenizer}
 * @this {TokenizeContext}
 */
function tabbedTokenizeContinuation(effects, ok, nok) {
  const self = this;

  assert(self.containerState, "expected state");
  self.containerState._closeFlow = undefined;

  return effects.check(blankLine, onBlank, notBlank);

  /**
   * ```markdown
   * > | === "C++"[EOL]
   * > | [EOL]
   *     ^^^^^
   * > |     Content
   * ```
   *
   * And check next line.
   *
   * @type {State}
   */
  function onBlank(code) {
    assert(self.containerState, "expected state");
    assert(typeof self.containerState.size === "number", "expected size");

    return factorySpace(
      effects,
      ok,
      types.listItemIndent,
      self.containerState.size + 1
    )(code);
  }

  /** @type {State} */
  function notBlank(code) {
    assert(self.containerState, "expected state");
    if (!markdownSpace(code)) {
      /**
       * ```markdown
       * > | === "C++"[EOL]
       * > |     ...Content in Tabbed[EOL]
       * > | Content
       *     ^ not space
       * ```
       */
      return notInCurrentItem(code);
    }

    /**
     * ```markdown
     * > | === "C++"[EOL]
     * > |     ...Content in Tabbed[EOL]
     *     ^ is space
     * ```
     *
     * check indent.
     */
    return effects.attempt(indentConstruct, ok, notInCurrentItem)(code);
  }

  /** @type {State} */
  function notInCurrentItem(code) {
    assert(self.containerState, "expected state");
    // While we do continue, we signal that the flow should be closed.
    self.containerState._closeFlow = true;
    // As we’re closing flow, we’re no longer interrupting.
    self.interrupt = undefined;
    // Always populated by defaults.
    assert(
      self.parser.constructs.disable.null,
      "expected `disable.null` to be populated"
    );

    return factorySpace(
      effects,
      // check next tab
      effects.attempt(tabbedConstruct, ok, nok),
      types.linePrefix,
      self.parser.constructs.disable.null.includes("codeIndented")
        ? undefined
        : constants.tabSize
    )(code);
  }
}

/**
 * @type {Tokenizer}
 * @this {TokenizeContext}
 */
function tokenizeIndent(effects, ok, nok) {
  const self = this;

  assert(self.containerState, "expected state");
  assert(typeof self.containerState.size === "number", "expected size");

  return factorySpace(
    effects,
    afterPrefix,
    types.listItemIndent,
    self.containerState.size + 1
  );

  /** @type {State} */
  function afterPrefix(code) {
    assert(self.containerState, "expected state");

    /**
     * ```markdown
     * > | === "C++"
     * > |     content
     *     ^^^^ (indent)
     * ```
     */
    const tail = self.events[self.events.length - 1];
    return tail &&
      tail[1].type === types.listItemIndent &&
      tail[2].sliceSerialize(tail[1], true).length === self.containerState.size
      ? ok(code)
      : nok(code);
  }
}

/**
 * @type {Exiter}
 * @this {TokenizeContext}
 */
function tabbedTokenizeExit(effect) {
  assert(this.containerState, "expected state");
  assert(typeof this.containerState.type === "string", "expected type");

  effect.exit("pymdownTabbed");
}

/**
 * @returns {Extension}
 */
export function pymdownTabbed() {
  /** @type {Construct} */
  const tokenizer = tabbedConstruct;

  return {
    document: {
      [codes.equalsTo]: tokenizer,
    },
  };
}
