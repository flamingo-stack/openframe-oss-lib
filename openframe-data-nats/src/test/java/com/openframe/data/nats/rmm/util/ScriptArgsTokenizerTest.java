package com.openframe.data.nats.rmm.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class ScriptArgsTokenizerTest {

    @Test
    @DisplayName("null in → null out (preserves 'no args')")
    void nullPassthrough() {
        assertThat(ScriptArgsTokenizer.tokenize(null)).isNull();
    }

    @Test
    @DisplayName("empty list → empty list")
    void emptyList() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of())).isEmpty();
    }

    @Test
    @DisplayName("multiple entries are each tokenized and flattened, order preserved (no sorting)")
    void multipleEntriesFlattenedInOrder() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("-C 3", "-A 1", "-B 2")))
                .containsExactly("-C", "3", "-A", "1", "-B", "2");
    }

    @Test
    @DisplayName("mixed entries: bare token, combined named arg with quoted value, single-quoted value")
    void mixedEntries() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("plain", "-K \"v v\"", "'x'")))
                .containsExactly("plain", "-K", "v v", "x");
    }

    @Test
    @DisplayName("null / blank / all-whitespace elements contribute nothing")
    void nullAndBlankElementsDropped() {
        assertThat(ScriptArgsTokenizer.tokenize(Arrays.asList("-A 1", null, "   ", "", "\t\n ")))
                .containsExactly("-A", "1");
    }

    @Test
    @DisplayName("a large already-tokenized list passes through 1:1 (no space-free element is touched)")
    void largeAlreadyTokenizedListUnchanged() {
        List<String> tokens = List.of("-a", "-b", "c", "-d", "e", "--flag", "value", "-x", "y", "z");
        assertThat(ScriptArgsTokenizer.tokenize(tokens))
                .containsExactlyElementsOf(tokens);
    }

    @ParameterizedTest(name = "[{index}] \"{0}\" → {1}")
    @MethodSource("singleElementCases")
    @DisplayName("single-element tokenization across quoting / whitespace / path edge cases")
    void singleElementTokenization(String input, List<String> expected) {
        assertThat(ScriptArgsTokenizer.tokenize(List.of(input)))
                .containsExactlyElementsOf(expected);
    }

    static Stream<Arguments> singleElementCases() {
        return Stream.of(
                // the bug: name+value in one entry splits into two argv tokens
                arguments("-B2Bucket BGCSouthVancouverIsland", List.of("-B2Bucket", "BGCSouthVancouverIsland")),
                // space-free entries pass through unchanged
                arguments("value", List.of("value")),
                arguments("-flag", List.of("-flag")),
                arguments("-Path=C:\\Temp", List.of("-Path=C:\\Temp")),
                // whitespace: tabs and newlines split; runs collapse; leading/trailing trimmed
                arguments("-A\t1\n-B", List.of("-A", "1", "-B")),
                arguments("  -A    1  ", List.of("-A", "1")),
                // double quotes group a spaced value; quotes stripped
                arguments("-Msg \"hello world\" -Flag", List.of("-Msg", "hello world", "-Flag")),
                arguments("\"C:\\Program Files\\App\"", List.of("C:\\Program Files\\App")),
                // single quotes group the same way
                arguments("-Name 'hello world'", List.of("-Name", "hello world")),
                // quote adjacent to text forms one token
                arguments("-Path=\"C:\\Program Files\"", List.of("-Path=C:\\Program Files")),
                arguments("\"-D\" foo", List.of("-D", "foo")),
                // an inner quote can span whitespace within a single joined token
                arguments("a\"b c\"d", List.of("ab cd")),
                // single quotes preserve double quotes literally, and vice-versa
                arguments("'a \"b\" c'", List.of("a \"b\" c")),
                arguments("\"it's fine\"", List.of("it's fine")),
                // two quoted spans in one entry
                arguments("'a b' \"c d\"", List.of("a b", "c d")),
                // spaces inside quotes are preserved verbatim
                arguments("\"  spaced  \"", List.of("  spaced  ")),
                // backslash is an ordinary char (NOT a POSIX escape) — Windows paths survive
                arguments("C:\\Windows\\System32", List.of("C:\\Windows\\System32")),
                // unterminated quote: the remainder of the entry becomes one token
                arguments("-Name 'hello", List.of("-Name", "hello")),
                arguments("-Path \"C:\\unclosed", List.of("-Path", "C:\\unclosed"))
        );
    }

    @Test
    @DisplayName("an explicit empty-quoted entry yields a single empty-string token (intentional empty arg)")
    void emptyQuotesYieldEmptyToken() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("\"\"")))
                .containsExactly("");
    }

    @Test
    @DisplayName("an empty value between real args is preserved: -A \"\" -B → [-A, \"\", -B]")
    void emptyQuotedValueBetweenArgs() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("-A \"\" -B")))
                .containsExactly("-A", "", "-B");
    }

    @Test
    @DisplayName("a lone unmatched quote yields a single empty-string token (documents current behavior)")
    void loneQuoteYieldsEmptyToken() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("'")))
                .containsExactly("");
    }

    @Test
    @DisplayName("NOT idempotent for spaced values — quotes are stripped on the first pass, so a second pass re-splits 'my value'. Tokenization is applied exactly once, at dispatch.")
    void notIdempotentForSpacedValues() {
        List<String> once = ScriptArgsTokenizer.tokenize(List.of("-Bucket 'my value'", "-Flag"));
        assertThat(once).containsExactly("-Bucket", "my value", "-Flag");   // quotes gone after pass 1
        assertThat(ScriptArgsTokenizer.tokenize(once))
                .containsExactly("-Bucket", "my", "value", "-Flag");        // pass 2 would re-split the bare value
    }
}
