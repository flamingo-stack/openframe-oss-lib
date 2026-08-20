package com.openframe.core.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class PlainTextTest {

    @Nested
    class Sanitize {

        @Test
        void shouldReturnNullForNullBlankAndMarkupOnlyInput() {
            assertThat(PlainText.sanitize(null)).isNull();
            assertThat(PlainText.sanitize("   \n\t ")).isNull();
            assertThat(PlainText.sanitize("<br/>")).isNull();
        }

        @Test
        void shouldStripEmphasisMarkers() {
            assertThat(PlainText.sanitize("**bold** and _italic_ and ~~struck~~"))
                    .isEqualTo("bold and italic and struck");
        }

        @Test
        void shouldStripUniformEmphasis() {
            assertThat(PlainText.sanitize("***everything***")).isEqualTo("everything");
        }

        @Test
        @DisplayName("web-client parity: one emphasis pass, so the inner pair of **_x_** survives")
        void shouldLeaveInnerMarkersOfNestedEmphasis() {
            assertThat(PlainText.sanitize("**_bold italic_**")).isEqualTo("_bold italic_");
        }

        @Test
        @DisplayName("web-client parity: no intra-word guard, so underscores inside an identifier are eaten")
        void shouldTreatIntraWordUnderscoresAsEmphasis() {
            assertThat(PlainText.sanitize("run_the_script finished")).isEqualTo("runthescript finished");
        }

        @Test
        void shouldKeepLinkTextAndDropTheTarget() {
            assertThat(PlainText.sanitize("see [the runbook](https://example.com/rb?a=1)"))
                    .isEqualTo("see the runbook");
        }

        @Test
        @DisplayName("web-client parity: reference links have no rule, so they pass through verbatim")
        void shouldLeaveReferenceLinksAlone() {
            assertThat(PlainText.sanitize("[the runbook][ref]")).isEqualTo("[the runbook][ref]");
        }

        @Test
        @DisplayName("web-client parity: an autolink is an angle-bracket tag, so the URL goes with it")
        void shouldDropAutolinksEntirely() {
            assertThat(PlainText.sanitize("mail <mailto:ops@example.com> now")).isEqualTo("mail now");
        }

        @Test
        void shouldKeepImageAltTextWithoutAStrayBang() {
            assertThat(PlainText.sanitize("![disk chart](https://example.com/c.png) attached"))
                    .isEqualTo("disk chart attached");
        }

        @Test
        @DisplayName("web-client parity: code fences are unwrapped, so the code itself survives as text")
        void shouldUnwrapInlineAndFencedCode() {
            assertThat(PlainText.sanitize("run `df -h` first")).isEqualTo("run df -h first");
            assertThat(PlainText.sanitize("before\n```\nrm -rf /\n```\nafter"))
                    .isEqualTo("before rm -rf / after");
        }

        @Test
        void shouldStripHtmlTags() {
            assertThat(PlainText.sanitize("<p>disk <b>full</b> on <i>web-01</i></p>"))
                    .isEqualTo("disk full on web-01");
        }

        @Test
        void shouldStripHeadingsAtLineStartAndMidLine() {
            assertThat(PlainText.sanitize("## Summary\nDisk is full")).isEqualTo("Summary Disk is full");
            assertThat(PlainText.sanitize("done ### next steps")).isEqualTo("done next steps");
        }

        @Test
        @DisplayName("web-client parity: setext underlines and thematic breaks have no rule and survive")
        void shouldLeaveSetextUnderlinesAndThematicBreaks() {
            assertThat(PlainText.sanitize("Summary\n===\nDisk is full")).isEqualTo("Summary === Disk is full");
            assertThat(PlainText.sanitize("---")).isEqualTo("---");
        }

        @Test
        void shouldKeepHashesThatAreNotHeadings() {
            assertThat(PlainText.sanitize("closed ticket #1234")).isEqualTo("closed ticket #1234");
        }

        @Test
        void shouldStripBlockquoteAndListMarkers() {
            assertThat(PlainText.sanitize("> quoted\n- one\n- two\n1. three"))
                    .isEqualTo("quoted one two three");
        }

        @Test
        @DisplayName("newlines collapse to spaces — these render as a single preview line")
        void shouldCollapseAllWhitespaceIncludingCrlf() {
            assertThat(PlainText.sanitize("first\r\n\r\nsecond   third\tfourth "))
                    .isEqualTo("first second third fourth");
        }

        @Test
        @DisplayName("the one deliberate break from the web client: output is always a single line, "
                + "because these strings become notification and FCM push titles")
        void shouldNeverEmitANewlineHoweverManyParagraphsWentIn() {
            String multiParagraph = "# Incident\n\nDisk full on web-01.\n\n- restarted nginx\n- freed 2GB\n";

            assertThat(PlainText.sanitize(multiParagraph))
                    .isEqualTo("Incident Disk full on web-01. restarted nginx freed 2GB")
                    .doesNotContain("\n");
        }

        @Test
        void shouldLeavePlainTextUntouched() {
            assertThat(PlainText.sanitize("Printer offline at front desk"))
                    .isEqualTo("Printer offline at front desk");
        }
    }

    @Nested
    class Excerpt {

        @Test
        void shouldPassThroughWhenWithinBudget() {
            assertThat(PlainText.excerpt("exactly ten", 11)).isEqualTo("exactly ten");
            assertThat(PlainText.excerpt("short", 200)).isEqualTo("short");
            assertThat(PlainText.excerpt(null, 200)).isNull();
        }

        @Test
        void shouldTruncateOnAWordBoundaryAndNeverExceedTheBudget() {
            String excerpt = PlainText.excerpt("the quick brown fox jumps", 16);
            assertThat(excerpt).isEqualTo("the quick brown…");
            assertThat(excerpt).hasSizeLessThanOrEqualTo(16);
        }

        @Test
        @DisplayName("one char over the budget still truncates; one under does not")
        void shouldHandleTheBoundaryExactly() {
            assertThat(PlainText.excerpt("aaa bbb", 7)).isEqualTo("aaa bbb");
            assertThat(PlainText.excerpt("aaa bbbb", 7)).isEqualTo("aaa…");
        }

        @Test
        void shouldCutAnOverlongSingleWordRatherThanDropIt() {
            assertThat(PlainText.excerpt("supercalifragilistic", 10)).isEqualTo("supercali…");
        }

        @Test
        void shouldDropTrailingPunctuationBeforeTheEllipsis() {
            assertThat(PlainText.excerpt("see the log, then retry", 15)).isEqualTo("see the log…");
        }

        @Test
        void shouldNotSplitASurrogatePair() {
            String excerpt = PlainText.excerpt("ok 👍🏽👍🏽👍🏽👍🏽👍🏽", 8);
            assertThat(excerpt).endsWith(PlainText.ELLIPSIS);
            assertThat(excerpt.codePoints()).allMatch(Character::isDefined);
            assertThat(Character.isHighSurrogate(excerpt.charAt(excerpt.length() - 2))).isFalse();
        }

        @Test
        void shouldSanitizeAndExcerptInOneStep() {
            assertThat(PlainText.sanitizeAndExcerpt("**the quick** brown fox jumps", 16))
                    .isEqualTo("the quick brown…");
        }
    }

    @Nested
    class ExcerptToBytes {

        @Test
        void shouldPassThroughWhenWithinBudget() {
            assertThat(PlainText.excerptToBytes("short", 100)).isEqualTo("short");
            assertThat(PlainText.excerptToBytes(null, 100)).isNull();
        }

        @Test
        void shouldMeasureInBytesNotChars() {
            // 10 chars, 20 UTF-8 bytes — a char-budget of 20 would not truncate, a byte-budget must.
            String cyrillic = "тестируем ";
            assertThat(cyrillic).hasSize(10);
            assertThat(cyrillic.getBytes(StandardCharsets.UTF_8)).hasSize(19);

            String excerpt = PlainText.excerptToBytes(cyrillic + "дальше", 20);
            assertThat(excerpt.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(20);
            assertThat(excerpt).endsWith(PlainText.ELLIPSIS);
        }

        @Test
        void shouldTruncateOnAWordBoundary() {
            assertThat(PlainText.excerptToBytes("the quick brown fox", 16)).isEqualTo("the quick…");
        }

        @Test
        void shouldNeverSplitAMultiByteCodePoint() {
            String excerpt = PlainText.excerptToBytes("👍🏽👍🏽👍🏽👍🏽", 12);
            assertThat(excerpt.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(12);
            assertThat(new String(excerpt.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8))
                    .isEqualTo(excerpt);
        }
    }
}
