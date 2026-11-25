package com.openframe.api.datafetcher;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.dto.audit.LogFilterInput;
import com.openframe.api.service.LogDetailsService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.exception.NotFoundException;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LogDataFetcherAuditTest {

    private static final Instant TIMESTAMP = Instant.parse("2026-10-01T10:00:00.123Z");

    @Mock private LogDetailsService logDetailsService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private LogDataFetcher logDataFetcher;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    @Captor private ArgumentCaptor<AuditedWork<LogDetails, RuntimeException>> workCaptor;

    @Test
    void logs_oneDevicesList_isNotStored() {
        audited().logs(LogFilterInput.builder().deviceId("device-7").build(), 20, null, null, null, null, null);

        assertThat(capturedCall().storeIf().test(null)).isFalse();
    }

    @Test
    void logs_blankDeviceId_isStoredAsTheWholeTenantsList() {
        audited().logs(LogFilterInput.builder().deviceId("").build(), 20, null, null, null, null, null);

        assertThat(capturedCall().storeIf().test(null)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"cursor-9,", ",cursor-9"})
    void logs_laterPage_isNotStored(String after, String before) {
        audited().logs(LogFilterInput.builder().build(), 20, after, null, before, null, null);

        assertThat(capturedCall().storeIf().test(null)).isFalse();
    }

    @ParameterizedTest
    @CsvSource({"'',", ",''"})
    void logs_blankPageMarker_isStoredAsTheFirstPage(String after, String before) {
        audited().logs(LogFilterInput.builder().build(), 20, after, null, before, null, null);

        assertThat(capturedCall().storeIf().test(null)).isTrue();
    }

    @Test
    void logs_oneCustomersList_carriesThatCustomer() {
        audited().logs(LogFilterInput.builder().organizationIds(List.of("org-1")).build(), 20, null, null, null,
                null, null);

        assertThat(capturedCall().organizationIdOf().apply(null)).isEqualTo("org-1");
    }

    @Test
    void logs_severalCustomersList_carriesNoCustomer() {
        audited().logs(LogFilterInput.builder().organizationIds(List.of("org-1", "org-2")).build(), 20, null, null,
                null, null, null);

        assertThat(capturedCall().organizationIdOf().apply(null)).isNull();
    }

    @Test
    void logs_emptySearch_storesNoSearch() {
        audited().logs(LogFilterInput.builder().build(), 20, null, null, null, "", null);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsEntry("search", null);
    }

    @Test
    void logDetails_eventGone_refusesTheAuditedWorkAsNotFound() {
        when(logDetailsService.findLogDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                .thenReturn(Optional.empty());

        logDataFetcher.logDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");

        verify(auditedMethodRunner).run(any(AuditCall.class), workCaptor.capture());
        assertThatThrownBy(workCaptor.getValue()::run)
                .isExactlyInstanceOf(NotFoundException.class)
                .hasMessage("Log not found for toolEventId: evt-1, ingestDay: 2026-10-01, toolType: FLEET, "
                        + "eventType: LOGIN, timestamp: 2026-10-01T10:00:00.123Z");
    }

    @Test
    void logDetails_eventFound_filesTheViewUnderItsCustomerAndDevice() {
        LogDetails found = LogDetails.builder().organizationId("org-1").deviceId("device-7").build();

        logDataFetcher.logDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");

        AuditCall call = capturedCall();
        assertThat(call.organizationIdOf().apply(found)).isEqualTo("org-1");
        assertThat(call.deviceIdOf().apply(found)).isEqualTo("device-7");
    }

    @Test
    void logDetails_eventGone_filesTheRefusalUnderNoCustomerOrDevice() {
        logDataFetcher.logDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");

        AuditCall call = capturedCall();
        assertThat(call.organizationIdOf().apply(null)).isNull();
        assertThat(call.deviceIdOf().apply(null)).isNull();
    }

    private LogDataFetcher audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(logDataFetcher);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
