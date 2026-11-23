package com.openframe.gateway.config.ws.nats;

import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicy;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicyFactory;
import reactor.util.context.Context;

/** Session contexts with the default patterns, for the tests of every check and parser. */
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
        NatsSubjectPolicyFactory policyFactory = new NatsSubjectPolicyFactory(properties);
        NatsSubjectPolicy policy = policyFactory.policyFor(identity);
        return NatsClientContext.builder().identity(identity).tenantId(TENANT_ID).path(PATH).policy(policy).reactorContext(Context.empty()).build();
    }
}
