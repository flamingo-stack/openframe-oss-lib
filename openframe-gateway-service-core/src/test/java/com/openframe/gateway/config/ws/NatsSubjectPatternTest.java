package com.openframe.gateway.config.ws;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class NatsSubjectPatternTest {

    private static final String ID = "m-1";

    @ParameterizedTest
    @CsvSource({
            "machine.{id}.>,                   machine.m-1.command-execution",
            "machine.{id}.>,                   machine.m-1.remote-access.>",
            "machine.{id}.>,                   machine.m-1.tool.*.update",
            "_INBOX.*,                         _INBOX.abc",
            "_INBOX.*.>,                       _INBOX.abc.*",
            "_INBOX.*.>,                       _INBOX.abc.12",
            "user.{id}.notification,           user.m-1.notification",
            "chat.*.message,                   chat.d-1.message",
            "$JS.API.STREAM.INFO.CHAT_CHUNKS,  $JS.API.STREAM.INFO.CHAT_CHUNKS"
    })
    void covers_subjectInsideThePattern_true(String pattern, String subject) {
        // setup
        NatsSubjectPattern compiled = NatsSubjectPattern.compile(pattern, ID);

        // execution
        boolean covered = compiled.covers(subject);

        // verifications
        assertThat(covered).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "machine.{id}.>,                   machine.m-2.command-execution",
            "machine.{id}.>,                   machine.*.command-execution",
            "machine.{id}.>,                   machine.>",
            "machine.{id}.>,                   machine.m-1",
            "machine.{id}.>,                   machine",
            "_INBOX.*,                         _INBOX.*",
            "_INBOX.*,                         _INBOX.>",
            "_INBOX.*,                         _INBOX.abc.12",
            "_INBOX.*.>,                       _INBOX.*.*",
            "_INBOX.*.>,                       _INBOX.>",
            "_INBOX.*.>,                       _INBOX.abc",
            "user.{id}.notification,           user.m-1.notification.extra",
            "user.{id}.notification,           user.m-2.notification",
            "chat.*.message,                   chat.*.message",
            "chat.*.message,                   chat.d-1.admin-message",
            "$JS.API.STREAM.INFO.CHAT_CHUNKS,  $JS.API.STREAM.INFO.OTHER"
    })
    void covers_subjectOutsideThePattern_false(String pattern, String subject) {
        // setup
        NatsSubjectPattern compiled = NatsSubjectPattern.compile(pattern, ID);

        // execution
        boolean covered = compiled.covers(subject);

        // verifications
        assertThat(covered).isFalse();
    }
}
