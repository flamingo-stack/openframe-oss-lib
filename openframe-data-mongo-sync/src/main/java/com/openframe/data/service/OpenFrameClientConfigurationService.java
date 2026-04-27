package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;

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

    @Retryable(
            retryFor = OptimisticLockingFailureException.class,
            maxAttempts = 5,
            backoff = @Backoff(delay = 50, multiplier = 2, random = true)
    )
    public void markAsNonPublished() {
        OpenFrameClientConfiguration config = get();
        config.setPublishState(PublishState.nonPublished(config.getPublishState()));
        save(config);
    }

    public void markAsPublished() {
        OpenFrameClientConfiguration config = get();
        config.setPublishState(PublishState.published(config.getPublishState()));
        save(config);
    }

    @Retryable(
            retryFor = OptimisticLockingFailureException.class,
            maxAttempts = 5,
            backoff = @Backoff(delay = 50, multiplier = 2, random = true)
    )
    public OpenFrameClientConfiguration updateVersionAndMarkPending(String newVersion) {
        OpenFrameClientConfiguration config = get();
        if (Objects.equals(config.getVersion(), newVersion)) {
            return config;
        }
        String oldVersion = config.getVersion();
        config.setVersion(newVersion);
        config.setPublishState(new PublishState(false, null, 0));
        OpenFrameClientConfiguration saved = save(config);
        log.info("Updated client configuration version {} -> {} and marked for publish", oldVersion, newVersion);
        return saved;
    }

    @Retryable(
            retryFor = OptimisticLockingFailureException.class,
            maxAttempts = 5,
            backoff = @Backoff(delay = 50, multiplier = 2, random = true)
    )
    public void updateConfigurationFields(OpenFrameClientConfiguration fromConfig) {
        Optional<OpenFrameClientConfiguration> existingOpt = findById(fromConfig.getId());
        if (existingOpt.isEmpty()) {
            save(fromConfig);
            return;
        }

        OpenFrameClientConfiguration existing = existingOpt.get();

        boolean downloadChanged = !Objects.equals(existing.getDownloadConfiguration(), fromConfig.getDownloadConfiguration());

        existing.setDownloadConfiguration(fromConfig.getDownloadConfiguration());

        if (downloadChanged) {
            existing.setPublishState(new PublishState(false, null, 0));
            log.info("Marked client configuration for publish: downloadChanged=true");
        }

        save(existing);
    }
}
