package com.openframe.management.service;

import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class FleetMdmSetupService {

    public static final String FLEET_API_TOKEN_KEY_NAME = "Fleet API Token";

    private final FleetApiKeyResolver fleetApiKeyResolver;
    private final IntegratedToolRepository toolRepository;

    public void setupAndSaveApiToken(IntegratedTool tool) {
        if (hasApiToken(tool)) {
            log.debug("Fleet MDM tool already has API token, skipping setup");
            return;
        }

        log.info("Fleet MDM tool found without API token — starting setup");
        String token = fleetApiKeyResolver.resolve(tool);

        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey(token);
        apiKey.setType(APIKeyType.BEARER_TOKEN);
        apiKey.setKeyName(FLEET_API_TOKEN_KEY_NAME);

        tool.getCredentials().setApiKey(apiKey);
        toolRepository.save(tool);
        log.info("Fleet API token saved to IntegratedTool '{}'", tool.getKey());
    }

    private boolean hasApiToken(IntegratedTool tool) {
        return Optional.ofNullable(tool.getCredentials())
                .map(ToolCredentials::getApiKey)
                .map(ToolApiKey::getKey)
                .map(key -> !key.isEmpty())
                .orElse(false);
    }
}
