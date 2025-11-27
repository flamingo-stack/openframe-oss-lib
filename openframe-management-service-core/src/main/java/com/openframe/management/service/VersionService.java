package com.openframe.management.service;

import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class VersionService {

    private final ReleaseVersionRepository releaseVersionRepository;

    public ReleaseVersion processVersion(String version) {
        log.info("Processing version: {}", version);
        
        return releaseVersionRepository.findFirstByOrderByCreatedAtAsc()
                .map(existing -> updateExistingVersion(existing, version))
                .orElseGet(() -> createNewVersion(version));
    }

    private ReleaseVersion updateExistingVersion(ReleaseVersion existing, String version) {
        log.info("Updating existing release version from {} to {}", existing.getVersion(), version);
        existing.setVersion(version);
        
        ReleaseVersion saved = releaseVersionRepository.save(existing);
        log.info("Successfully updated version: {} with id: {}", saved.getVersion(), saved.getId());
        
        return saved;
    }

    private ReleaseVersion createNewVersion(String version) {
        log.info("Creating initial version record for: {}", version);
        ReleaseVersion releaseVersion = new ReleaseVersion();
        releaseVersion.setVersion(version);
        
        ReleaseVersion saved = releaseVersionRepository.save(releaseVersion);
        log.info("Successfully created version: {} with id: {}", saved.getVersion(), saved.getId());
        
        return saved;
    }
}

