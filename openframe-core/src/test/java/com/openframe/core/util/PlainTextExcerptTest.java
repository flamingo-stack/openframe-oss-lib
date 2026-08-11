package com.openframe.core.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class PlainTextExcerptTest {

    @Nested
    class Sanitize {

        @Test
        void shouldReturnNullForNullBlankAndMarkupOnlyInput() {
            assertThat(PlainTextExcerpt.sanitize(null)).isNull();
            assertThat(PlainTextExcerpt.sanitize("   \n\t ")).isNull();
            assertThat(PlainTextExcerpt.sanitize("<br/>")).isNull();
            assertThat(PlainTextExcerpt.sanitize("---")).isNull();
        }

        @Test
        void shouldStripEmphasisMarkers() {
            assertThat(PlainTextExcerpt.sanitize("**bold** and _italic_ and ~~struck~~"))
                    .isEqualTo("bold and italic and struck");
        }

        @Test
        @DisplayName("nested emphasis needs both passes: **_x_** must not leave a stray underscore")
        void shouldStripNestedEmphasis() {
            assertThat(PlainTextExcerpt.sanitize("**_bold italic_**")).isEqualTo("bold italic");
            assertThat(PlainTextExcerpt.sanitize("***everything***")).isEqualTo("everything");
        }

        @Test
        void shouldNotTreatIntraWordUnderscoresAsEmphasis() {
            assertThat(PlainTextExcerpt.sanitize("run_the_script finished")).isEqualTo("run_the_script finished");
        }

        @Test
        void shouldKeepLinkTextAndDropTheTarget() {
            assertThat(PlainTextExcerpt.sanitize("see [the runbook](https://example.com/rb?a=1)"))
                    .isEqualTo("see the runbook");
            assertThat(PlainTextExcerpt.sanitize("[the runbook][ref]")).isEqualTo("the runbook");
            assertThat(PlainTextExcerpt.sanitize("mail <mailto:ops@example.com> now"))
                    .isEqualTo("mail mailto:ops@example.com now");
        }

        @Test
        void shouldKeepImageAltTextWithoutAStrayBang() {
            assertThat(PlainTextExcerpt.sanitize("![disk chart](https://example.com/c.png) attached"))
                    .isEqualTo("disk chart attached");
        }

        @Test
        void shouldStripInlineAndFencedCode() {
            assertThat(PlainTextExcerpt.sanitize("run `df -h` first")).isEqualTo("run df -h first");
            assertThat(PlainTextExcerpt.sanitize("before\n```\nrm -rf /\n```\nafter"))
                    .isEqualTo("before after");
        }

        @Test
        void shouldStripHtmlTags() {
            assertThat(PlainTextExcerpt.sanitize("<p>disk <b>full</b> on <i>web-01</i></p>"))
                    .isEqualTo("disk full on web-01");
        }

        @Test
        void shouldStripHeadingsAtLineStartAndMidLine() {
            assertThat(PlainTextExcerpt.sanitize("## Summary\nDisk is full")).isEqualTo("Summary Disk is full");
            assertThat(PlainTextExcerpt.sanitize("Summary\n===\nDisk is full")).isEqualTo("Summary Disk is full");
            assertThat(PlainTextExcerpt.sanitize("done ### next steps")).isEqualTo("done next steps");
        }

        @Test
        void shouldKeepHashesThatAreNotHeadings() {
            assertThat(PlainTextExcerpt.sanitize("closed ticket #1234")).isEqualTo("closed ticket #1234");
        }

        @Test
        void shouldStripBlockquoteAndListMarkers() {
            assertThat(PlainTextExcerpt.sanitize("> quoted\n- one\n- two\n1. three"))
                    .isEqualTo("quoted one two three");
        }

        @Test
        @DisplayName("newlines collapse to spaces — these render as a single preview line")
        void shouldCollapseAllWhitespaceIncludingCrlf() {
            assertThat(PlainTextExcerpt.sanitize("first\r\n\r\nsecond   third\tfourth "))
                    .isEqualTo("first second third fourth");
        }

        @Test
        void shouldLeavePlainTextUntouched() {
            assertThat(PlainTextExcerpt.sanitize("Printer offline at front desk"))
                    .isEqualTo("Printer offline at front desk");
        }
    }

    @Nested
    class Excerpt {

        @Test
        void shouldPassThroughWhenWithinBudget() {
            assertThat(PlainTextExcerpt.excerpt("exactly ten", 11)).isEqualTo("exactly ten");
            assertThat(PlainTextExcerpt.excerpt("short", 200)).isEqualTo("short");
            assertThat(PlainTextExcerpt.excerpt(null, 200)).isNull();
        }

        @Test
        void shouldTruncateOnAWordBoundaryAndNeverExceedTheBudget() {
            String excerpt = PlainTextExcerpt.excerpt("the quick brown fox jumps", 16);
            assertThat(excerpt).isEqualTo("the quick brown…");
            assertThat(excerpt).hasSizeLessThanOrEqualTo(16);
        }

        @Test
        @DisplayName("one char over the budget still truncates; one under does not")
        void shouldHandleTheBoundaryExactly() {
            assertThat(PlainTextExcerpt.excerpt("aaa bbb", 7)).isEqualTo("aaa bbb");
            assertThat(PlainTextExcerpt.excerpt("aaa bbbb", 7)).isEqualTo("aaa…");
        }

        @Test
        void shouldCutAnOverlongSingleWordRatherThanDropIt() {
            assertThat(PlainTextExcerpt.excerpt("supercalifragilistic", 10)).isEqualTo("supercali…");
        }

        @Test
        void shouldDropTrailingPunctuationBeforeTheEllipsis() {
            assertThat(PlainTextExcerpt.excerpt("see the log, then retry", 15)).isEqualTo("see the log…");
        }

        @Test
        void shouldNotSplitASurrogatePair() {
            String excerpt = PlainTextExcerpt.excerpt("ok 👍🏽👍🏽👍🏽👍🏽👍🏽", 8);
            assertThat(excerpt).endsWith(PlainTextExcerpt.ELLIPSIS);
            assertThat(excerpt.codePoints()).allMatch(Character::isDefined);
            assertThat(Character.isHighSurrogate(excerpt.charAt(excerpt.length() - 2))).isFalse();
        }

        @Test
        void shouldSanitizeAndExcerptInOneStep() {
            assertThat(PlainTextExcerpt.sanitizeAndExcerpt("**the quick** brown fox jumps", 16))
                    .isEqualTo("the quick brown…");
        }
    }

    @Nested
    class ExcerptToBytes {

        @Test
        void shouldPassThroughWhenWithinBudget() {
            assertThat(PlainTextExcerpt.excerptToBytes("short", 100)).isEqualTo("short");
            assertThat(PlainTextExcerpt.excerptToBytes(null, 100)).isNull();
        }

        @Test
        void shouldMeasureInBytesNotChars() {
            // 10 chars, 20 UTF-8 bytes — a char-budget of 20 would not truncate, a byte-budget must.
            String cyrillic = "тестируем ";
            assertThat(cyrillic).hasSize(10);
            assertThat(cyrillic.getBytes(StandardCharsets.UTF_8)).hasSize(19);

            String excerpt = PlainTextExcerpt.excerptToBytes(cyrillic + "дальше", 20);
            assertThat(excerpt.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(20);
            assertThat(excerpt).endsWith(PlainTextExcerpt.ELLIPSIS);
        }

        @Test
        void shouldTruncateOnAWordBoundary() {
            assertThat(PlainTextExcerpt.excerptToBytes("the quick brown fox", 16)).isEqualTo("the quick…");
        }

        @Test
        void shouldNeverSplitAMultiByteCodePoint() {
            String excerpt = PlainTextExcerpt.excerptToBytes("👍🏽👍🏽👍🏽👍🏽", 12);
            assertThat(excerpt.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(12);
            assertThat(new String(excerpt.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8))
                    .isEqualTo(excerpt);
        }
    }
}
