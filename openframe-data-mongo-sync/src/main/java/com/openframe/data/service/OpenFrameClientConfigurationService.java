package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import com.openframe.data.retry.RetryOnOptimisticLockingFailure;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenFrameClientConfigurationService {

    public static final String DEFAULT_ID = "default";

    private final OpenFrameClientConfigurationRepository repository;

    public OpenFrameClientConfiguration get() {
        return repository.findById(DEFAULT_ID)
                .orElseThrow(() -> new IllegalStateException("No openframe client configuration found"));
    }

    public Optional<OpenFrameClientConfiguration> findById(String id) {
        return repository.findById(id);
    }

    public OpenFrameClientConfiguration save(OpenFrameClientConfiguration config) {
        return repository.save(config);
    }

    @RetryOnOptimisticLockingFailure
    public void markAsNonPublished() {
        OpenFrameClientConfiguration config = get();
        PublishState currentState = config.getPublishState();
        PublishState nextState = PublishState.nonPublished(currentState);
        config.setPublishState(nextState);
        save(config);
    }

    public void markAsPublished() {
        OpenFrameClientConfiguration config = get();
        PublishState currentState = config.getPublishState();
        PublishState nextState = PublishState.published(currentState);
        config.setPublishState(nextState);
        save(config);
    }

    @RetryOnOptimisticLockingFailure
    public OpenFrameClientConfiguration updateVersionAndMarkPending(String newVersion) {
        OpenFrameClientConfiguration config = get();
        String oldVersion = config.getVersion();
        if (Objects.equals(oldVersion, newVersion)) {
            return config;
        }
        config.setVersion(newVersion);
        config.setPublishState(new PublishState(false, null, 0));
        OpenFrameClientConfiguration saved = save(config);
        log.info("Updated client configuration version {} -> {} and marked for publish", oldVersion, newVersion);
        return saved;
    }

    @RetryOnOptimisticLockingFailure
    public void updateConfigurationFields(OpenFrameClientConfiguration fromConfig) {
        String fromConfigId = fromConfig.getId();
        findById(fromConfigId).ifPresentOrElse(
                existing -> mergeAndSave(existing, fromConfig),
                () -> save(fromConfig)
        );
    }

    private void mergeAndSave(OpenFrameClientConfiguration existing, OpenFrameClientConfiguration fromConfig) {
        List<DownloadConfiguration> existingDownloadConfiguration = existing.getDownloadConfiguration();
        List<DownloadConfiguration> fromConfigDownloadConfiguration = fromConfig.getDownloadConfiguration();
        boolean downloadChanged = !Objects.equals(existingDownloadConfiguration, fromConfigDownloadConfiguration);

        existing.setDownloadConfiguration(fromConfigDownloadConfiguration);

        if (downloadChanged) {
            existing.setPublishState(new PublishState(false, null, 0));
            log.info("Marked client configuration for publish: downloadChanged=true");
        }

        save(existing);
    }
}
