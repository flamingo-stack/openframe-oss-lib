package com.openframe.gateway.config.ws.nats;

import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPatternContributor;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicy;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicyFactory;
import reactor.util.context.Context;

import java.util.List;

/**
 * Session contexts for the tests of every check and parser: the default patterns plus the chat
 * patterns the saas gateway contributes, mirrored here so the JetStream checks have a stream to work on.
 */
public final class NatsTestContexts {

    public static final String MACHINE_ID = "m-1";
    public static final String USER_ID = "u-1";
    public static final String TENANT_ID = "tenant-1";
    public static final String PATH = "/ws/nats";

    private NatsTestContexts() {
    }

    public static NatsClientContext device() {
        return contextOf(NatsClientIdentity.device(MACHINE_ID));
    }

    public static NatsClientContext user() {
        return contextOf(NatsClientIdentity.user(USER_ID));
    }

    public static NatsClientContext contextOf(NatsClientIdentity identity) {
        NatsSubjectFilterProperties properties = new NatsSubjectFilterProperties();
        NatsSubjectPolicyFactory policyFactory = new NatsSubjectPolicyFactory(properties, List.of(chatPatterns()));
        NatsSubjectPolicy policy = policyFactory.policyFor(identity);
        return NatsClientContext.builder()
                .identity(identity)
                .tenantId(TENANT_ID)
                .path(PATH)
                .policy(policy)
                .reactorContext(Context.empty())
                .build();
    }

    /** What the saas gateway's chat contributor adds: the dialog feed, the chat subjects, the chat stream's API. */
    public static NatsSubjectPatternContributor chatPatterns() {
        return new NatsSubjectPatternContributor() {

            @Override
            public List<String> subscribePatternsFor(NatsClientKind kind) {
                return switch (kind) {
                    case DEVICE -> List.of("deliver.web.{id}.>");
                    case USER -> List.of("deliver.web.{id}.>", "chat.*.message", "chat.*.admin-message");
                };
            }

            @Override
            public List<String> publishPatternsFor(NatsClientKind kind) {
                return List.of(
                        "$JS.API.STREAM.INFO.CHAT_CHUNKS",
                        "$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.>",
                        "$JS.API.CONSUMER.INFO.CHAT_CHUNKS.>",
                        "$JS.API.CONSUMER.DELETE.CHAT_CHUNKS.>",
                        "$JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS.>");
            }
        };
    }
}
