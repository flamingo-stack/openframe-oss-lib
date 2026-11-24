package com.openframe.gateway.config.ws.nats.policy;

import com.openframe.gateway.config.ws.nats.NatsClientIdentity;
import com.openframe.gateway.config.ws.nats.NatsClientKind;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NatsSubjectPolicyFactoryTest {

    private static final String MACHINE_ID = "m-1";
    private static final String USER_ID = "u-1";

    private NatsSubjectPolicyFactory ossFactory;
    private NatsSubjectPolicyFactory factoryWithChat;

    @BeforeEach
    void setUp() {
        NatsSubjectFilterProperties properties = new NatsSubjectFilterProperties();
        ossFactory = new NatsSubjectPolicyFactory(properties, List.of());
        factoryWithChat = new NatsSubjectPolicyFactory(properties, List.of(NatsTestContexts.chatPatterns()));
    }

    @ParameterizedTest
    @CsvSource({
            "DEVICE, machine.m-1.command-execution,  true",
            "DEVICE, machine.m-1.remote-access.>,    true",
            "DEVICE, _INBOX.abc,                     true",
            "DEVICE, _INBOX.abc.*,                   true",
            "DEVICE, _INBOX.*.*,                     false",
            "DEVICE, _INBOX.>,                       false",
            "DEVICE, machine.m-2.command-execution,  false",
            "DEVICE, machine.*.command-execution,    false",
            "DEVICE, user.u-1.notification,          false",
            "DEVICE, chat.d-1.message,               false",
            "DEVICE, deliver.web.m-1.feed-1,         false",
            "USER,   user.u-1.notification,          true",
            "USER,   user.u-2.notification,          false",
            "USER,   _INBOX.abc.*,                   true",
            "USER,   _INBOX.>,                       false",
            "USER,   machine.m-1.command-execution,  false",
            "USER,   chat.d-1.message,               false",
            "USER,   deliver.web.u-1.feed-1,         false"
    })
    void policyFor_ossDefaultsAlone_onlyOwnSubjectsAndInboxes(NatsClientKind kind, String subject, boolean expected) {
        // setup
        NatsClientIdentity identity = identityOf(kind);

        // execution
        NatsSubjectPolicy policy = ossFactory.policyFor(identity);

        // verifications
        assertThat(policy.allowsSubscribe(subject)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "DEVICE, machine.m-1.heartbeat,                true",
            "DEVICE, machine.m-1.command-execution.result, true",
            "DEVICE, machine.m-2.heartbeat,                false",
            "DEVICE, user.u-1.installed-agent,             false",
            "DEVICE, $JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message, false",
            "USER,   user.u-1.installed-agent,             true",
            "USER,   user.u-2.installed-agent,             false",
            "USER,   user.*.installed-agent,               false",
            "USER,   user.u-1.notification,                false",
            "USER,   machine.m-1.command-execution,        false",
            "USER,   $JS.API.STREAM.INFO.CHAT_CHUNKS,      false"
    })
    void policyFor_ossDefaultsAlone_publishesOwnSubjectsOnly(NatsClientKind kind, String subject, boolean expected) {
        // setup
        NatsClientIdentity identity = identityOf(kind);

        // execution
        NatsSubjectPolicy policy = ossFactory.policyFor(identity);

        // verifications
        assertThat(policy.allowsPublish(subject)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "DEVICE, deliver.web.m-1.feed-1,         true",
            "DEVICE, deliver.web.m-2.feed-1,         false",
            "DEVICE, chat.d-1.message,               false",
            "DEVICE, machine.m-1.command-execution,  true",
            "USER,   deliver.web.u-1.feed-1,         true",
            "USER,   deliver.web.u-2.feed-1,         false",
            "USER,   chat.d-1.message,               true",
            "USER,   chat.d-1.admin-message,         true",
            "USER,   chat.*.message,                 false",
            "USER,   user.u-1.notification,          true"
    })
    void policyFor_chatPatternsContributed_addedToTheDefaults(NatsClientKind kind, String subject, boolean expected) {
        // setup
        NatsClientIdentity identity = identityOf(kind);

        // execution
        NatsSubjectPolicy policy = factoryWithChat.policyFor(identity);

        // verifications
        assertThat(policy.allowsSubscribe(subject)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "DEVICE, $JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message, true",
            "DEVICE, $JS.API.STREAM.INFO.OTHER,                              false",
            "DEVICE, machine.m-1.heartbeat,                                  true",
            "USER,   $JS.API.CONSUMER.CREATE.CHAT_CHUNKS.c1.chat.d-1.message, true",
            "USER,   $JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS.c1,                true",
            "USER,   chat.d-1.message,                                       false"
    })
    void policyFor_chatPatternsContributed_chatStreamApiPublishable(NatsClientKind kind, String subject, boolean expected) {
        // setup
        NatsClientIdentity identity = identityOf(kind);

        // execution
        NatsSubjectPolicy policy = factoryWithChat.policyFor(identity);

        // verifications
        assertThat(policy.allowsPublish(subject)).isEqualTo(expected);
    }

    private static NatsClientIdentity identityOf(NatsClientKind kind) {
        return kind == NatsClientKind.DEVICE
                ? NatsClientIdentity.device(MACHINE_ID)
                : NatsClientIdentity.user(USER_ID);
    }
}
