package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.validation.NatsValidationResult;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import lombok.extern.slf4j.Slf4j;

/**
 * Logs and counts what the validators refused for one session. The counter sees every refusal; the
 * log sees the first few, so a client stuck re-subscribing in a loop cannot flood it.
 */
@Slf4j
final class NatsRefusalReporter {

    static final int LOGGED_REFUSALS_PER_SESSION = 10;

    private static final String OPERATION_CONNECT = "CONNECT";
    private static final String OPERATION_PROTOCOL = "PROTOCOL";

    private final GatewayTrafficMetrics gatewayTrafficMetrics;
    private final NatsClientContext context;
    private final String tenant;

    private int logged;

    NatsRefusalReporter(GatewayTrafficMetrics gatewayTrafficMetrics, NatsClientContext context) {
        this.gatewayTrafficMetrics = gatewayTrafficMetrics;
        this.context = context;
        this.tenant = context.tenantId() == null ? "-" : context.tenantId();
    }

    void refused(NatsValidationResult.Refused refused, boolean enforce) {
        String operation = refused.operation().name();
        String outcome = enforce ? "dropped and answered with -ERR" : "relayed (enforce=false)";
        report(operation, outcome, refused.subject(), enforce);
    }

    void closeSession(NatsValidationResult.CloseSession closeSession, boolean enforce) {
        String outcome = enforce ? "closing" : "relayed (enforce=false)";
        report(OPERATION_CONNECT, outcome, closeSession.reason(), enforce);
    }

    void protocolViolation(NatsValidationResult.ProtocolViolation violation, boolean enforce) {
        String outcome = enforce ? "closing" : "relaying the rest of the session unparsed";
        report(OPERATION_PROTOCOL, outcome, violation.reason(), enforce);
    }

    private void report(String operation, String outcome, String detail, boolean enforce) {
        String kind = context.kind().name();
        gatewayTrafficMetrics.recordNatsCommandRefused(operation, kind, enforce);
        if (logged >= LOGGED_REFUSALS_PER_SESSION) {
            return;
        }
        logged++;
        log.warn("NATS client {} not allowed, {}: {} kind={} id={} path={} tenant={}",
                operation, outcome, detail, kind, context.clientId(), context.path(), tenant);
    }
}
