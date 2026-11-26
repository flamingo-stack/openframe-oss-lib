package com.openframe.management.service;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Keeps the tenant's public Windows MDM address, {@code https://<tenant domain>/mdm}, on the tenant's Fleet config
 * ({@code mdm.windows_server_url}). Fleet builds every Windows MDM URL of the tenant's devices from it.
 * <p>
 * The address is written once per pod, after the Fleet API token exists and the tenant's domain is known; until then
 * every call is a no-op, so the next tick retries. Writing the same address again is harmless.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FleetWindowsMdmAddressService {

    static final String MDM_PATH = "/mdm";

    private final TenantIdProvider tenantIdProvider;
    private final TenantRepository tenantRepository;
    private final AtomicReference<String> written = new AtomicReference<>();

    public void syncIfNeeded(IntegratedTool tool) {
        String apiToken = apiTokenOf(tool).orElse(null);
        if (apiToken == null) {
            log.debug("Fleet API token not set up yet; Fleet's Windows MDM address waits for it");
            return;
        }
        if (!tenantIdProvider.isTenantRegistered()) {
            log.debug("Tenant not registered yet; Fleet's Windows MDM address waits for it");
            return;
        }
        String tenantId = tenantIdProvider.getTenantId();
        String address = tenantRepository.findById(tenantId)
                .map(Tenant::getDomain)
                .filter(StringUtils::hasText)
                .map(FleetWindowsMdmAddressService::addressOf)
                .orElse(null);
        if (address == null) {
            log.warn("Tenant {} has no domain yet; Fleet's Windows MDM address is not set", tenantId);
            return;
        }
        if (address.equals(written.get())) {
            return;
        }

        String apiUrl = FleetApiKeyResolver.apiUrlOf(tool);
        FleetMdmClient client = newClient(apiUrl, apiToken, tenantId);
        client.setWindowsMdmServerUrl(address);
        written.set(address);
        log.info("Fleet Windows MDM address set to {}", address);
    }

    static String addressOf(String domain) {
        return "https://" + domain.trim().toLowerCase(Locale.ROOT) + MDM_PATH;
    }

    FleetMdmClient newClient(String apiUrl, String apiToken, String tenantId) {
        return new FleetMdmClient(apiUrl, apiToken, tenantId);
    }

    private static Optional<String> apiTokenOf(IntegratedTool tool) {
        return Optional.ofNullable(tool.getCredentials())
                .map(ToolCredentials::getApiKey)
                .map(ToolApiKey::getKey)
                .filter(StringUtils::hasText);
    }
}
