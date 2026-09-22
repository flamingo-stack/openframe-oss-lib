package com.openframe.data.loki.client;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LogQlTest {

    @Test
    void quoteEscapesQuotesBackslashesAndControlCharacters() {
        assertThat(LogQl.quote("a\"b\\c\nd")).isEqualTo("\"a\\\"b\\\\c\\nd\\u0001\"");
    }

    @Test
    void quoteKeepsHostileInputInsideTheLiteral() {
        assertThat(LogQl.quote("x\"} or {job=~\".+")).isEqualTo("\"x\\\"} or {job=~\\\".+\"");
    }

    @Test
    void regexLiteralEscapesRe2Metacharacters() {
        assertThat(LogQl.regexLiteral("a.b*(c)|[d]{e}^$\\+?"))
                .isEqualTo("a\\.b\\*\\(c\\)\\|\\[d\\]\\{e\\}\\^\\$\\\\\\+\\?");
    }
}
