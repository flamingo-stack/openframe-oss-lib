package com.openframe.external.controller;

import com.openframe.api.service.LogDetailsService;
import com.openframe.api.service.LogService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.external.mapper.LogMapper;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class LogControllerAuditTest {

    private static final Instant TIMESTAMP = Instant.parse("2024-01-15T10:00:00.123Z");

    @Mock private LogService logService;
    @Mock private LogDetailsService logDetailsService;
    @Mock private LogMapper logMapper;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private LogController logController;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void getLogs_oneDevicesList_isNotStored() {
        listLogs(null, "device-7", null, null);

        assertThat(capturedCall().storeIf().test(null)).isFalse();
    }

    @Test
    void getLogs_blankDeviceId_isStoredAsTheWholeTenantsList() {
        listLogs(null, "", null, null);

        assertThat(capturedCall().storeIf().test(null)).isTrue();
    }

    @Test
    void getLogs_laterPage_isNotStored() {
        listLogs(null, null, null, "MTcwNTMxMjgwMDAwMF9ldnQtMQ==");

        assertThat(capturedCall().storeIf().test(null)).isFalse();
    }

    @Test
    void getLogs_blankCursor_isStoredAsTheFirstPage() {
        listLogs(null, null, null, " ");

        assertThat(capturedCall().storeIf().test(null)).isTrue();
    }

    @Test
    void getLogs_oneCustomersList_carriesThatCustomer() {
        listLogs(List.of("org-1"), null, null, null);

        assertThat(capturedCall().organizationIdOf().apply(null)).isEqualTo("org-1");
    }

    @Test
    void getLogs_severalCustomersList_carriesNoCustomer() {
        listLogs(List.of("org-1", "org-2"), null, null, null);

        assertThat(capturedCall().organizationIdOf().apply(null)).isNull();
    }

    @Test
    void getLogs_emptySearch_storesNoSearch() {
        listLogs(null, null, "", null);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsEntry("search", null);
    }

    @Test
    void getLogDetails_eventGone_keepsTheAskedEventAsTarget() {
        audited().getLogDetails("2024-01-15", "MESHCENTRAL", "LOGIN", TIMESTAMP, "evt-1", null);

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo("evt-1");
    }

    @Test
    void getLogDetails_eventGone_keepsTheAskedKeysInTheDetails() {
        audited().getLogDetails("2024-01-15", "MESHCENTRAL", "LOGIN", TIMESTAMP, "evt-1", null);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "ingestDay", "2024-01-15", "toolType", "MESHCENTRAL", "eventType", "LOGIN"));
    }

    private void listLogs(List<String> customerIds, String deviceId, String search, String cursor) {
        audited().getLogs(null, null, null, null, null, null, null, customerIds, deviceId, search, 20, cursor, null,
                "DESC", null);
    }

    private LogController audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(logController);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
