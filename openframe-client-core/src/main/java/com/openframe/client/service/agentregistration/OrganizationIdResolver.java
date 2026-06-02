package com.openframe.client.service.agentregistration;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import static org.springframework.util.StringUtils.hasText;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrganizationIdResolver {

    private final OrganizationService organizationService;

    public String resolve(String requestedOrganizationId) {
        if (existsRequested(requestedOrganizationId)) {
            log.debug("Using provided organizationId: {}", requestedOrganizationId);
            return requestedOrganizationId;
        }

        if (hasText(requestedOrganizationId)) {
            log.warn("Provided organizationId {} not found, falling back to default", requestedOrganizationId);
        }

        return getDefaultOrganizationId();
    }

    private boolean existsRequested(String requestedOrganizationId) {
        return hasText(requestedOrganizationId)
                && organizationService.getOrganizationByOrganizationId(requestedOrganizationId).isPresent();
    }

    private String getDefaultOrganizationId() {
        return organizationService.getDefaultOrganization()
                .map(Organization::getOrganizationId)
                .orElseThrow(() -> new IllegalStateException(
                        "Default organization not found. Please ensure it was created during tenant registration."));
    }
}
