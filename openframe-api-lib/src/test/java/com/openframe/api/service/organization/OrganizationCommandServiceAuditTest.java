package com.openframe.api.service.organization;

import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.service.OrganizationService;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OrganizationCommandServiceAuditTest {

    private static final LocalDate CONTRACT_START = LocalDate.of(2026, 6, 1);
    private static final LocalDate CONTRACT_END_BEFORE_START = LocalDate.of(2026, 1, 1);

    @Mock private OrganizationService organizationService;
    @Mock private OrganizationMapper organizationMapper;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private OrganizationCommandService organizationCommandService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void updateOrganization_refused_keepsTheAskedContractDatesInTheDetails() {
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder()
                .contractStartDate(CONTRACT_START)
                .contractEndDate(CONTRACT_END_BEFORE_START)
                .build();

        audited().updateOrganization("org-1", request);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "contractStartDate", CONTRACT_START, "contractEndDate", CONTRACT_END_BEFORE_START));
    }

    private OrganizationCommandService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(organizationCommandService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
