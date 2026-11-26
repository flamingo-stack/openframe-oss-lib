package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.graphql.relay.RelayIdCodec;
import graphql.language.OperationDefinition;
import graphql.language.OperationDefinition.Operation;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.DataFetchingEnvironmentImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.context.support.GenericApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ScriptDataFetcherAuditTest {

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private ScriptDataFetcher dataFetcher;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    @Captor private ArgumentCaptor<AuditedWork<String, RuntimeException>> workCaptor;

    @Test
    void scriptBody_readInAQuery_storesTheView() {
        assertThat(storesAView(Operation.QUERY, "Get-Service")).isTrue();
    }

    @Test
    void scriptBody_echoedBackByASave_storesNoView() {
        assertThat(storesAView(Operation.MUTATION, "Get-Service")).isFalse();
    }

    @Test
    void scriptBody_scriptWithoutABody_storesNoView() {
        assertThat(storesAView(Operation.QUERY, null)).isFalse();
    }

    private boolean storesAView(Operation operation, String scriptBody) {
        ScriptResponse script = ScriptResponse.builder().id("script-1").scriptBody(scriptBody).build();
        audited().scriptBody(environment(operation, script));
        verify(auditedMethodRunner).run(callCaptor.capture(), workCaptor.capture());
        String read = workCaptor.getValue().run();
        return callCaptor.getValue().storeIf().test(read);
    }

    private ScriptDataFetcher audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(dataFetcher);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private static DgsDataFetchingEnvironment environment(Operation operation, ScriptResponse script) {
        DataFetchingEnvironment environment = DataFetchingEnvironmentImpl.newDataFetchingEnvironment()
                .source(script)
                .operationDefinition(OperationDefinition.newOperationDefinition().operation(operation).build())
                .build();
        return new DgsDataFetchingEnvironment(environment, new GenericApplicationContext());
    }
}
