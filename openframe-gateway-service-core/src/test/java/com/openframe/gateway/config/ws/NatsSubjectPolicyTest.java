package com.openframe.gateway.config.ws;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class NatsSubjectPolicyTest {

    private static final String MACHINE_ID = "m-1";
    private static final String USER_ID = "u-1";

    @ParameterizedTest
    @CsvSource({
            "DEVICE, machine.m-1.command-execution,  true",
            "DEVICE, machine.m-1.remote-access.>,    true",
            "DEVICE, deliver.web.m-1.feed-1,         true",
            "DEVICE, _INBOX.abc,                     true",
            "DEVICE, _INBOX.abc.*,                   true",
            "DEVICE, _INBOX.*.*,                     false",
            "DEVICE, _INBOX.>,                       false",
            "DEVICE, machine.m-2.command-execution,  false",
            "DEVICE, machine.*.command-execution,    false",
            "DEVICE, chat.d-1.message,               false",
            "DEVICE, chat.d-1.admin-message,         false",
            "DEVICE, user.u-1.notification,          false",
            "DEVICE, deliver.web.m-2.feed-1,         false",
            "USER,   deliver.web.u-1.feed-1,         true",
            "USER,   deliver.web.u-2.feed-1,         false",
            "USER,   user.u-1.notification,          true",
            "USER,   user.u-2.notification,          false",
            "USER,   chat.d-1.message,               true",
            "USER,   chat.d-1.admin-message,         true",
            "USER,   machine.m-1.command-execution,  false",
            "USER,   _INBOX.abc.*,                   true",
            "USER,   _INBOX.>,                       false"
    })
    void allowsSubscribe_defaultPatterns_scopedToTheCaller(NatsClientKind kind, String subject, boolean expected) {
        // setup
        NatsSubjectPolicy policy = policyFor(kind);

        // execution
        boolean allowed = policy.allowsSubscribe(subject);

        // verifications
        assertThat(allowed).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "DEVICE, machine.m-1.heartbeat,                                                           true",
            "DEVICE, machine.m-1.command-execution.result,                                            true",
            "DEVICE, machine.m-2.heartbeat,                                                           false",
            "DEVICE, user.u-1.installed-agent,                                                        true",
            "DEVICE, $JS.API.CONSUMER.CREATE.MACHINE_TIMEZONE_REQUEST.c1.machine.m-1.timezone.request, true",
            "DEVICE, $JS.API.CONSUMER.CREATE.MACHINE_TIMEZONE_REQUEST.c1.machine.m-2.timezone.request, false",
            "DEVICE, $JS.ACK.MACHINE_TIMEZONE_REQUEST.c1.1.2.3.4.5,                                   true",
            "DEVICE, $JS.API.STREAM.INFO.CHAT_CHUNKS,                                                 true",
            "DEVICE, $JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message,                         true",
            "DEVICE, $JS.API.STREAM.INFO.OTHER,                                                       false",
            "DEVICE, chat.d-1.message,                                                                false",
            "USER,   $JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message,                         true",
            "USER,   $JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS.c1,                                        true",
            "USER,   machine.m-1.command-execution,                                                   false",
            "USER,   chat.d-1.message,                                                                false",
            "USER,   user.u-1.installed-agent,                                                        false"
    })
    void allowsPublish_defaultPatterns_scopedToTheCaller(NatsClientKind kind, String subject, boolean expected) {
        // setup
        NatsSubjectPolicy policy = policyFor(kind);

        // execution
        boolean allowed = policy.allowsPublish(subject);

        // verifications
        assertThat(allowed).isEqualTo(expected);
    }

    private static NatsSubjectPolicy policyFor(NatsClientKind kind) {
        NatsSubjectFilterProperties properties = new NatsSubjectFilterProperties();
        NatsClientIdentity identity = kind == NatsClientKind.DEVICE
                ? NatsClientIdentity.device(MACHINE_ID)
                : NatsClientIdentity.user(USER_ID);
        return NatsSubjectPolicy.of(properties, identity);
    }
}
