package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.rmm.execution.ScriptExecutionResponse;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.graphql.relay.RelayIdCodec;
import graphql.execution.MergedField;
import graphql.language.Field;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.DataFetchingEnvironmentImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
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
class ScriptExecutionDataFetcherAuditTest {

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private ScriptExecutionDataFetcher dataFetcher;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    @Captor private ArgumentCaptor<AuditedWork<String, RuntimeException>> workCaptor;

    @ParameterizedTest
    @CsvSource({"stdout, Disk OK,", "stderr, , Access denied"})
    void output_askedStreamHasText_storesTheView(String field, String stdout, String stderr) {
        ScriptExecutionResponse run = ScriptExecutionResponse.builder().stdout(stdout).stderr(stderr).build();

        assertThat(storesAView(field, run)).isTrue();
    }

    @Test
    void output_printedNothing_storesNoView() {
        ScriptExecutionResponse run = ScriptExecutionResponse.builder().stdout("").stderr("").build();

        assertThat(storesAView("stdout", run)).isFalse();
    }

    @Test
    void output_printedOnlyBlanks_storesNoView() {
        ScriptExecutionResponse run = ScriptExecutionResponse.builder().stdout(" \n\t \n").stderr("").build();

        assertThat(storesAView("stdout", run)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"stdout", "stderr"})
    void output_deviceOffline_storesNoView(String field) {
        ScriptExecutionResponse run = ScriptExecutionResponse.builder()
                .stdout(null).stderr(null).error("Target device is offline").build();

        assertThat(storesAView(field, run)).isFalse();
    }

    private boolean storesAView(String field, ScriptExecutionResponse run) {
        audited().output(environment(field, run));
        verify(auditedMethodRunner).run(callCaptor.capture(), workCaptor.capture());
        String output = workCaptor.getValue().run();
        return callCaptor.getValue().storeIf().test(output);
    }

    private ScriptExecutionDataFetcher audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(dataFetcher);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private static DgsDataFetchingEnvironment environment(String field, ScriptExecutionResponse run) {
        DataFetchingEnvironment environment = DataFetchingEnvironmentImpl.newDataFetchingEnvironment()
                .source(run)
                .mergedField(MergedField.newMergedField(Field.newField(field).build()).build())
                .build();
        return new DgsDataFetchingEnvironment(environment, new GenericApplicationContext());
    }
}
