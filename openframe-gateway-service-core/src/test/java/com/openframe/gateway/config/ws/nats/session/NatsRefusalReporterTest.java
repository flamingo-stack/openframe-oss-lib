package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.validation.NatsValidationResult;
import com.openframe.gateway.config.ws.nats.protocol.NatsOperation;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class NatsRefusalReporterTest {

    private static final String DEVICE = "DEVICE";
    private static final NatsValidationResult.Refused REFUSED = new NatsValidationResult.Refused(NatsOperation.SUB, "machine.m-2.x");
    private static final int REFUSALS_BEYOND_THE_LOG_CAP = NatsRefusalReporter.LOGGED_REFUSALS_PER_SESSION + 5;

    @Mock private GatewayTrafficMetrics gatewayTrafficMetrics;

    private NatsRefusalReporter reporter;

    @BeforeEach
    void setUp() {
        NatsClientContext context = NatsTestContexts.device();
        reporter = new NatsRefusalReporter(gatewayTrafficMetrics, context);
    }

    @Test
    void refused_enforcing_countedAsEnforced() {
        // execution
        reporter.refused(REFUSED, true);

        // verifications
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("SUB", DEVICE, true);
    }

    @Test
    void closeSession_observing_countedAsConnectNotEnforced() {
        // execution
        reporter.closeSession(new NatsValidationResult.CloseSession("CONNECT carries pass"), false);

        // verifications
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("CONNECT", DEVICE, false);
    }

    @Test
    void protocolViolation_enforcing_countedAsProtocol() {
        // execution
        reporter.protocolViolation(new NatsValidationResult.ProtocolViolation("control line too long"), true);

        // verifications
        verify(gatewayTrafficMetrics).recordNatsCommandRefused("PROTOCOL", DEVICE, true);
    }

    @Test
    void refused_beyondTheLogCap_everyRefusalStillCounted() {
        // execution
        for (int i = 0; i < REFUSALS_BEYOND_THE_LOG_CAP; i++) {
            reporter.refused(REFUSED, true);
        }

        // verifications
        verify(gatewayTrafficMetrics, times(REFUSALS_BEYOND_THE_LOG_CAP)).recordNatsCommandRefused("SUB", DEVICE, true);
    }
}
