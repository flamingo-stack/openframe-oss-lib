package com.openframe.data.nats.rmm.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

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
    @DisplayName("the bug: a single combined '-Name value' entry splits into two argv tokens")
    void combinedNamedArgIsSplit() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("-B2Bucket BGCSouthVancouverIsland")))
                .containsExactly("-B2Bucket", "BGCSouthVancouverIsland");
    }

    @Test
    @DisplayName("already-tokenized list is untouched (each space-free element passes through 1:1)")
    void alreadyTokenizedUnchanged() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("-B2Bucket", "BGCSouthVancouverIsland")))
                .containsExactly("-B2Bucket", "BGCSouthVancouverIsland");
    }

    @Test
    @DisplayName("multiple entries are each tokenized and flattened")
    void multipleEntriesFlattened() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("-A 1", "-B 2")))
                .containsExactly("-A", "1", "-B", "2");
    }

    @Test
    @DisplayName("double quotes keep a spaced value as one token, quotes stripped")
    void doubleQuotedValueStaysOneToken() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("-Path \"C:\\Program Files\\App\"")))
                .containsExactly("-Path", "C:\\Program Files\\App");
    }

    @Test
    @DisplayName("single quotes group the same way")
    void singleQuotedValueStaysOneToken() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("-Name 'hello world'")))
                .containsExactly("-Name", "hello world");
    }

    @Test
    @DisplayName("quote adjacent to text forms one token: -Path=\"C:\\Program Files\"")
    void quoteAdjacentToTextJoins() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("-Path=\"C:\\Program Files\"")))
                .containsExactly("-Path=C:\\Program Files");
    }

    @Test
    @DisplayName("backslash is an ordinary char — a bare Windows path is untouched")
    void backslashNotAnEscape() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("C:\\Windows\\System32")))
                .containsExactly("C:\\Windows\\System32");
    }

    @Test
    @DisplayName("runs of whitespace collapse; leading/trailing trimmed")
    void collapsesWhitespace() {
        assertThat(ScriptArgsTokenizer.tokenize(List.of("  -A    1  ")))
                .containsExactly("-A", "1");
    }

    @Test
    @DisplayName("null and all-whitespace/blank elements contribute nothing")
    void nullAndBlankElementsDropped() {
        assertThat(ScriptArgsTokenizer.tokenize(Arrays.asList("-A 1", null, "   ", "")))
                .containsExactly("-A", "1");
    }
}
