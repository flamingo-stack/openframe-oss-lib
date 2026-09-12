package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Component
@ConditionalOnProperty(name = "openframe.software-management.enabled", havingValue = "true")
@RequiredArgsConstructor
public class FleetClientProvider {

    private static final String PORT_SEPARATOR = ":";

    private final IntegratedToolRepository integratedToolRepository;
    private final TenantIdProvider tenantIdProvider;

    public <T> T call(FleetSdkCall<T> call, String action) {
        try {
            return call.execute(client());
        } catch (IOException e) {
            throw new FleetMdmException("Failed to " + action, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FleetMdmException("Interrupted while " + action, e);
        }
    }

    @FunctionalInterface
    public interface FleetSdkCall<T> {
        T execute(FleetMdmClient client) throws IOException, InterruptedException;
    }

    private FleetMdmClient client() {
        String key = IntegratedToolId.FLEET_SERVER_ID.getValue();
        IntegratedTool tool = integratedToolRepository.findByKey(key)
                .orElseThrow(() -> new IllegalStateException("Fleet MDM tool not configured: " + key));
        return new FleetMdmClient(resolveApiUrl(tool), resolveApiToken(tool), tenantIdProvider.getTenantId());
    }

    private static String resolveApiUrl(IntegratedTool tool) {
        List<ToolUrl> urls = tool.getToolUrls();
        if (isEmpty(urls)) {
            throw new IllegalStateException("Fleet MDM tool has no configured URLs");
        }
        ToolUrl api = urls.stream()
                .filter(u -> u.getType() == ToolUrlType.API)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Fleet MDM tool has no API URL"));
        return hasText(api.getPort()) ? api.getUrl() + PORT_SEPARATOR + api.getPort() : api.getUrl();
    }

    private static String resolveApiToken(IntegratedTool tool) {
        ToolCredentials credentials = tool.getCredentials();
        ToolApiKey apiKey = credentials == null ? null : credentials.getApiKey();
        if (apiKey == null || !hasText(apiKey.getKey())) {
            throw new IllegalStateException("Fleet MDM tool has no API token configured");
        }
        return apiKey.getKey();
    }
}
