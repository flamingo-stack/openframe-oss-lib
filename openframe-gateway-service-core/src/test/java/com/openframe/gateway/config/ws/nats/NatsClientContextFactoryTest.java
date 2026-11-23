package com.openframe.gateway.config.ws.nats;

import com.openframe.gateway.config.ws.RequestJwtClaimsReader;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicyFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ServerWebExchange;
import reactor.util.context.Context;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NatsClientContextFactoryTest {

    private static final String MACHINE_ID = "m-1";
    private static final String USER_ID = "u-1";
    private static final String TENANT_ID = "tenant-1";
    private static final String PATH = "/ws/nats";

    @Mock private RequestJwtClaimsReader requestJwtClaimsReader;
    @Mock private ServerWebExchange exchange;

    private NatsClientContextFactory factory;

    @BeforeEach
    void setUp() {
        NatsSubjectPolicyFactory policyFactory = new NatsSubjectPolicyFactory(new NatsSubjectFilterProperties(), List.of());
        factory = new NatsClientContextFactory(requestJwtClaimsReader, policyFactory);
    }

    @Test
    void create_deviceToken_deviceContextScopedToTheMachine() {
        // setup
        when(requestJwtClaimsReader.getMachineId(exchange)).thenReturn(Optional.of(MACHINE_ID));

        // execution
        NatsClientContext context = factory.create(exchange, PATH, TENANT_ID, Context.empty());

        // verifications
        assertThat(context.getIdentity()).isEqualTo(NatsClientIdentity.device(MACHINE_ID));
        assertThat(context.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(context.getPath()).isEqualTo(PATH);
        assertThat(context.getPolicy().allowsSubscribe("machine.m-1.command-execution")).isTrue();
        verify(requestJwtClaimsReader, never()).getUserId(exchange);
    }

    @Test
    void create_userToken_userContextScopedToTheUser() {
        // setup
        when(requestJwtClaimsReader.getMachineId(exchange)).thenReturn(Optional.empty());
        when(requestJwtClaimsReader.getUserId(exchange)).thenReturn(USER_ID);

        // execution
        NatsClientContext context = factory.create(exchange, PATH, TENANT_ID, Context.empty());

        // verifications
        assertThat(context.getIdentity()).isEqualTo(NatsClientIdentity.user(USER_ID));
        assertThat(context.isDevice()).isFalse();
        assertThat(context.getPolicy().allowsSubscribe("user.u-1.notification")).isTrue();
    }

    @Test
    void create_tokenWithoutIdentity_throwsIllegalState() {
        // setup
        when(requestJwtClaimsReader.getMachineId(exchange)).thenReturn(Optional.empty());
        when(requestJwtClaimsReader.getUserId(exchange)).thenThrow(new IllegalStateException("no sub"));

        // execution
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> factory.create(exchange, PATH, TENANT_ID, Context.empty()));

        // verifications
        assertThat(exception.getMessage()).contains("no sub");
    }
}
