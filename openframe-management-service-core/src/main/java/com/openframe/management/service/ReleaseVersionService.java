package com.openframe.management.service;

import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReleaseVersionService {

    private final ReleaseVersionRepository releaseVersionRepository;

    public void process(String releaseVersion) {
        log.info("Processing release version: {}", releaseVersion);

        releaseVersionRepository.findFirstByOrderByCreatedAtAsc()
                .map(existing -> updateExistingReleaseVersion(existing, releaseVersion))
                .orElseGet(() -> createNewReleaseVersion(releaseVersion));
    }

    private ReleaseVersion updateExistingReleaseVersion(ReleaseVersion existing, String releaseVersion) {
        log.info("Updating existing release version from {} to {}", existing.getVersion(), releaseVersion);
        existing.setVersion(releaseVersion);
        
        ReleaseVersion saved = releaseVersionRepository.save(existing);
        log.info("Successfully updated release version: {} with id: {}", saved.getVersion(), saved.getId());
        
        return saved;
    }

    private ReleaseVersion createNewReleaseVersion(String releaseVersion) {
        log.info("Creating initial release version record for: {}", releaseVersion);
        ReleaseVersion newReleaseVersion = new ReleaseVersion();
        newReleaseVersion.setVersion(releaseVersion);
        
        ReleaseVersion saved = releaseVersionRepository.save(newReleaseVersion);
        log.info("Successfully created release version: {} with id: {}", saved.getVersion(), saved.getId());
        
        return saved;
    }
}

