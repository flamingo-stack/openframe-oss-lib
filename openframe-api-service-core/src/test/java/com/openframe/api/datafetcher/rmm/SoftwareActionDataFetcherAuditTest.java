package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.rmm.software.SoftwareActionDeviceResponse;
import com.openframe.api.service.rmm.software.SoftwareActionDetailService;
import com.openframe.api.service.rmm.software.SoftwareActionService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.graphql.relay.RelayIdCodec;
import graphql.execution.MergedField;
import graphql.language.Field;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SoftwareActionDataFetcherAuditTest {

    @Mock private SoftwareActionService softwareActionService;
    @Mock private SoftwareActionDetailService softwareActionDetailService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private SoftwareActionDataFetcher dataFetcher;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void output_deviceOffline_isNotStored() {
        audited().output(environment("stdout", SoftwareActionDeviceResponse.builder().build()));

        assertThat(capturedCall().storeIf().test(null)).isFalse();
    }

    @Test
    void output_fieldPrintedNothing_isNotStored() {
        audited().output(environment("stderr",
                SoftwareActionDeviceResponse.builder().stdout("Installed 7-Zip").stderr("").build()));

        assertThat(capturedCall().storeIf().test("")).isFalse();
    }

    @Test
    void output_fieldPrintedText_isStored() {
        audited().output(environment("stdout",
                SoftwareActionDeviceResponse.builder().stdout("Installed 7-Zip").stderr("").build()));

        assertThat(capturedCall().storeIf().test("Installed 7-Zip")).isTrue();
    }

    private SoftwareActionDataFetcher audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(dataFetcher);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static DgsDataFetchingEnvironment environment(String field, SoftwareActionDeviceResponse device) {
        return new DgsDataFetchingEnvironment(DataFetchingEnvironmentImpl.newDataFetchingEnvironment()
                .source(device)
                .mergedField(MergedField.newMergedField(Field.newField(field).build()).build())
                .build(), new GenericApplicationContext());
    }
}
