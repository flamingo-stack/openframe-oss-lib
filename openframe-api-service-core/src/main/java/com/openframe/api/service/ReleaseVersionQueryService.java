package com.openframe.api.service;

import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReleaseVersionQueryService {

    private final ReleaseVersionRepository releaseVersionRepository;

    public Optional<ReleaseVersion> getReleaseVersion() {
        log.debug("Retrieving current release version");
        return releaseVersionRepository.findFirstByOrderByCreatedAtAsc();
    }
}

