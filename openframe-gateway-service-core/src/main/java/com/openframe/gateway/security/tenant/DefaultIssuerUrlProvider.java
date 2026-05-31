package com.openframe.gateway.security.tenant;

import com.openframe.data.service.TenantIdProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
@Slf4j
public class DefaultIssuerUrlProvider implements IssuerUrlProvider {

    private final TenantIdProvider tenantIdProvider;

    @Value("${openframe.security.jwt.allowed-issuer-base}")
    private String allowedIssuerBase;

    @Value("${openframe.security.jwt.super-tenant-id:}")
    private String superTenantId;

    public DefaultIssuerUrlProvider(TenantIdProvider tenantIdProvider) {
        this.tenantIdProvider = tenantIdProvider;
    }

    @Override
    public Mono<List<String>> resolveIssuerUrls() {
        return Mono.fromCallable(this::buildIssuerList);
    }

    @Override
    public List<String> getCachedIssuerUrl() {
        return buildIssuerList();
    }

    private List<String> buildIssuerList() {
        String tenantId = tenantIdProvider.getTenantId();
        String tenantIssuer = allowedIssuerBase + "/" + tenantId;
        List<String> list = new ArrayList<>(2);
        list.add(tenantIssuer);
        if (superTenantId != null && !superTenantId.isBlank()) {
            String superIssuer = allowedIssuerBase + "/" + superTenantId;
            if (!superIssuer.equals(tenantIssuer)) list.add(superIssuer);
        }
        return Collections.unmodifiableList(list);
    }
}
