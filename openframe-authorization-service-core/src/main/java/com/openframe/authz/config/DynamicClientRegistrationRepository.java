package com.openframe.authz.config;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.auth.DynamicClientRegistrationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Optional;

import static com.openframe.authz.config.tenant.TenantContextFilter.TENANT_ID;

@Component
@RequiredArgsConstructor
@Slf4j
public class DynamicClientRegistrationRepository implements ClientRegistrationRepository {

    private final DynamicClientRegistrationService dynamic;

    @Override
    public ClientRegistration findByRegistrationId(String registrationId) {
        String tenantId = resolveTenantId()
                .orElseThrow(() -> {
                    log.warn("ClientRegistration not resolved: tenantId not in context/session, provider={}. OAuth2 flow will fail.", registrationId);
                    return new IllegalStateException("Tenant not resolvable for provider: " + registrationId);
                });
        try {
            return dynamic.loadClient(registrationId, tenantId);
        } catch (IllegalArgumentException ex) {
            log.warn("Dynamic client resolution failed for provider '{}' and tenant {}: {}", registrationId, tenantId, ex.getMessage());
            throw new IllegalStateException("Dynamic client resolution failed for provider: " + registrationId, ex);
        }
    }

    private Optional<String> resolveTenantId() {
        String fromContext = TenantContext.getTenantId();
        if (fromContext != null && !fromContext.isBlank()) {
            return Optional.of(fromContext);
        }
        RequestAttributes ra = RequestContextHolder.getRequestAttributes();
        if (!(ra instanceof ServletRequestAttributes sra)) {
            return Optional.empty();
        }
        HttpServletRequest req = sra.getRequest();
        HttpSession session = req.getSession(false);
        if (session == null) {
            return Optional.empty();
        }
        Object t = session.getAttribute(TENANT_ID);
        String tenantId = t instanceof String s ? s : null;
        return (tenantId == null || tenantId.isBlank()) ? Optional.empty() : Optional.of(tenantId);
    }
}


